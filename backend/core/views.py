import logging
import os
import random
from collections import Counter
from datetime import datetime

import anthropic
from weasyprint import HTML as WeasyHTML
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
    user = request.user
    invoice_number = f"WB-2026-{random.randint(10000, 99999)}"
    today = datetime.now().strftime("%d %B %Y")

    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: Georgia, serif; background: #F5F0E8; margin: 0; padding: 40px; color: #1a1a1a; }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }}
  .logo {{ display: flex; align-items: center; gap: 12px; }}
  .logo-icon {{ background: #C9A84C; color: white; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; border-radius: 6px; }}
  .logo-text h2 {{ margin: 0; font-size: 22px; color: #1a1a1a; }}
  .logo-text p {{ margin: 0; font-size: 11px; color: #888; letter-spacing: 2px; }}
  .facture-title {{ text-align: right; }}
  .facture-title h1 {{ font-size: 42px; margin: 0; font-style: italic; }}
  .facture-title p {{ margin: 4px 0; color: #666; font-size: 13px; }}
  hr {{ border: none; border-top: 1px solid #1a1a1a; margin: 20px 0; }}
  .parties {{ display: flex; justify-content: space-between; margin: 30px 0; position: relative; }}
  .emetteur, .facture-a {{ flex: 1; }}
  .parties label {{ font-size: 10px; letter-spacing: 2px; color: #888; text-transform: uppercase; }}
  .parties h3 {{ margin: 8px 0 4px; font-size: 16px; }}
  .parties p {{ margin: 2px 0; font-size: 13px; color: #444; }}
  .paye {{ position: absolute; right: 0; top: 20px; border: 3px solid #2D6A4F; color: #2D6A4F; padding: 8px 16px; font-size: 28px; font-weight: bold; transform: rotate(-15deg); opacity: 0.4; border-radius: 4px; letter-spacing: 4px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
  th {{ background: #1a1a1a; color: #C9A84C; padding: 10px; text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }}
  td {{ padding: 12px 10px; border-bottom: 1px solid #ddd; font-size: 13px; }}
  .recap {{ display: flex; justify-content: flex-end; margin-top: 20px; }}
  .recap-table {{ width: 300px; }}
  .recap-table tr td {{ border: none; padding: 6px 0; font-size: 13px; }}
  .recap-table tr td:last-child {{ text-align: right; }}
  .total-row td {{ font-weight: bold; font-size: 16px; border-top: 2px solid #1a1a1a; padding-top: 10px; }}
  .acompte-row td {{ color: #2D6A4F; }}
  .regle-ce-jour {{ background: #1a1a1a; color: white; padding: 16px 20px; border-radius: 8px; display: flex; justify-content: space-between; margin-top: 16px; }}
  .regle-ce-jour span:last-child {{ color: #C9A84C; font-size: 20px; font-weight: bold; }}
  .note {{ font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }}
</style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <div class="logo-icon">w</div>
      <div class="logo-text">
        <h2>willobarber</h2>
        <p>SALON DE BARBIER · BERCHEM</p>
      </div>
    </div>
    <div class="facture-title">
      <h1>Facture.</h1>
      <p>N° {invoice_number}</p>
      <p>Émise le {today}</p>
    </div>
  </div>
  <hr>
  <div class="parties">
    <div class="emetteur">
      <label>Émetteur</label>
      <h3>WilloBarber SRL</h3>
      <p>78 rue Auguste van Zande</p>
      <p>1082 Bruxelles · Belgique</p>
      <p>contact@willobarber.be</p>
      <p>+32 2 555 04 04</p>
      <p>TVA BE 0789.123.456</p>
    </div>
    <div class="facture-a">
      <label>Facturé à</label>
      <h3>{user.first_name or user.username} {user.last_name or ''}</h3>
      <p>{user.email}</p>
      <div class="paye">PAYÉ</div>
    </div>
  </div>
  <table>
    <tr>
      <th>Description</th>
      <th>Qté</th>
      <th>P.U. HT</th>
      <th>TVA</th>
      <th>Total TTC</th>
    </tr>
    <tr>
      <td>Signature WilloBarber</td>
      <td>1</td>
      <td>37,19 €</td>
      <td>21%</td>
      <td>45,00 €</td>
    </tr>
  </table>
  <div class="recap">
    <table class="recap-table">
      <tr><td>Méthode</td><td>Carte ····4242</td></tr>
      <tr><td>Sous-total HT</td><td>37,19 €</td></tr>
      <tr><td>TVA 21%</td><td>7,81 €</td></tr>
      <tr class="total-row"><td>Total TTC</td><td>45,00 €</td></tr>
      <tr class="acompte-row"><td>Acompte réglé</td><td>-5,00 €</td></tr>
      <tr class="total-row"><td>Solde dû au salon</td><td>40,00 €</td></tr>
    </table>
  </div>
  <div class="regle-ce-jour">
    <span>RÉGLÉ CE JOUR · Acompte de réservation</span>
    <span>5,00 €</span>
  </div>
  <p class="note">Cette facture concerne uniquement l'acompte de 5,00 € encaissé pour sécuriser la réservation. Une facture finale couvrant l'intégralité de la prestation sera émise à l'issue du rendez-vous.</p>
</body>
</html>"""

    pdf_file = WeasyHTML(string=html_content).write_pdf()

    response = HttpResponse(pdf_file, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Facture_WilloBarber_{invoice_number}.pdf"'
    return response
