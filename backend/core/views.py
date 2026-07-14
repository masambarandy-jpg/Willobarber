import io
import logging
import os
import random
from collections import Counter
from datetime import datetime

import anthropic
import sendgrid
from sendgrid.helpers.mail import Mail, Email, To, Content
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
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.http import HttpResponse
from .models import Barbershop, Service, Reservation, User
from .serializers import (
    BarbershopSerializer, ServiceSerializer, ReservationSerializer,
    UserSerializer, RegisterSerializer,
)

logger = logging.getLogger(__name__)

ANTHROPIC_MODEL = 'claude-sonnet-5'


class PayeStamp(Flowable):
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
        self.canv.drawCentredString(0, -8, 'PAYÉ')
        self.canv.restoreState()

    def wrap(self, *args):
        return (120, 60)


class BarbershopViewSet(viewsets.ModelViewSet):
    queryset = Barbershop.objects.all()
    serializer_class = BarbershopSerializer


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer


def send_confirmation_email(to_email, first_name, service_name, date, time, barber, total_price, acompte=5):
    try:
        sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
        solde = total_price - acompte
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
                    <tr><td style="color: #6B6560; padding: 6px 0;">Date</td><td style="text-align:right;">{date}</td></tr>
                    <tr><td style="color: #6B6560; padding: 6px 0;">Heure</td><td style="text-align:right;">{time}</td></tr>
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
            subject=f'✂️ Confirmation — {service_name} le {date}',
            html_content=Content('text/html', html_content)
        )
        sg.send(message)
        logger.info(f"[EMAIL] Confirmation envoyée à {to_email}")
    except Exception as e:
        logger.error(f"[EMAIL ERROR] {str(e)}")


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer

    def perform_create(self, serializer):
        reservation = serializer.save(user=self.request.user)
        send_confirmation_email(
            to_email=reservation.user.email,
            first_name=reservation.user.first_name or reservation.user.username,
            service_name=reservation.service.name,
            date=reservation.date.strftime('%d/%m/%Y'),
            time=reservation.time.strftime('%H:%M'),
            barber='Willo',
            total_price=reservation.service.price,
        )


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

    history = Reservation.objects.filter(user=user).exclude(status='cancelled').order_by('-date')

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
def generate_invoice(request):
    user = request.user
    invoice_number = f"WB-2026-{random.randint(10000, 99999)}"
    today = datetime.now().strftime("%d %B %Y")

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
            PayeStamp(),
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
        ['Signature WilloBarber', '1', '37,19 €', '21%', '45,00 €'],
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
        ['Méthode', 'Carte ····4242'],
        ['Sous-total HT', '37,19 €'],
        ['TVA 21%', '7,81 €'],
        ['Total TTC', '45,00 €'],
        ['Acompte réglé', '-5,00 €'],
        ['Solde dû au salon', '40,00 €'],
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
    regle_data = [['RÉGLÉ CE JOUR · Acompte de réservation', '5,00 €']]
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
    elements.append(Paragraph(
        "Cette facture concerne uniquement l'acompte de 5,00 € encaissé pour sécuriser la réservation. Une facture finale sera émise à l'issue du rendez-vous.",
        ParagraphStyle('note', fontSize=9, textColor=grey)
    ))

    doc.build(elements)
    buffer.seek(0)

    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Facture_WilloBarber_{invoice_number}.pdf"'
    return response
