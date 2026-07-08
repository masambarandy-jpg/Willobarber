import random
from django.db import models
from django.conf import settings


def generate_order_number():
    return f"WB-CMD-2026-{random.randint(10000, 99999)}"


class Product(models.Model):
    nom = models.CharField(max_length=255)
    categorie = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    prix = models.DecimalField(max_digits=8, decimal_places=2)
    contenance = models.CharField(max_length=50, blank=True)
    photo_url = models.URLField(blank=True)
    stock = models.IntegerField(default=0)
    actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nom']

    def __str__(self):
        return f"{self.nom} — {self.prix}€"


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('confirmed', 'Confirmée'),
        ('ready', 'Prête'),
        ('completed', 'Complétée'),
        ('cancelled', 'Annulée'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orders',
    )
    numero = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total = models.DecimalField(max_digits=8, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.numero:
            numero = generate_order_number()
            while Order.objects.filter(numero=numero).exists():
                numero = generate_order_number()
            self.numero = numero
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} — {self.user}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantite = models.IntegerField(default=1)
    prix_unitaire = models.DecimalField(max_digits=8, decimal_places=2)

    def __str__(self):
        return f"{self.product.nom} x{self.quantite}"
