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
    ai_recommendations = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.username} ({self.role})"


class Barbershop(models.Model):
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    def __str__(self):
        return self.name


class Service(models.Model):
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=6, decimal_places=2)
    duration = models.IntegerField(help_text="Durée en minutes")
    barbershop = models.ForeignKey(Barbershop, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.name} - {self.price}€"


class Reservation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('confirmed', 'Confirmé'),
        ('cancelled', 'Annulé'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    date = models.DateField()
    time = models.TimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    def __str__(self):
        return f"{self.user} - {self.date} {self.time}"