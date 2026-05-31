from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from .validators import validate_image_file


class SoftDeleteMixin(models.Model):
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    def delete(self, *args, **kwargs):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)

    class Meta:
        abstract = True


class User(SoftDeleteMixin, AbstractUser):
    ROLE_CHOICES = [
        ('client', 'Client'),
        ('barber', 'Barbier'),
        ('admin', 'Admin'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='client')
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(unique=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True, validators=[validate_image_file])
    language = models.CharField(max_length=5, default='fr', choices=[('fr','Français'),('nl','Nederlands'),('en','English')])
    dark_mode = models.BooleanField(default=True)
    ai_recommendations = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    late_cancellations = models.IntegerField(default=0)
    loyalty_points = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.username} ({self.role})"


class Barber(SoftDeleteMixin, models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='barber_profile')
    title = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    specialties = models.JSONField(default=list)
    experience_years = models.IntegerField(default=0)
    color = models.CharField(max_length=7, default='#C9A84C')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.get_full_name()} — {self.title}"


class Service(SoftDeleteMixin, models.Model):
    CATEGORY_CHOICES = [
        ('coupe_homme', 'Coupe Homme'),
        ('barbe', 'Barbe'),
        ('package', 'Package'),
        ('coloration', 'Coloration'),
        ('soin', 'Soin'),
        ('enfant', 'Enfant'),
    ]
    STATUS_CHOICES = [
        ('active', 'Actif'),
        ('draft', 'Brouillon'),
        ('inactive', 'Inactif'),
    ]
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    price = models.DecimalField(max_digits=6, decimal_places=2)
    duration = models.IntegerField(help_text="Durée en minutes")
    is_popular = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    image = models.ImageField(upload_to='services/', blank=True, null=True, validators=[validate_image_file])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} — {self.price}€"


class Availability(models.Model):
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='availabilities')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)

    class Meta:
        unique_together = ('barber', 'date', 'start_time')

    def __str__(self):
        return f"{self.barber} — {self.date} {self.start_time}-{self.end_time}"


class Reservation(SoftDeleteMixin, models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('confirmed', 'Confirmé'),
        ('completed', 'Terminé'),
        ('cancelled_client', 'Annulé par client'),
        ('cancelled_barber', 'Annulé par barbier'),
        ('no_show', 'Non présenté'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Non payé'),
        ('deposit_paid', 'Acompte payé'),
        ('fully_paid', 'Entièrement payé'),
        ('refunded', 'Remboursé'),
    ]
    reference = models.CharField(max_length=20, unique=True, blank=True)
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reservations')
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='reservations')
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid')
    deposit_amount = models.DecimalField(max_digits=6, decimal_places=2, default=10.00)
    total_amount = models.DecimalField(max_digits=6, decimal_places=2)
    notes = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cancelled_reservations'
    )
    is_walk_in = models.BooleanField(default=False)
    person_count = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['barber', 'date', 'start_time'], name='res_barber_date_start_idx'),
            models.Index(fields=['client', 'is_deleted'], name='res_client_deleted_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.reference:
            import random
            year = timezone.now().year
            number = random.randint(10000, 99999)
            self.reference = f"WB-{year}-{number}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference} — {self.client} — {self.date}"


class SlotLock(models.Model):
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE)
    date = models.DateField()
    start_time = models.TimeField()
    locked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    locked_until = models.DateTimeField()
    is_forced = models.BooleanField(default=False)

    class Meta:
        unique_together = ('barber', 'date', 'start_time')

    def is_expired(self):
        return timezone.now() > self.locked_until

    def __str__(self):
        return f"Lock {self.barber} {self.date} {self.start_time}"


class ConsentLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, null=True, blank=True)
    consent_version = models.CharField(max_length=20, default='v1.0')
    accepted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    def __str__(self):
        return f"Consent {self.user} — {self.accepted_at}"


class Review(SoftDeleteMixin, models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('published', 'Publié'),
        ('rejected', 'Rejeté'),
    ]
    reservation = models.OneToOneField(Reservation, on_delete=models.CASCADE, related_name='review')
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, related_name='reviews')
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    comment = models.TextField(blank=True)
    reply = models.TextField(blank=True)
    replied_at = models.DateTimeField(null=True, blank=True)
    replied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='review_replies'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='published')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.client} — {self.rating}★ — {self.barber}"


class WaitingList(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'En attente'),
        ('notified', 'Notifié'),
        ('confirmed', 'Confirmé'),
        ('expired', 'Expiré'),
    ]
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    barber = models.ForeignKey(Barber, on_delete=models.CASCADE, null=True, blank=True)
    preferred_date = models.DateField()
    preferred_time = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    notified_at = models.DateTimeField(null=True, blank=True)
    confirmation_deadline = models.DateTimeField(null=True, blank=True)
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attente {self.client} — {self.preferred_date}"


class SalonSettings(models.Model):
    booking_cutoff_hour = models.IntegerField(default=19)
    min_booking_hours_ahead = models.IntegerField(default=3)
    walk_in_slots_per_day = models.IntegerField(default=2)
    same_day_surcharge = models.DecimalField(max_digits=6, decimal_places=2, default=10.00)
    cancellation_free_hours = models.IntegerField(default=24)
    max_late_cancellations = models.IntegerField(default=3)
    waiting_list_confirmation_minutes = models.IntegerField(default=15)
    rush_mode_active = models.BooleanField(default=False)
    bookings_open = models.BooleanField(default=True)
    rush_message_fr = models.TextField(default="Le salon est très chargé en ce moment.")
    rush_message_nl = models.TextField(default="De salon is momenteel erg druk.")
    rush_message_en = models.TextField(default="The salon is very busy right now.")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Paramètres du salon"

    def save(self, *args, **kwargs):
        if not self.pk and SalonSettings.objects.exists():
            raise ValueError("Un seul objet SalonSettings est autorisé.")
        super().save(*args, **kwargs)

    def __str__(self):
        return "Paramètres du salon WilloBarber"
