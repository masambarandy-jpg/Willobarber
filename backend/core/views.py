import io
import logging
import os
from collections import Counter

import anthropic
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
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


class BarbershopViewSet(viewsets.ModelViewSet):
    queryset = Barbershop.objects.all()
    serializer_class = BarbershopSerializer


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer


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
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []

    # Titre
    elements.append(Paragraph("WilloBarber", styles['Title']))
    elements.append(Paragraph("Facture", styles['Heading1']))
    elements.append(Spacer(1, 20))

    # Infos
    elements.append(Paragraph(f"Client : {request.user.first_name} {request.user.last_name}", styles['Normal']))
    elements.append(Paragraph(f"Email : {request.user.email}", styles['Normal']))
    elements.append(Spacer(1, 20))

    # Tableau prestations
    data = [
        ['Description', 'Qté', 'P.U. HT', 'TVA', 'Total TTC'],
        ['Signature WilloBarber', '1', '37,19 €', '21%', '45,00 €'],
        ['', '', '', 'Acompte', '-5,00 €'],
        ['', '', '', 'Solde au salon', '40,00 €'],
    ]
    table = Table(data, colWidths=[200, 40, 80, 80, 80])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1A1814')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#C9A84C')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
    ]))
    elements.append(table)

    doc.build(elements)
    buffer.seek(0)

    response = HttpResponse(buffer, content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="Facture_WilloBarber.pdf"'
    return response
