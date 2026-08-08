import base64
import io
import logging
import os
import random
from collections import Counter
from datetime import datetime

import anthropic
import cloudinary.uploader
import sendgrid
import stripe
from django.conf import settings
from django.db import IntegrityError, transaction
from sendgrid.helpers.mail import (
    Mail, Email, To, Content,
    Attachment, FileContent, FileName, FileType, Disposition,
)
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Flowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.lib.colors import HexColor
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Count, Max, Sum
from django.http import HttpResponse
from django.utils import timezone
from .models import Barbershop, Barber, Service, Reservation, User, ClientMedia, ClosedPeriod, Review, WaitingList, BarberLeave
from .emails import format_date_fr, format_date_fr_short, format_heure_fr
from .permissions import IsStaffRole
from .sms import send_reminders_for_tomorrow
from .serializers import (
    BarbershopSerializer, BarberSerializer, ServiceSerializer, ReservationSerializer,
    UserSerializer, RegisterSerializer, ClientMediaSerializer,
    ClosedPeriodSerializer, ReviewSerializer, WaitingListSerializer,
    BarberLeaveSerializer,
)

logger = logging.getLogger(__name__)

ANTHROPIC_MODEL = 'claude-sonnet-5'
ACOMPTE_FIXE = 5


class PayeStamp(Flowable):
    def __init__(self, label='PAYÉ'):
        super().__init__()
        self.label = label

    def draw(self):
        self.canv.saveState()
        self.canv.translate(60, 30)
        self.canv.rotate(-15)
        stamp_color = HexColor('#7BAF9E')
        self.canv.setStrokeColor(stamp_color)
        self.canv.setFillColor(stamp_color)
        self.canv.setLineWidth(2)
        self.canv.roundRect(-45, -18, 90, 36, 4, stroke=1, fill=0)
        self.canv.setFont('Helvetica-Bold', 22)
        self.canv.drawCentredString(0, -8, self.label)
        self.canv.restoreState()

    def wrap(self, *args):
        return (120, 60)


class SoldeRegleStamp(Flowable):
    def draw(self):
        self.canv.saveState()
        self.canv.translate(60, 30)
        self.canv.rotate(-15)
        stamp_color = HexColor('#2D6A4F')
        self.canv.setStrokeColor(stamp_color)
        self.canv.setFillColor(stamp_color)
        self.canv.setLineWidth(2)
        self.canv.roundRect(-62, -18, 124, 36, 4, stroke=1, fill=0)
        self.canv.setFont('Helvetica-Bold', 15)
        self.canv.drawCentredString(0, -6, 'SOLDE RÉGLÉ')
        self.canv.restoreState()

    def wrap(self, *args):
        return (140, 60)


def fmt_eur(n):
    return f"{n:.2f}".replace('.', ',') + ' €'


class BarbershopViewSet(viewsets.ModelViewSet):
    queryset = Barbershop.objects.all()
    serializer_class = BarbershopSerializer


class BarberViewSet(viewsets.ModelViewSet):
    queryset = Barber.objects.all()
    serializer_class = BarberSerializer

    def get_permissions(self):
        # La liste de l'équipe est publique (affichée côté client dans certains
        # écrans) mais la création/modification/suppression reste réservée à
        # Willo, comme pour ServiceViewSet ci-dessous.
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsStaffRole()]


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer

    def get_permissions(self):
        # La liste des prestations doit être publique (un client non connecté doit
        # pouvoir consulter les prix avant de réserver) — mais la création/modification/
        # suppression reste réservée à Willo, comme pour ClosedPeriodViewSet plus bas.
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsStaffRole()]


class ClosedPeriodViewSet(viewsets.ModelViewSet):
    queryset = ClosedPeriod.objects.all()
    serializer_class = ClosedPeriodSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsStaffRole()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class BarberLeaveViewSet(viewsets.ModelViewSet):
    queryset = BarberLeave.objects.all()
    serializer_class = BarberLeaveSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsStaffRole()]


class WaitingListViewSet(viewsets.ModelViewSet):
    queryset = WaitingList.objects.all()
    serializer_class = WaitingListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        is_staff = user.is_superuser or getattr(user, 'role', None) == 'admin'
        if is_staff:
            return WaitingList.objects.all()
        return WaitingList.objects.filter(client=user)

    def perform_create(self, serializer):
        serializer.save(client=self.request.user)


# Créneaux proposés côté client (cf. SLOT_GROUPS dans mobile/components/booking/data.ts) —
# tenus en phase manuellement, le salon n'ayant qu'un seul barbier donc pas de agenda par
# ressource à interroger dynamiquement.
SLOT_TIMES = [
    '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
]


@api_view(['GET'])
@permission_classes([AllowAny])
def available_slots(request):
    date_str = request.query_params.get('date')
    if not date_str:
        return Response({'error': 'date requis (YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        requested_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return Response({'error': 'Format de date invalide (YYYY-MM-DD attendu).'}, status=status.HTTP_400_BAD_REQUEST)

    booked_hhmm = {
        t.strftime('%H:%M')
        for t in Reservation.objects
            .filter(date=requested_date)
            .exclude(status__in=['cancelled', 'cancelled_client'])
            .values_list('time', flat=True)
    }

    slots = [
        {'start_time': slot, 'end_time': slot, 'is_available': slot not in booked_hhmm}
        for slot in SLOT_TIMES
    ]

    return Response({'date': date_str, 'slots': slots})


def send_confirmation_email(to_email, first_name, service_name, date, time, barber, total_price, acompte=5):
    try:
        sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
        solde = total_price - acompte
        date_fr = format_date_fr(date)
        heure_fr = format_heure_fr(time)
        html_content = f"""
        <div style="font-family: Georgia, serif; background-color: #0D0C0A; color: #FFFFFF; padding: 40px; max-width: 600px; margin: auto;">
            <h1 style="color: #C9A84C; font-size: 32px; margin-bottom: 4px;">WilloBarber</h1>
            <p style="color: #6B6560; font-size: 12px; letter-spacing: 2px; margin-top: 0;">SALON DE BARBIER · BRUXELLES</p>
            <hr style="border: 1px solid #1A1814; margin: 24px 0;">
            <h2 style="color: #FFFFFF;">Bonjour {first_name} 👋</h2>
            <p style="color: #CCCCCC;">Votre réservation est confirmée ! Nous avons hâte de vous accueillir.</p>
            <div style="background: #1A1814; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <table style="width: 100%; color: #FFFFFF;">
                    <tr><td style="color: #6B6560; padding: 6px 0;">Prestation</td><td style="text-align:right; font-weight:bold;">{service_name}</td></tr>
                    <tr><td style="color: #6B6560; padding: 6px 0;">Date</td><td style="text-align:right;">{date_fr}</td></tr>
                    <tr><td style="color: #6B6560; padding: 6px 0;">Heure</td><td style="text-align:right;">{heure_fr}</td></tr>
                    <tr><td style="color: #6B6560; padding: 6px 0;">Barbier</td><td style="text-align:right;">{barber}</td></tr>
                    <tr><td style="color: #6B6560; padding: 6px 0;">Acompte réglé</td><td style="text-align:right; color: #2D6A4F;">-{acompte}€</td></tr>
                    <tr><td style="color: #6B6560; padding: 6px 0; font-weight:bold;">Solde au salon</td><td style="text-align:right; color: #C9A84C; font-weight:bold;">{solde}€</td></tr>
                </table>
            </div>
            <p style="color: #CCCCCC;">📍 Rue Auguste Van Zande 78, Bruxelles</p>
            <p style="color: #6B6560; font-size: 12px;">Annulation gratuite jusqu'à 24h avant le rendez-vous.</p>
            <hr style="border: 1px solid #1A1814; margin: 24px 0;">
            <p style="color: #C9A84C; font-size: 14px; text-align: center;">À bientôt chez WilloBarber ✂️</p>
        </div>
        """
        message = Mail(
            from_email=Email('masamba.randy@gmail.com', 'WilloBarber'),
            to_emails=To(to_email),
            subject=f'✂️ Confirmation — {service_name} le {date_fr}',
            html_content=Content('text/html', html_content)
        )
        response = sg.send(message)
        print(f"[EMAIL] Confirmation envoyée à {to_email} — SendGrid status={response.status_code}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Échec envoi confirmation à {to_email}: {e}")
        return False


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer

    def get_queryset(self):
        user = self.request.user
        is_staff = user.is_superuser or getattr(user, 'role', None) == 'admin'
        if is_staff:
            return Reservation.objects.all()
        return Reservation.objects.filter(user=user)

    # Champs qu'un client n'est jamais autorisé à modifier lui-même — seul le
    # staff (via IsStaffRole) peut les toucher, sinon n'importe quel client
    # pourrait falsifier son propre statut de paiement.
    STAFF_ONLY_FIELDS = {'payment_status', 'payment_method', 'amount_paid'}
    # Seules ces actions restent ouvertes à un client sur sa propre réservation :
    # l'annuler (status='cancelled_client' + motif) ou la reprogrammer (date/heure)
    # — cf. reservationsApi.cancel()/.reschedule() côté mobile.
    CLIENT_ALLOWED_FIELDS = {'status', 'cancellation_reason', 'date', 'time'}

    def perform_update(self, serializer):
        user = self.request.user
        is_staff = user.is_superuser or getattr(user, 'role', None) == 'admin'
        if not is_staff:
            requested_fields = set(self.request.data.keys())
            if requested_fields & self.STAFF_ONLY_FIELDS:
                raise PermissionDenied("Seul le salon peut modifier ces informations.")
            if requested_fields - self.CLIENT_ALLOWED_FIELDS:
                raise PermissionDenied("Vous ne pouvez qu'annuler ou reprogrammer votre réservation.")
            # Un client ne peut faire évoluer le statut que vers "annulé par le client".
            if 'status' in requested_fields and self.request.data.get('status') != 'cancelled_client':
                raise PermissionDenied("Vous ne pouvez qu'annuler votre réservation.")
        serializer.save()

    def create(self, request, *args, **kwargs):
        date = request.data.get('date')
        time = request.data.get('time')
        conflict_response = Response(
            {'error': "Ce créneau vient d'être pris. Veuillez choisir un autre horaire."},
            status=status.HTTP_409_CONFLICT,
        )

        with transaction.atomic():
            # select_for_update ferme la fenêtre de course quand une réservation
            # active existe déjà sur ce créneau. Elle ne verrouille rien sur un
            # créneau tout neuf (rien à sélectionner) — c'est la contrainte
            # unique_active_reservation_slot en base (cf. models.py) qui ferme
            # ce second cas : deux requêtes simultanées sur un créneau libre
            # provoquent un IntegrityError pour l'une des deux, rattrapé plus bas.
            conflict = Reservation.objects.select_for_update().filter(
                date=date,
                time=time,
                status__in=['pending', 'confirmed'],
            ).exists()

            if conflict:
                return conflict_response

            try:
                # Savepoint imbriqué : si super().create() lève une IntegrityError,
                # seul ce savepoint est annulé — la transaction englobante reste
                # utilisable pour renvoyer une réponse propre au lieu de planter.
                with transaction.atomic():
                    return super().create(request, *args, **kwargs)
            except IntegrityError:
                return conflict_response
            except Exception as e:
                print(f"[RESERVATION] Bad Request — data reçue: {request.data} — erreur: {e}")
                raise

    def perform_create(self, serializer):
        print(f"[RESERVATION] data: {self.request.data}")
        print(f"[RESERVATION] user: {self.request.user}")
        reservation = serializer.save(user=self.request.user)
        print(f"[RESERVATION] sauvegardée: id={reservation.id}")

        try:
            print(f"[EMAIL] Envoi à {self.request.user.email} pour réservation {reservation.id}")
            email_sent = send_confirmation_email(
                to_email=self.request.user.email,
                first_name=self.request.user.first_name or self.request.user.username,
                service_name=reservation.service.name,
                date=reservation.date,
                time=reservation.time,
                barber="Willo",
                total_price=float(reservation.service.price),
                acompte=5
            )
            if email_sent:
                print(f"[EMAIL] Envoyé avec succès à {self.request.user.email} pour réservation {reservation.id}")
            else:
                print(f"[EMAIL] Échec de l'envoi à {self.request.user.email} pour réservation {reservation.id} (voir [EMAIL ERROR] ci-dessus)")
        except Exception as e:
            import traceback
            print(f"[EMAIL ERROR] {str(e)}")
            print(traceback.format_exc())


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request=request, username=username, password=password)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            })
        return Response(
            {'detail': 'Identifiants invalides.', 'debug': {'username_received': username, 'password_empty': not password}},
            status=status.HTTP_401_UNAUTHORIZED,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data.get('refresh'))
            token.blacklist()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception:
            return Response(status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.check_password(request.data.get('old_password')):
            return Response({'detail': 'Ancien mot de passe incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(request.data.get('new_password'))
        user.save()
        return Response({'detail': 'Mot de passe mis à jour.'})


class PasswordlessLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = (request.data.get('identifier') or request.data.get('email') or '').strip()
        if not identifier:
            return Response({'error': 'identifier requis'}, status=400)

        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        else:
            digits = ''.join(filter(str.isdigit, identifier))
            user = User.objects.filter(phone=digits).first() if digits else None

        if not user:
            return Response({'error': 'Utilisateur non trouvé'}, status=404)
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
            },
        })


class OAuthLoginView(APIView):
    """Connexion via un provider OAuth externe (Gmail, Outlook) déjà vérifié
    côté client par expo-auth-session — l'email fourni est donc considéré
    fiable. Contrairement à PasswordlessLoginView, cette route crée le compte
    client à la volée si l'email n'existe pas encore (aucun mot de passe
    utilisable n'est défini : seule la connexion OAuth ou passwordless
    permettra de s'y reconnecter)."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'error': 'email requis'}, status=400)

        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            base_username = email.split('@')[0] or 'client'
            username = base_username
            suffix = 1
            while User.objects.filter(username=username).exists():
                suffix += 1
                username = f'{base_username}{suffix}'
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
            )
            user.set_unusable_password()
            user.save()

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
            },
        })


class CheckClientView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get('identifier', '').strip()
        print(f"DEBUG CHECK-CLIENT: identifier='{identifier}'")

        all_users = User.objects.all()
        print(f"DEBUG USERS COUNT: {all_users.count()}")
        for u in all_users[:3]:
            print(f"DEBUG USER: username={u.username} email={u.email}")

        if not identifier:
            return Response({'error': 'identifier requis'}, status=400)

        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        else:
            digits = ''.join(filter(str.isdigit, identifier))
            user = User.objects.filter(phone=digits).first() if digits else None

        print(f"DEBUG FOUND: {user}")
        if user:
            return Response({'status': 'exists', 'first_name': user.first_name or user.username})
        return Response({'status': 'new'})


MOCK_RESERVATION_HISTORY = """- Signature WilloBarber (45€) — 8 fois
- Taille & rasage (28€) — 2 fois
- Dernière visite : 12 AVR 2026
- Intervalle moyen : 28 jours
- Points fidélité : 316 pts (niveau ARGENT)"""


def _generate_ai_recommendation_text(history_text):
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        logger.warning('ANTHROPIC_API_KEY manquant — recommandation IA non générée.')
        return None

    prompt = (
        "Tu es l'assistant IA de WilloBarber, un salon de coiffure premium à Bruxelles.\n"
        "Basé sur cet historique client :\n"
        f"{history_text}\n\n"
        "Génère une recommandation courte et personnalisée (3-4 phrases max) pour ce client. "
        "Suggère quand reprendre RDV, quelle prestation et pourquoi. Ton chic et bienveillant."
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=400,
            thinking={'type': 'disabled'},
            messages=[{'role': 'user', 'content': prompt}],
        )
    except Exception as e:
        import traceback
        print("ERREUR IA:", traceback.format_exc())
        return f"ERREUR: {str(e)}"

    if response.stop_reason == 'refusal':
        logger.warning('Recommandation IA refusée par les classifieurs de sécurité.')
        return None

    return next((block.text for block in response.content if block.type == 'text'), None)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recommendations(request):
    user = request.user

    if not user.ai_recommendations:
        return Response({'recommendations': [], 'ai_text': None, 'message': 'Recommandations IA désactivées.'})

    history = Reservation.objects.filter(user=user).exclude(status__in=['cancelled', 'cancelled_client']).order_by('-date')

    recommendations_data = None

    if history.count() >= 2:
        dates = list(history.order_by('date').values_list('date', flat=True))
        intervals = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
        avg_interval = sum(intervals) / len(intervals) if intervals else 0

        counts_by_service = Counter(history.values_list('service_id', flat=True))
        fav_service_id, fav_service_count = counts_by_service.most_common(1)[0]
        fav_service = Service.objects.get(pk=fav_service_id)
        last_reservation = history.first()

        history_text = "\n".join(
            f"- {r.service.name} ({r.service.price}€) — {r.date}"
            for r in history[:5]
        )
        recommendations_data = {
            'avg_interval_days': round(avg_interval),
            'favorite_service': ServiceSerializer(fav_service).data,
            'last_reservation': ReservationSerializer(last_reservation).data,
        }
    else:
        history_text = MOCK_RESERVATION_HISTORY

    ai_text = _generate_ai_recommendation_text(history_text)

    return Response({
        'recommendations': recommendations_data or [],
        'ai_text': ai_text,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reservation_qr_code(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'error': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff = request.user.is_superuser or getattr(request.user, 'role', None) == 'admin'
    if not is_staff and reservation.user_id != request.user.id:
        return Response({'error': "Vous n'avez pas accès à ce QR code."}, status=status.HTTP_403_FORBIDDEN)

    return Response({
        'reservation_id': reservation.id,
        'qr_code': str(reservation.qr_code),
        'checked_in': reservation.checked_in,
    })


@api_view(['POST'])
@permission_classes([IsStaffRole])
def checkin_reservation(request, qr_code):
    try:
        reservation = Reservation.objects.select_related('user', 'service').get(qr_code=qr_code)
    except Reservation.DoesNotExist:
        return Response({'error': 'QR code invalide — aucune réservation correspondante.'}, status=status.HTTP_404_NOT_FOUND)

    already_checked_in = reservation.checked_in
    if not already_checked_in:
        reservation.checked_in = True
        reservation.checked_in_at = timezone.now()
        reservation.save(update_fields=['checked_in', 'checked_in_at'])

    client = reservation.user
    client_name = f"{client.first_name} {client.last_name}".strip() or client.username

    return Response({
        'success': True,
        'already_checked_in': already_checked_in,
        'reservation_id': reservation.id,
        'client_name': client_name,
        'client_email': client.email,
        'client_phone': client.phone,
        'service_name': reservation.service.name,
        'date': reservation.date,
        'time': reservation.time,
        'checked_in_at': reservation.checked_in_at,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_invoice(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'error': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff = request.user.is_superuser or getattr(request.user, 'role', None) == 'admin'
    if not is_staff and reservation.user_id != request.user.id:
        return Response({'error': "Vous n'avez pas accès à cette facture."}, status=status.HTTP_403_FORBIDDEN)

    user = reservation.user
    service = reservation.service
    print(f"[FACTURE] Génération pour réservation {reservation.id} - {service.name} - {service.price}€")

    invoice_number = f"WB-2026-{random.randint(10000, 99999)}"
    today = format_date_fr_short(datetime.now().date())

    total_ttc = float(service.price)
    acompte = float(reservation.amount_paid) if reservation.amount_paid is not None else ACOMPTE_FIXE
    is_fully_paid = acompte >= total_ttc
    sous_total_ht = total_ttc / 1.21
    tva = total_ttc - sous_total_ht
    solde = 0 if is_fully_paid else max(total_ttc - acompte, 0)
    methode_label = reservation.get_payment_method_display() or 'Carte'

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        rightMargin=20*mm, leftMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm)

    gold = colors.HexColor('#C9A84C')
    dark = colors.HexColor('#1A1814')
    cream = colors.HexColor('#F5F0E8')
    green = colors.HexColor('#2D6A4F')
    grey = colors.HexColor('#888888')

    styles = getSampleStyleSheet()

    elements = []

    # Header
    header_data = [[
        Paragraph('<b>w willobarber</b><br/><font size=8 color=grey>SALON DE BARBIER · BERCHEM</font>', styles['Normal']),
        Paragraph(f'<font size=26><i>Facture.</i></font><br/><br/><font size=10 color=grey>N° {invoice_number}</font><br/><font size=10 color=grey>Émise le {today}</font>', ParagraphStyle('h', alignment=TA_RIGHT, spaceAfter=6, leading=32))
    ]]
    header_table = Table(header_data, colWidths=[90*mm, 90*mm])
    header_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=1, color=dark))
    elements.append(Spacer(1, 10*mm))

    # Parties
    first_name = user.first_name or user.username
    last_name = user.last_name or ''
    parties_data = [[
        Paragraph(f'<font size=9 color=grey>ÉMETTEUR</font><br/><b>WilloBarber SRL</b><br/>78 rue Auguste van Zande<br/>1082 Bruxelles · Belgique<br/>contact@willobarber.be<br/>+32 2 555 04 04<br/><font size=9 color=grey>TVA BE 0789.123.456</font>', styles['Normal']),
        [
            Paragraph(f'<font size=9 color=grey>FACTURÉ À</font><br/><b>{first_name} {last_name}</b><br/>{user.email}', ParagraphStyle('right', alignment=TA_RIGHT)),
            PayeStamp(label='RÉGLÉ' if is_fully_paid else 'PAYÉ'),
        ]
    ]]
    parties_table = Table(parties_data, colWidths=[90*mm, 90*mm])
    parties_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
    ]))
    elements.append(parties_table)
    elements.append(Spacer(1, 10*mm))

    # Tableau prestations
    data = [
        ['DESCRIPTION', 'QTÉ', 'P.U. HT', 'TVA', 'TOTAL TTC'],
        [service.name, '1', fmt_eur(sous_total_ht), '21%', fmt_eur(total_ttc)],
    ]
    t = Table(data, colWidths=[80*mm, 20*mm, 30*mm, 20*mm, 30*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), dark),
        ('TEXTCOLOR', (0,0), (-1,0), gold),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('ROWBACKGROUND', (0,1), (-1,-1), cream),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 8*mm))

    # Récap
    recap_data = [
        ['Méthode', methode_label],
        ['Sous-total HT', fmt_eur(sous_total_ht)],
        ['TVA 21%', fmt_eur(tva)],
        ['Total TTC', fmt_eur(total_ttc)],
        ['INTÉGRALEMENT RÉGLÉ' if is_fully_paid else 'Acompte réglé', f'-{fmt_eur(acompte)}'],
        ['Solde dû au salon', fmt_eur(solde)],
    ]
    recap_table = Table(recap_data, colWidths=[80*mm, 40*mm], hAlign='RIGHT')
    recap_table.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (1,3), (1,3), dark),
        ('FONTNAME', (0,3), (-1,3), 'Helvetica-Bold'),
        ('FONTNAME', (0,5), (-1,5), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0,4), (-1,4), green),
        ('LINEABOVE', (0,3), (-1,3), 1, dark),
        ('LINEABOVE', (0,5), (-1,5), 1, dark),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(recap_table)
    elements.append(Spacer(1, 6*mm))

    # Bloc RÉGLÉ CE JOUR
    regle_label = 'RÉGLÉ CE JOUR · Paiement intégral' if is_fully_paid else 'RÉGLÉ CE JOUR · Acompte de réservation'
    regle_data = [[regle_label, fmt_eur(acompte)]]
    regle_table = Table(regle_data, colWidths=[120*mm, 40*mm], hAlign='RIGHT')
    regle_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), dark),
        ('TEXTCOLOR', (0,0), (0,0), colors.white),
        ('TEXTCOLOR', (1,0), (1,0), gold),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 11),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('PADDING', (0,0), (-1,-1), 10),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    elements.append(regle_table)
    elements.append(Spacer(1, 6*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=grey))
    elements.append(Spacer(1, 4*mm))
    note_text = (
        f"Cette prestation a été réglée intégralement en ligne ({fmt_eur(acompte)}). Aucun solde ne reste dû au salon."
        if is_fully_paid else
        f"Cette facture concerne uniquement l'acompte de {fmt_eur(acompte)} encaissé pour sécuriser la réservation. Une facture finale sera émise à l'issue du rendez-vous."
    )
    elements.append(Paragraph(
        note_text,
        ParagraphStyle('note', fontSize=9, textColor=grey)
    ))

    doc.build(elements)
    buffer.seek(0)

    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Facture_WilloBarber_{invoice_number}.pdf"'
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment_intent(request):
    stripe.api_key = settings.STRIPE_SECRET_KEY
    amount = request.data.get('amount')
    currency = request.data.get('currency', 'eur')

    try:
        amount = int(round(float(amount) * 100))
    except (TypeError, ValueError):
        return Response({'error': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    if amount <= 0:
        return Response({'error': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            metadata={'user_id': request.user.id, 'username': request.user.username},
        )
    except stripe.error.StripeError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'clientSecret': intent.client_secret})


def build_final_invoice_pdf(reservation):
    """Facture finale émise quand le solde est réglé au salon (cash/carte)."""
    user = reservation.user
    service = reservation.service
    invoice_number = f"WB-FINAL-{reservation.id}"
    today = format_date_fr_short(datetime.now().date())

    total_ttc = float(service.price)
    acompte = ACOMPTE_FIXE
    solde = float(reservation.amount_paid) if reservation.amount_paid is not None else max(total_ttc - acompte, 0)
    methode_label = reservation.get_payment_method_display() or '—'

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        rightMargin=20*mm, leftMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm)

    gold = colors.HexColor('#C9A84C')
    dark = colors.HexColor('#1A1814')
    green = colors.HexColor('#2D6A4F')
    grey = colors.HexColor('#888888')

    styles = getSampleStyleSheet()
    elements = []

    # Header
    header_data = [[
        Paragraph('<b>w willobarber</b><br/><font size=8 color=grey>SALON DE BARBIER · BERCHEM</font>', styles['Normal']),
        Paragraph(f'<font size=26><i>Facture finale.</i></font><br/><br/><font size=10 color=grey>N° {invoice_number}</font><br/><font size=10 color=grey>Émise le {today}</font>', ParagraphStyle('h', alignment=TA_RIGHT, spaceAfter=6, leading=32))
    ]]
    header_table = Table(header_data, colWidths=[90*mm, 90*mm])
    header_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=1, color=dark))
    elements.append(Spacer(1, 10*mm))

    # Parties
    first_name = user.first_name or user.username
    last_name = user.last_name or ''
    parties_data = [[
        Paragraph(f'<font size=9 color=grey>ÉMETTEUR</font><br/><b>WilloBarber SRL</b><br/>78 rue Auguste van Zande<br/>1082 Bruxelles · Belgique<br/>contact@willobarber.be<br/>+32 2 555 04 04<br/><font size=9 color=grey>TVA BE 0789.123.456</font>', styles['Normal']),
        [
            Paragraph(f'<font size=9 color=grey>FACTURÉ À</font><br/><b>{first_name} {last_name}</b><br/>{user.email}', ParagraphStyle('right', alignment=TA_RIGHT)),
            SoldeRegleStamp(),
        ]
    ]]
    parties_table = Table(parties_data, colWidths=[90*mm, 90*mm])
    parties_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
    ]))
    elements.append(parties_table)
    elements.append(Spacer(1, 10*mm))

    # Récapitulatif
    recap_data = [
        [service.name, fmt_eur(total_ttc)],
        ['Acompte déjà réglé en ligne', f'-{fmt_eur(acompte)}'],
        [f'Solde réglé au salon ({methode_label})', fmt_eur(solde)],
        ['Total réglé', fmt_eur(total_ttc)],
    ]
    recap_table = Table(recap_data, colWidths=[130*mm, 40*mm], hAlign='RIGHT')
    recap_table.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 10.5),
        ('TEXTCOLOR', (1,1), (1,1), green),
        ('TEXTCOLOR', (1,2), (1,2), green),
        ('FONTNAME', (0,3), (-1,3), 'Helvetica-Bold'),
        ('FONTSIZE', (0,3), (-1,3), 12.5),
        ('TEXTCOLOR', (1,3), (1,3), gold),
        ('LINEABOVE', (0,3), (-1,3), 1, dark),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(recap_table)
    elements.append(Spacer(1, 8*mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=grey))
    elements.append(Spacer(1, 4*mm))
    elements.append(Paragraph(
        "Prestation entièrement réglée. Merci de votre confiance.",
        ParagraphStyle('note', fontSize=10, textColor=green, alignment=TA_CENTER)
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read(), invoice_number


@api_view(['POST'])
@permission_classes([IsStaffRole])
def send_final_invoice(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'error': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if reservation.payment_status != 'paid_onsite':
        return Response(
            {'error': "La réservation n'est pas marquée comme payée au salon."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pdf_bytes, invoice_number = build_final_invoice_pdf(reservation)

    try:
        sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
        message = Mail(
            from_email=Email('masamba.randy@gmail.com', 'WilloBarber'),
            to_emails=To(reservation.user.email),
            subject=f'✂️ Facture finale — {reservation.service.name}',
            html_content=Content('text/html', f"""
                <div style="font-family: Georgia, serif; background-color: #0D0C0A; color: #FFFFFF; padding: 40px; max-width: 600px; margin: auto;">
                    <h1 style="color: #C9A84C; font-size: 32px; margin-bottom: 4px;">WilloBarber</h1>
                    <p style="color: #6B6560; font-size: 12px; letter-spacing: 2px; margin-top: 0;">SALON DE BARBIER · BRUXELLES</p>
                    <hr style="border: 1px solid #1A1814; margin: 24px 0;">
                    <h2 style="color: #FFFFFF;">Merci pour votre visite {reservation.user.first_name or reservation.user.username} ✂️</h2>
                    <p style="color: #CCCCCC;">Votre prestation est entièrement réglée. Vous trouverez votre facture finale en pièce jointe.</p>
                    <hr style="border: 1px solid #1A1814; margin: 24px 0;">
                    <p style="color: #C9A84C; font-size: 14px; text-align: center;">À bientôt chez WilloBarber ✂️</p>
                </div>
            """),
        )
        message.attachment = Attachment(
            FileContent(base64.b64encode(pdf_bytes).decode()),
            FileName(f'{invoice_number}.pdf'),
            FileType('application/pdf'),
            Disposition('attachment'),
        )
        sg.send(message)
        print(f"[EMAIL] Facture finale envoyée à {reservation.user.email}")
    except Exception as e:
        print(f"[EMAIL ERROR] Facture finale: {str(e)}")
        return Response(
            {'error': "Le paiement a été enregistré mais l'email n'a pas pu être envoyé."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response({'success': True, 'invoice_number': invoice_number})


@api_view(['GET'])
@permission_classes([IsStaffRole])
def download_final_invoice(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'error': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if reservation.payment_status != 'paid_onsite':
        return Response(
            {'error': "La réservation n'est pas marquée comme payée au salon."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pdf_bytes, invoice_number = build_final_invoice_pdf(reservation)
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{invoice_number}.pdf"'
    return response


@api_view(['POST'])
@permission_classes([IsStaffRole])
def upload_client_media(request):
    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return Response({'error': 'Fichier requis.'}, status=status.HTTP_400_BAD_REQUEST)

    client_id = request.data.get('client')
    if not client_id:
        return Response({'error': 'client requis.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        client = User.objects.get(pk=client_id)
    except User.DoesNotExist:
        return Response({'error': 'Client introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    media_type = request.data.get('media_type') or (
        'video' if (uploaded_file.content_type or '').startswith('video') else 'photo'
    )
    if media_type not in ('photo', 'video'):
        return Response({'error': 'media_type doit être "photo" ou "video".'}, status=status.HTTP_400_BAD_REQUEST)

    reservation = None
    reservation_id = request.data.get('reservation')
    if reservation_id:
        try:
            reservation = Reservation.objects.get(pk=reservation_id)
        except Reservation.DoesNotExist:
            return Response({'error': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        result = cloudinary.uploader.upload(
            uploaded_file,
            resource_type='video' if media_type == 'video' else 'image',
            folder='willobarber/client_media',
        )
        logger.info(f"[CLOUDINARY UPLOAD SUCCESS] public_id={result.get('public_id')} url={result.get('secure_url')}")
    except Exception as e:
        logger.error(f"[CLOUDINARY UPLOAD ERROR] {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    media = ClientMedia.objects.create(
        client=client,
        reservation=reservation,
        media_type=media_type,
        cloudinary_url=result.get('secure_url'),
        cloudinary_public_id=result.get('public_id'),
        caption=request.data.get('caption', ''),
    )

    return Response(ClientMediaSerializer(media).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_profile_picture(request):
    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return Response({'error': 'Fichier requis.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = cloudinary.uploader.upload(
            uploaded_file,
            resource_type='image',
            folder='willobarber/profiles',
        )
        logger.info(f"[CLOUDINARY UPLOAD SUCCESS] public_id={result.get('public_id')} url={result.get('secure_url')}")
    except Exception as e:
        logger.error(f"[CLOUDINARY UPLOAD ERROR] {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    request.user.profile_picture = result.get('secure_url')
    request.user.save(update_fields=['profile_picture'])

    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def client_media_list(request, pk):
    is_staff = request.user.is_superuser or getattr(request.user, 'role', None) == 'admin'
    if not is_staff and request.user.id != pk:
        return Response({'error': "Vous n'avez pas accès à cette galerie."}, status=status.HTTP_403_FORBIDDEN)

    media = ClientMedia.objects.filter(client_id=pk)
    if not is_staff:
        media = media.filter(shared_with_client=True)
    return Response(ClientMediaSerializer(media, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsStaffRole])
def share_client_media(request, pk):
    try:
        media = ClientMedia.objects.get(pk=pk)
    except ClientMedia.DoesNotExist:
        return Response({'error': 'Media introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    media.shared_with_client = True
    media.save(update_fields=['shared_with_client'])
    return Response(ClientMediaSerializer(media).data)


def _serialize_clients(queryset):
    clients = queryset.annotate(
        total_reservations=Count('reservation', distinct=True),
        last_visit=Max('reservation__date'),
        total_spent=Sum('reservation__amount_paid'),
    ).order_by('-date_joined')

    return [
        {
            'id': c.id,
            'first_name': c.first_name,
            'last_name': c.last_name,
            'email': c.email,
            'phone': c.phone,
            'total_reservations': c.total_reservations,
            'last_visit': c.last_visit.isoformat() if c.last_visit else None,
            'total_spent': float(c.total_spent or 0),
            'date_joined': c.date_joined.isoformat(),
            'is_at_risk': c.is_at_risk,
            'deleted_at': c.deleted_at.isoformat() if c.deleted_at else None,
            'status': (
                'VIP' if c.total_reservations >= 10
                else 'Nouveau' if c.total_reservations == 1
                else 'Fidèle'
            ),
        }
        for c in clients
    ]


@api_view(['GET'])
@permission_classes([IsStaffRole])
def client_list(request):
    clients = User.objects.filter(role='client', is_deleted=False)
    return Response(_serialize_clients(clients))


@api_view(['GET'])
@permission_classes([IsStaffRole])
def deleted_client_list(request):
    clients = User.objects.filter(role='client', is_deleted=True)
    return Response(_serialize_clients(clients))


@api_view(['DELETE'])
@permission_classes([IsStaffRole])
def delete_client(request, pk):
    try:
        client = User.objects.get(pk=pk, role='client', is_deleted=False)
    except User.DoesNotExist:
        return Response({'error': 'Client introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    client.is_deleted = True
    client.deleted_at = timezone.now()
    client.save(update_fields=['is_deleted', 'deleted_at'])
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsStaffRole])
def restore_client(request, pk):
    try:
        client = User.objects.get(pk=pk, role='client', is_deleted=True)
    except User.DoesNotExist:
        return Response({'error': 'Client supprimé introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    client.is_deleted = False
    client.deleted_at = None
    client.save(update_fields=['is_deleted', 'deleted_at'])
    return Response(_serialize_clients(User.objects.filter(pk=client.pk))[0])


@api_view(['POST'])
@permission_classes([IsStaffRole])
def send_reminders(request):
    result = send_reminders_for_tomorrow()
    return Response(result)


class ReviewListCreateView(APIView):
    """GET (Willo) liste tous les avis · POST (client) soumet un avis sur son RDV terminé."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [IsStaffRole()]

    def get(self, request):
        reviews = Review.objects.select_related('user', 'reservation__service').all()
        return Response(ReviewSerializer(reviews, many=True).data)

    def post(self, request):
        reservation_id = request.data.get('reservation')
        try:
            reservation = Reservation.objects.get(pk=reservation_id)
        except (Reservation.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if reservation.user_id != request.user.id:
            return Response({'error': "Cette réservation ne vous appartient pas."}, status=status.HTTP_403_FORBIDDEN)

        if reservation.status != 'completed':
            return Response(
                {'error': 'Seule une réservation terminée peut être notée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Review.objects.filter(reservation=reservation).exists():
            return Response(
                {'error': 'Un avis a déjà été soumis pour cette réservation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            rating = int(request.data.get('rating'))
        except (TypeError, ValueError):
            return Response({'error': 'Note invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        if rating < 1 or rating > 5:
            return Response({'error': 'La note doit être comprise entre 1 et 5.'}, status=status.HTTP_400_BAD_REQUEST)

        review = Review.objects.create(
            user=request.user,
            reservation=reservation,
            rating=rating,
            comment=request.data.get('comment') or '',
        )
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_reviews(request):
    reviews = Review.objects.filter(user=request.user).select_related('reservation__service')
    return Response(ReviewSerializer(reviews, many=True).data)


@api_view(['POST'])
@permission_classes([IsStaffRole])
def reply_to_review(request, pk):
    try:
        review = Review.objects.get(pk=pk)
    except Review.DoesNotExist:
        return Response({'error': 'Avis introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    reply_text = (request.data.get('reply') or '').strip()
    if not reply_text:
        return Response({'error': 'La réponse ne peut pas être vide.'}, status=status.HTTP_400_BAD_REQUEST)

    review.reply = reply_text
    review.replied_at = timezone.now()
    review.save(update_fields=['reply', 'replied_at'])

    return Response(ReviewSerializer(review).data)
