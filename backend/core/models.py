import uuid

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class User(AbstractUser):
    ROLE_CHOICES = [
        ('client', 'Client'),
        ('admin', 'Admin'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='client')
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_picture = models.URLField(max_length=500, blank=True, default='')
    ai_recommendations = models.BooleanField(default=True)
    is_at_risk = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    two_factor_enabled = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.role})"


class Barbershop(models.Model):
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    commission_rate = models.DecimalField(max_digits=4, decimal_places=1, default=4.0)

    def __str__(self):
        return self.name


class Service(models.Model):
    CATEGORY_CHOICES = [
        ('coupe_homme', 'Coupe Homme'),
        ('barbe', 'Barbe'),
        ('package', 'Package'),
        ('coloration', 'Coloration'),
        ('soin', 'Soin'),
        ('enfant', 'Enfant'),
    ]

    name = models.CharField(max_length=100)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='coupe_homme')
    price = models.DecimalField(max_digits=6, decimal_places=2)
    duration = models.IntegerField(help_text="Durée en minutes")
    barbershop = models.ForeignKey(Barbershop, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.name} - {self.price}€"


class Barber(models.Model):
    STATUS_CHOICES = [
        ('Actif', 'Actif'),
        ('Absent', 'Absent'),
    ]

    name = models.CharField(max_length=100)
    role = models.CharField(max_length=100, blank=True, default='Barbier')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Actif')
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=30, blank=True, default='')
    specialties = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.name} ({self.role})"


class Reservation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('confirmed', 'Confirmé'),
        ('cancelled', 'Annulé'),
        ('cancelled_client', 'Annulé par le client'),
        ('no_show', 'No-show'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Non payé'),
        ('paid_onsite', 'Payé au salon'),
        ('paid_online', 'Payé en ligne'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Espèces'),
        ('card', 'Carte'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    date = models.DateField()
    time = models.TimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_intent_id = models.CharField(max_length=255, blank=True, default='')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, blank=True, default='')
    amount_paid = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    qr_code = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    checked_in = models.BooleanField(default=False)
    checked_in_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Un seul créneau actif (pending/confirmed) par date+heure — le salon
        # n'a pas de champ barbier sur Reservation, tout le monde partage le
        # même agenda côté backend (cf. fallback "Willo" dans planning.tsx).
        # cancelled/no_show ne comptent pas : le créneau redevient réservable.
        constraints = [
            models.UniqueConstraint(
                fields=['date', 'time'],
                condition=models.Q(status__in=['pending', 'confirmed']),
                name='unique_active_reservation_slot',
            ),
        ]

    def __str__(self):
        return f"{self.user} - {self.date} {self.time}"


class WaitingList(models.Model):
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='waiting_list')
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    preferred_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    notified = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.client} - {self.service} ({self.preferred_date})"


class BarberLeave(models.Model):
    # Les barbiers ne sont pas des User Django (aucun rôle 'barber' n'existe sur
    # User — cf. ROLE_CHOICES ci-dessus) : partout ailleurs dans l'app (planning
    # coiffeur, réservations), le barbier est ce type statique à 3 valeurs.
    BARBER_CHOICES = [
        ('Willo', 'Willo'),
        ('Malik', 'Malik'),
        ('Idris', 'Idris'),
    ]

    barber = models.CharField(max_length=20, choices=BARBER_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.CharField(max_length=200, blank=True, default='Congé')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_date']

    def __str__(self):
        return f"{self.barber} — {self.reason} ({self.start_date} → {self.end_date})"


class ClosedPeriod(models.Model):
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.CharField(max_length=255)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_date']

    def __str__(self):
        return f"{self.reason} ({self.start_date} → {self.end_date})"


class ClientMedia(models.Model):
    MEDIA_TYPE_CHOICES = [
        ('photo', 'Photo'),
        ('video', 'Vidéo'),
    ]

    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='media_items')
    reservation = models.ForeignKey(Reservation, on_delete=models.SET_NULL, null=True, blank=True, related_name='media_items')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    cloudinary_url = models.URLField(max_length=500)
    cloudinary_public_id = models.CharField(max_length=255)
    caption = models.CharField(max_length=255, blank=True, default='')
    shared_with_client = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.media_type} - {self.client} ({self.created_at:%Y-%m-%d})"


class Notification(models.Model):
    TYPE_CHOICES = [
        ('rdv', 'Rendez-vous'),
        ('avis', 'Avis'),
        ('paiement', 'Paiement'),
        ('annulation', 'Annulation'),
        ('rappel', 'Rappel'),
    ]

    # Pas de FK vers User : ces notifications sont destinées au coiffeur/gérant
    # uniquement (dashboard IsStaffRole), pas à un client en particulier.
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    desc = models.CharField(max_length=500)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.type} — {self.title}"


class Review(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    reservation = models.OneToOneField(Reservation, on_delete=models.CASCADE, related_name='review')
    rating = models.IntegerField()
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reply = models.TextField(blank=True, null=True)
    replied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.rating}★"


class NotificationPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notification_preferences')

    new_rdv_email = models.BooleanField(default=True)
    new_rdv_sms = models.BooleanField(default=True)
    new_rdv_push = models.BooleanField(default=True)

    cancellation_email = models.BooleanField(default=True)
    cancellation_sms = models.BooleanField(default=True)
    cancellation_push = models.BooleanField(default=False)

    new_review_email = models.BooleanField(default=True)
    new_review_sms = models.BooleanField(default=False)
    new_review_push = models.BooleanField(default=True)

    daily_reminder_email = models.BooleanField(default=False)
    daily_reminder_sms = models.BooleanField(default=True)
    daily_reminder_push = models.BooleanField(default=True)

    weekly_report_email = models.BooleanField(default=True)
    weekly_report_sms = models.BooleanField(default=False)
    weekly_report_push = models.BooleanField(default=False)

    def __str__(self):
        return f"Préférences notifications — {self.user}"


class PaymentCard(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_cards')
    brand = models.CharField(max_length=20)
    last4 = models.CharField(max_length=4)
    exp_month = models.IntegerField()
    exp_year = models.IntegerField()
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_primary', '-created_at']

    def __str__(self):
        return f"{self.brand} •••• {self.last4} ({self.owner})"


class UserSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sessions')
    device = models.CharField(max_length=255, blank=True, default='')
    access_token = models.TextField()
    refresh_token = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} — {self.device or 'Appareil inconnu'}"