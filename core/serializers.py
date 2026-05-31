from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Barber, Service, Availability, Reservation, Review, WaitingList, SalonSettings, ConsentLog


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'first_name', 'last_name', 'phone', 'password', 'password2')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Les mots de passe ne correspondent pas."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone',
                  'role', 'language', 'dark_mode', 'ai_recommendations',
                  'loyalty_points', 'late_cancellations', 'created_at')
        read_only_fields = ('id', 'role', 'loyalty_points', 'late_cancellations', 'created_at')


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'phone', 'language', 'dark_mode', 'ai_recommendations')


class BarberSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avg_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Barber
        fields = ('id', 'user', 'full_name', 'title', 'bio', 'specialties',
                  'experience_years', 'color', 'is_active', 'avg_rating', 'review_count')

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_avg_rating(self, obj):
        reviews = obj.reviews.filter(is_deleted=False)
        if reviews.exists():
            return round(sum(r.rating for r in reviews) / reviews.count(), 1)
        return None

    def get_review_count(self, obj):
        return obj.reviews.filter(is_deleted=False).count()


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ('id', 'name', 'description', 'category', 'price',
                  'duration', 'is_popular', 'status', 'image')
        read_only_fields = ('id',)

    def validate(self, attrs):
        if attrs.get('price', 0) < 0:
            raise serializers.ValidationError({"price": "Le prix ne peut pas être négatif."})
        return attrs


class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Availability
        fields = ('id', 'barber', 'date', 'start_time', 'end_time', 'is_available')


class ReservationSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    barber_name = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = ('id', 'reference', 'client', 'client_name', 'barber', 'barber_name',
                  'service', 'service_name', 'date', 'start_time', 'end_time',
                  'status', 'payment_status', 'deposit_amount', 'total_amount',
                  'notes', 'cancellation_reason', 'is_walk_in', 'person_count', 'created_at')
        read_only_fields = ('id', 'reference', 'client', 'created_at')

    def get_client_name(self, obj):
        return obj.client.get_full_name()

    def get_barber_name(self, obj):
        return obj.barber.user.get_full_name()

    def get_service_name(self, obj):
        return obj.service.name


class ReservationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reservation
        fields = ('barber', 'service', 'date', 'start_time', 'end_time',
                  'notes', 'person_count')

    def validate(self, attrs):
        from django.utils import timezone
        from datetime import datetime, timedelta
        from .models import SalonSettings, SlotLock

        settings_obj = SalonSettings.objects.first()

        if settings_obj and not settings_obj.bookings_open:
            raise serializers.ValidationError("Les réservations sont fermées.")

        if settings_obj and settings_obj.rush_mode_active:
            raise serializers.ValidationError("Mode rush actif — réservations suspendues.")

        if settings_obj:
            min_hours = settings_obj.min_booking_hours_ahead
            reservation_datetime = datetime.combine(attrs['date'], attrs['start_time'])
            reservation_datetime = timezone.make_aware(reservation_datetime)
            if reservation_datetime < timezone.now() + timedelta(hours=min_hours):
                raise serializers.ValidationError(
                    f"La réservation doit être faite au moins {min_hours}h à l'avance."
                )

        existing = Reservation.objects.filter(
            barber=attrs['barber'],
            date=attrs['date'],
            start_time=attrs['start_time'],
            is_deleted=False,
            status__in=['pending', 'confirmed']
        ).exists()
        if existing:
            raise serializers.ValidationError("Ce créneau est déjà réservé.")

        active_lock = SlotLock.objects.filter(
            barber=attrs['barber'],
            date=attrs['date'],
            start_time=attrs['start_time'],
            locked_until__gt=timezone.now()
        ).exclude(locked_by=self.context['request'].user).exists()
        if active_lock:
            raise serializers.ValidationError("Ce créneau est en cours de réservation par un autre client.")

        return attrs


class ReviewSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    barber_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ('id', 'reservation', 'client', 'client_name', 'barber', 'barber_name',
                  'rating', 'comment', 'reply', 'replied_at', 'status', 'created_at')
        read_only_fields = ('id', 'client', 'reply', 'replied_at', 'status', 'created_at')

    def get_client_name(self, obj):
        return obj.client.get_full_name()

    def get_barber_name(self, obj):
        return obj.barber.user.get_full_name()


class WaitingListSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaitingList
        fields = ('id', 'client', 'service', 'barber', 'preferred_date',
                  'preferred_time', 'status', 'position', 'created_at')
        read_only_fields = ('id', 'client', 'status', 'position', 'created_at')


class SalonSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalonSettings
        fields = '__all__'


class DashboardStatsSerializer(serializers.Serializer):
    total_clients = serializers.IntegerField()
    total_services = serializers.IntegerField()
    total_reservations = serializers.IntegerField()
    monthly_revenue = serializers.DecimalField(max_digits=10, decimal_places=2)
    avg_rating = serializers.FloatField()
    upcoming_today = serializers.IntegerField()
