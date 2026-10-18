from django.utils import timezone
from rest_framework import serializers
from .loyalty import reservation_points
from .models import User, Barbershop, Barber, Service, Reservation, ClientMedia, ClosedPeriod, OpeningHours, Review, WaitlistEntry, BarberLeave, Notification, NotificationPreference, PaymentCard


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'profile_picture', 'ai_recommendations', 'loyalty_points']
        read_only_fields = ['loyalty_points']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'username', 'email', 'password', 'password2', 'phone']

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password2': 'Les mots de passe ne correspondent pas.'})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class BarbershopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barbershop
        fields = '__all__'


class BarberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barber
        fields = ['id', 'name', 'role', 'status', 'email', 'phone', 'specialties']


class ServiceSerializer(serializers.ModelSerializer):
    barbershop_name = serializers.CharField(source='barbershop.name', read_only=True)

    class Meta:
        model = Service
        fields = ['id', 'name', 'category', 'price', 'duration', 'barbershop', 'barbershop_name']


class ReservationSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    client_display_name = serializers.SerializerMethodField()
    service_name = serializers.CharField(source='service.name', read_only=True)
    service_price = serializers.DecimalField(source='service.price', max_digits=6, decimal_places=2, read_only=True)
    service_category = serializers.CharField(source='service.category', read_only=True)
    qr_code = serializers.CharField(read_only=True)
    # Points gagnés avec ce RDV (historique fidélité de l'app).
    loyalty_points = serializers.SerializerMethodField()

    def get_client_display_name(self, obj):
        return 'Client supprimé' if obj.user.is_deleted else obj.user.username

    def get_loyalty_points(self, obj):
        return reservation_points(obj)

    class Meta:
        model = Reservation
        fields = [
            'id',
            'user',
            'user_username',
            'client_display_name',
            'service',
            'service_name',
            'service_price',
            'service_category',
            'loyalty_points',
            'date',
            'time',
            'status',
            'payment_intent_id',
            'payment_status',
            'payment_method',
            'amount_paid',
            'child_count',
            'barber',
            'qr_code',
            'checked_in',
            'checked_in_at',
            'hidden_by_client',
        ]
        # hidden_by_client ne se modifie que via PATCH /reservations/<id>/hide/
        # (propriétaire + RDV passé, cf. views.hide_reservation).
        read_only_fields = ['qr_code', 'checked_in', 'checked_in_at', 'hidden_by_client']


class ClosedPeriodSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = ClosedPeriod
        fields = ['id', 'start_date', 'end_date', 'reason', 'created_by', 'created_by_username', 'created_at']
        read_only_fields = ['created_by']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'La date de fin doit être après la date de début.'})
        return attrs


class OpeningHoursSerializer(serializers.ModelSerializer):
    open_time = serializers.TimeField(format='%H:%M')
    close_time = serializers.TimeField(format='%H:%M')

    class Meta:
        model = OpeningHours
        fields = ['weekday', 'is_closed', 'open_time', 'close_time']

    def validate(self, attrs):
        if attrs.get('is_closed'):
            return attrs
        open_time = attrs.get('open_time', getattr(self.instance, 'open_time', None))
        close_time = attrs.get('close_time', getattr(self.instance, 'close_time', None))
        # 00:00 en fermeture = minuit, donc toujours après l'ouverture.
        if open_time and close_time and close_time.hour + close_time.minute and close_time <= open_time:
            raise serializers.ValidationError({'close_time': "L'heure de fermeture doit être après l'heure d'ouverture."})
        return attrs


class BarberLeaveSerializer(serializers.ModelSerializer):
    class Meta:
        model = BarberLeave
        fields = ['id', 'barber', 'start_date', 'end_date', 'reason', 'created_at']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'La date de fin doit être après la date de début.'})
        return attrs


class ReviewSerializer(serializers.ModelSerializer):
    """Commentaire client sur un RDV passé (note facultative) + réponse du barbier."""
    client_name = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()
    reservation_date = serializers.SerializerMethodField()
    barber_name = serializers.CharField(source='reservation.barber', read_only=True)
    reply = serializers.CharField(read_only=True, allow_null=True)
    replied_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = Review
        fields = [
            'id', 'rating', 'comment', 'created_at', 'updated_at', 'client_name', 'service_name',
            'reservation_date', 'reservation', 'barber_name', 'reply', 'replied_at',
        ]

    def get_client_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username

    def get_service_name(self, obj):
        return obj.reservation.service.name if obj.reservation and obj.reservation.service else ""

    def get_reservation_date(self, obj):
        return obj.reservation.date if obj.reservation else None


class WaitlistEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = WaitlistEntry
        fields = ['id', 'barber', 'date', 'time', 'service_name', 'created_at', 'notified_at']
        read_only_fields = ['created_at', 'notified_at']


class NotificationSerializer(serializers.ModelSerializer):
    # time/section/unread sont dérivés de created_at/is_read pour coller au
    # format attendu par CoiffeurNotificationsContext côté mobile, sans
    # dupliquer ces informations en base.
    time = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()
    unread = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'type', 'title', 'desc', 'data', 'time', 'section', 'unread', 'is_read', 'created_at']
        read_only_fields = ['type', 'title', 'desc', 'data', 'created_at']

    def get_time(self, obj):
        return timezone.localtime(obj.created_at).strftime('%H:%M')

    def get_section(self, obj):
        today = timezone.localtime(timezone.now()).date()
        return "AUJOURD'HUI" if timezone.localtime(obj.created_at).date() == today else 'HIER'

    def get_unread(self, obj):
        return not obj.is_read


class ClientMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientMedia
        fields = [
            'id',
            'client',
            'reservation',
            'media_type',
            'cloudinary_url',
            'cloudinary_public_id',
            'caption',
            'shared_with_client',
            'created_at',
        ]
        read_only_fields = ['cloudinary_url', 'cloudinary_public_id', 'shared_with_client']


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            'new_rdv_email', 'new_rdv_sms', 'new_rdv_push',
            'cancellation_email', 'cancellation_sms', 'cancellation_push',
            'new_review_email', 'new_review_sms', 'new_review_push',
            'daily_reminder_email', 'daily_reminder_sms', 'daily_reminder_push',
            'weekly_report_email', 'weekly_report_sms', 'weekly_report_push',
        ]


class PaymentCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentCard
        fields = ['id', 'brand', 'last4', 'exp_month', 'exp_year', 'is_primary', 'created_at']
        read_only_fields = ['id', 'is_primary', 'created_at']