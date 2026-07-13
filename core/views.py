import logging
import os

import anthropic
from rest_framework import viewsets, status, generics
from rest_framework.decorators import api_view, permission_classes, throttle_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone
from datetime import timedelta, datetime
from decimal import Decimal

logger = logging.getLogger(__name__)

from .models import (
    User, Barber, Service, Availability, Reservation,
    Review, WaitingList, SalonSettings, SlotLock, ConsentLog
)
from .serializers import (
    RegisterSerializer, UserSerializer, UserUpdateSerializer, ChangePasswordSerializer,
    BarberSerializer, BarberWriteSerializer, ServiceSerializer,
    AvailabilitySerializer,
    ReservationSerializer, ReservationCreateSerializer,
    ReviewSerializer, WaitingListSerializer, SalonSettingsSerializer,
    ConsentLogSerializer,
)
from .permissions import IsOwnerOrAdmin, IsBarberOrAdmin


# ══════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════
class LoginRateThrottle(AnonRateThrottle):
    rate = '5/minute'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    username = request.data.get('username') or request.data.get('email')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Email et mot de passe requis.'}, status=400)

    # Accepter email ou username
    try:
        user_obj = User.objects.get(email=username)
        username = user_obj.username
    except (User.DoesNotExist, User.MultipleObjectsReturned):
        pass

    user = authenticate(username=username, password=password)
    if not user:
        return Response({'error': 'Identifiants invalides.'}, status=401)

    if user.is_deleted:
        return Response({'error': 'Compte désactivé.'}, status=401)

    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        }, status=201)
    return Response(serializer.errors, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.data.get('refresh')
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'message': 'Déconnexion réussie.'})
    except Exception:
        return Response({'error': 'Token invalide.'}, status=400)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me_view(request):
    if request.method == 'GET':
        return Response(UserSerializer(request.user).data)
    serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(UserSerializer(request.user).data)
    return Response(serializer.errors, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'message': 'Mot de passe modifié avec succès.'})
    return Response(serializer.errors, status=400)


# ══════════════════════════════════════════
# DASHBOARD STATS
# ══════════════════════════════════════════
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def dashboard_stats(request):
    from django.db.models import Sum, Avg

    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0)

    total_clients = User.objects.filter(role='client', is_deleted=False).count()
    total_services = Service.objects.filter(is_deleted=False, status='active').count()
    total_reservations = Reservation.objects.filter(is_deleted=False).count()

    monthly_revenue = Reservation.objects.filter(
        is_deleted=False,
        created_at__gte=month_start,
        payment_status__in=['deposit_paid', 'fully_paid']
    ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0')

    avg_rating = Review.objects.filter(
        is_deleted=False, status='published'
    ).aggregate(avg=Avg('rating'))['avg'] or 0

    upcoming_today = Reservation.objects.filter(
        is_deleted=False,
        date=now.date(),
        status='confirmed'
    ).count()

    return Response({
        'total_clients': total_clients,
        'total_services': total_services,
        'total_reservations': total_reservations,
        'monthly_revenue': monthly_revenue,
        'avg_rating': round(avg_rating, 1),
        'upcoming_today': upcoming_today,
    })


# ══════════════════════════════════════════
# BARBERS
# ══════════════════════════════════════════
class BarberViewSet(viewsets.ModelViewSet):
    serializer_class = BarberSerializer

    def get_queryset(self):
        qs = Barber.objects.filter(is_deleted=False)
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BarberWriteSerializer
        return BarberSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def perform_destroy(self, instance):
        instance.delete()  # soft delete


# ══════════════════════════════════════════
# SERVICES
# ══════════════════════════════════════════
class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        qs = Service.objects.filter(is_deleted=False)
        if not self.request.user.is_staff:
            qs = qs.filter(status='active')
        return qs

    def perform_destroy(self, instance):
        instance.delete()  # soft delete


# ══════════════════════════════════════════
# AVAILABILITY
# ══════════════════════════════════════════
class AvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilitySerializer

    def get_queryset(self):
        qs = Availability.objects.all()
        barber_id = self.request.query_params.get('barber_id')
        if barber_id:
            qs = qs.filter(barber_id=barber_id)
        return qs

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsBarberOrAdmin()]

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_staff:
            try:
                barber = user.barber_profile
            except Barber.DoesNotExist:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Vous n'avez pas de profil barbier.")
            serializer.save(barber=barber)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if not user.is_staff and instance.barber.user != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Vous ne pouvez supprimer que vos propres créneaux.")
        instance.delete()


# ══════════════════════════════════════════
# SLOT LOCK
# ══════════════════════════════════════════
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_slots(request):
    barber_id = request.query_params.get('barber_id')
    date_str = request.query_params.get('date')

    if not barber_id or not date_str:
        return Response({'error': 'barber_id et date requis.'}, status=400)

    try:
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return Response({'error': 'Format de date invalide (YYYY-MM-DD).'}, status=400)

    settings_obj = SalonSettings.objects.first()
    if settings_obj and date == timezone.now().date():
        cutoff = timezone.now().replace(
            hour=settings_obj.booking_cutoff_hour, minute=0, second=0
        )
        if timezone.now() >= cutoff:
            return Response({'error': 'Les réservations en ligne sont fermées pour aujourd\'hui.', 'slots': []})

    slots = Availability.objects.filter(
        barber_id=barber_id, date=date, is_available=True
    )

    reserved_times = Reservation.objects.filter(
        barber_id=barber_id, date=date,
        is_deleted=False,
        status__in=['pending', 'confirmed']
    ).values_list('start_time', flat=True)

    locked_times = SlotLock.objects.filter(
        barber_id=barber_id, date=date,
        locked_until__gt=timezone.now()
    ).exclude(locked_by=request.user).values_list('start_time', flat=True)

    available = []
    for slot in slots:
        if slot.start_time not in reserved_times and slot.start_time not in locked_times:
            available.append({
                'start_time': slot.start_time,
                'end_time': slot.end_time,
                'is_available': True
            })
        else:
            available.append({
                'start_time': slot.start_time,
                'end_time': slot.end_time,
                'is_available': False
            })

    return Response({'slots': available, 'date': date_str})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lock_slot(request):
    barber_id = request.data.get('barber_id')
    date_str = request.data.get('date')
    start_time_str = request.data.get('start_time')

    try:
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        start_time = datetime.strptime(start_time_str, '%H:%M').time()
    except (ValueError, TypeError):
        return Response({'error': 'Données invalides.'}, status=400)

    existing_lock = SlotLock.objects.filter(
        barber_id=barber_id, date=date, start_time=start_time,
        locked_until__gt=timezone.now()
    ).exclude(locked_by=request.user).first()

    if existing_lock:
        remaining = int((existing_lock.locked_until - timezone.now()).total_seconds())
        return Response({
            'error': 'Créneau verrouillé par un autre client.',
            'remaining_seconds': remaining
        }, status=409)

    lock, _ = SlotLock.objects.update_or_create(
        barber_id=barber_id, date=date, start_time=start_time,
        defaults={
            'locked_by': request.user,
            'locked_until': timezone.now() + timedelta(minutes=3)
        }
    )

    return Response({
        'message': 'Créneau verrouillé pour 3 minutes.',
        'locked_until': lock.locked_until
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unlock_slot(request):
    barber_id = request.data.get('barber_id')
    date_str = request.data.get('date')
    start_time_str = request.data.get('start_time')

    try:
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        start_time = datetime.strptime(start_time_str, '%H:%M').time()
    except (ValueError, TypeError):
        return Response({'error': 'Données invalides.'}, status=400)

    SlotLock.objects.filter(
        barber_id=barber_id, date=date,
        start_time=start_time, locked_by=request.user
    ).delete()

    return Response({'message': 'Verrou libéré.'})


# ══════════════════════════════════════════
# RESERVATIONS
# ══════════════════════════════════════════
class ReservationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return ReservationCreateSerializer
        return ReservationSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Reservation.objects.filter(is_deleted=False)
        if not user.is_staff:
            qs = qs.filter(client=user)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by('-date', '-start_time')

    def perform_create(self, serializer):
        service = serializer.validated_data['service']
        settings_obj = SalonSettings.objects.first()
        surcharge = Decimal('0')

        if settings_obj and serializer.validated_data['date'] == timezone.now().date():
            surcharge = settings_obj.same_day_surcharge

        serializer.save(
            client=self.request.user,
            total_amount=service.price + surcharge,
            deposit_amount=settings_obj.same_day_surcharge if settings_obj else Decimal('10')
        )

        SlotLock.objects.filter(
            barber=serializer.validated_data['barber'],
            date=serializer.validated_data['date'],
            start_time=serializer.validated_data['start_time'],
            locked_by=self.request.user
        ).delete()

    def perform_destroy(self, instance):
        instance.delete()  # soft delete


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_reservation(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk, client=request.user, is_deleted=False)
    except Reservation.DoesNotExist:
        return Response({'error': 'Réservation introuvable.'}, status=404)

    if reservation.status in ['completed', 'cancelled_client', 'cancelled_barber']:
        return Response({'error': 'Cette réservation ne peut pas être annulée.'}, status=400)

    settings_obj = SalonSettings.objects.first()
    free_hours = settings_obj.cancellation_free_hours if settings_obj else 24

    reservation_dt = timezone.make_aware(
        datetime.combine(reservation.date, reservation.start_time)
    )
    is_late = timezone.now() > reservation_dt - timedelta(hours=free_hours)

    reservation.status = 'cancelled_client'
    reservation.cancellation_reason = request.data.get('reason', '')
    reservation.cancelled_by = request.user
    reservation.save()

    if is_late:
        request.user.late_cancellations += 1
        request.user.save()

    return Response({
        'message': 'Réservation annulée.',
        'late_cancellation': is_late,
        'late_cancellations_count': request.user.late_cancellations
    })


@api_view(['POST'])
@permission_classes([IsAdminUser])
def cancel_reservation_by_barber(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk, is_deleted=False)
    except Reservation.DoesNotExist:
        return Response({'error': 'Réservation introuvable.'}, status=404)

    reservation.status = 'cancelled_barber'
    reservation.cancellation_reason = request.data.get('reason', 'Annulation à la demande')
    reservation.cancelled_by = request.user
    reservation.save()

    return Response({'message': 'Réservation annulée sans pénalité pour le client.'})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def add_walk_in(request):
    serializer = ReservationCreateSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        service = serializer.validated_data['service']
        reservation = serializer.save(
            client=request.user,
            is_walk_in=True,
            status='confirmed',
            total_amount=service.price,
            deposit_amount=Decimal('0')
        )
        return Response(ReservationSerializer(reservation).data, status=201)
    return Response(serializer.errors, status=400)


# ══════════════════════════════════════════
# REVIEWS
# ══════════════════════════════════════════
class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.action in ['destroy', 'approve', 'reject', 'reply']:
            return Review.objects.filter(is_deleted=False)
        return Review.objects.filter(is_deleted=False, status='published')

    def perform_create(self, serializer):
        reservation = serializer.validated_data['reservation']
        serializer.save(
            client=self.request.user,
            barber=reservation.barber
        )

    def perform_destroy(self, instance):
        if not self.request.user.is_staff and instance.client != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Vous ne pouvez supprimer que vos propres avis.")
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def reply(self, request, pk=None):
        try:
            review = Review.objects.get(pk=pk, is_deleted=False)
        except Review.DoesNotExist:
            return Response({'error': 'Avis introuvable.'}, status=404)

        review.reply = request.data.get('reply', '')
        review.replied_at = timezone.now()
        review.replied_by = request.user
        review.save()
        return Response(ReviewSerializer(review).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        try:
            review = Review.objects.get(pk=pk, is_deleted=False)
        except Review.DoesNotExist:
            return Response({'error': 'Avis introuvable.'}, status=404)
        review.status = 'published'
        review.save()
        return Response(ReviewSerializer(review).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def reject(self, request, pk=None):
        try:
            review = Review.objects.get(pk=pk, is_deleted=False)
        except Review.DoesNotExist:
            return Response({'error': 'Avis introuvable.'}, status=404)
        review.status = 'rejected'
        review.save()
        return Response(ReviewSerializer(review).data)


# ══════════════════════════════════════════
# AI RECOMMENDATIONS
# ══════════════════════════════════════════
ANTHROPIC_MODEL = 'claude-sonnet-5'

LOYALTY_TIERS = (
    (500, 'OR'),
    (200, 'ARGENT'),
    (0, 'BRONZE'),
)


def _loyalty_tier(points):
    for threshold, label in LOYALTY_TIERS:
        if points >= threshold:
            return label
    return 'BRONZE'


def _generate_ai_recommendation_text(user, fav_service, fav_service_count, fav_barber, last_reservation, avg_interval):
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        logger.warning('ANTHROPIC_API_KEY manquant — recommandation IA non générée.')
        return None

    prompt = (
        "Tu es l'assistant IA de WilloBarber, un salon de coiffure premium à Bruxelles.\n"
        "Basé sur cet historique client :\n"
        f"- {fav_service.name} ({fav_service.price}€) avec {fav_barber.user.get_full_name() or fav_barber.user.username} "
        f"— {fav_service_count} fois\n"
        f"- Dernière visite : {last_reservation.date.strftime('%d %b').upper()}\n"
        f"- Intervalle moyen : {round(avg_interval)} jours\n"
        f"- Points fidélité : {user.loyalty_points} pts (niveau {_loyalty_tier(user.loyalty_points)})\n\n"
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
    except anthropic.APIError:
        logger.exception('Échec de l\'appel Anthropic pour la recommandation IA.')
        return None

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

    reservations = Reservation.objects.filter(
        client=user,
        is_deleted=False,
        status='completed'
    ).order_by('-date')

    if reservations.count() < 2:
        return Response({
            'recommendations': [],
            'ai_text': None,
            'message': 'Pas assez d\'historique pour générer des recommandations.'
        })

    dates = list(reservations.values_list('date', flat=True))
    intervals = [(dates[i] - dates[i+1]).days for i in range(len(dates)-1)]
    avg_interval = sum(intervals) / len(intervals)

    from django.db.models import Count
    fav_service = reservations.values('service').annotate(
        count=Count('service')
    ).order_by('-count').first()

    fav_barber = reservations.values('barber').annotate(
        count=Count('barber')
    ).order_by('-count').first()

    last_reservation = reservations.first()
    predicted_date = last_reservation.date + timedelta(days=int(avg_interval))

    suggested_slots = Availability.objects.filter(
        barber_id=fav_barber['barber'] if fav_barber else None,
        date__gte=predicted_date,
        is_available=True
    ).exclude(
        barber__reservations__date=predicted_date,
        barber__reservations__is_deleted=False,
        barber__reservations__status__in=['pending', 'confirmed']
    ).order_by('date', 'start_time')[:3]

    ai_text = None
    if fav_service and fav_barber:
        ai_text = _generate_ai_recommendation_text(
            user,
            Service.objects.get(pk=fav_service['service']),
            fav_service['count'],
            Barber.objects.get(pk=fav_barber['barber']),
            last_reservation,
            avg_interval,
        )

    result = {
        'avg_interval_days': round(avg_interval),
        'predicted_next_date': predicted_date,
        'preferred_service_id': fav_service['service'] if fav_service else None,
        'preferred_barber_id': fav_barber['barber'] if fav_barber else None,
        'suggested_slots': [
            {
                'date': s.date,
                'start_time': s.start_time,
                'end_time': s.end_time,
                'barber_id': s.barber_id
            } for s in suggested_slots
        ]
    }

    return Response({'recommendations': result, 'ai_text': ai_text})


# ══════════════════════════════════════════
# WAITING LIST
# ══════════════════════════════════════════
class WaitingListViewSet(viewsets.ModelViewSet):
    serializer_class = WaitingListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return WaitingList.objects.all()
        return WaitingList.objects.filter(client=self.request.user)

    def perform_create(self, serializer):
        position = WaitingList.objects.filter(
            service=serializer.validated_data['service'],
            preferred_date=serializer.validated_data['preferred_date'],
            status='waiting'
        ).count() + 1
        serializer.save(client=self.request.user, position=position)


# ══════════════════════════════════════════
# CONSENT LOG (RGPD)
# ══════════════════════════════════════════
class ConsentLogViewSet(viewsets.ModelViewSet):
    serializer_class = ConsentLogSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        if self.request.user.is_staff:
            return ConsentLog.objects.all().order_by('-accepted_at')
        return ConsentLog.objects.filter(user=self.request.user).order_by('-accepted_at')

    def get_permissions(self):
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        ip = (
            self.request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            or self.request.META.get('REMOTE_ADDR')
        )
        serializer.save(
            user=self.request.user,
            ip_address=ip or None,
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
        )


# ══════════════════════════════════════════
# SALON SETTINGS
# ══════════════════════════════════════════
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def salon_settings_view(request):
    settings_obj, _ = SalonSettings.objects.get_or_create(pk=1)

    if request.method == 'GET':
        if not request.user.is_staff:
            return Response({
                'bookings_open': settings_obj.bookings_open,
                'rush_mode_active': settings_obj.rush_mode_active,
                'booking_cutoff_hour': settings_obj.booking_cutoff_hour,
                'min_booking_hours_ahead': settings_obj.min_booking_hours_ahead,
                'same_day_surcharge': settings_obj.same_day_surcharge,
            })
        return Response(SalonSettingsSerializer(settings_obj).data)

    if not request.user.is_staff:
        return Response({'error': 'Non autorisé.'}, status=403)

    serializer = SalonSettingsSerializer(settings_obj, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)
