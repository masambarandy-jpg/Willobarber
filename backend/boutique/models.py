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
    stock_alert = models.IntegerField(default=5)
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
        # Suivi par le coiffeur une fois la commande payée (cf. OrderStatusView).
        ('preparing', 'En préparation'),
        ('ready', 'Prête'),
        ('shipped', 'Expédiée'),
        ('delivered', 'Livrée'),
        ('picked_up', 'Retirée'),
        ('completed', 'Complétée'),
        ('cancelled', 'Annulée'),
    ]
    DELIVERY_CHOICES = [
        ('retrait_salon', 'Retrait au salon'),
        ('domicile', 'Livraison à domicile'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orders',
    )
    numero = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    # total = sous-total produits + delivery_fee (montant débité par Stripe).
    total = models.DecimalField(max_digits=8, decimal_places=2)
    delivery_type = models.CharField(max_length=20, choices=DELIVERY_CHOICES, default='retrait_salon')
    delivery_address = models.TextField(blank=True, default='')
    delivery_fee = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    # Un PaymentIntent ne règle qu'une seule commande — d'où unique (les
    # commandes antérieures au paiement en ligne ont '' → NULL, cf. save()).
    payment_intent_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    invoice_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def subtotal(self):
        return self.total - self.delivery_fee

    def save(self, *args, **kwargs):
        if not self.payment_intent_id:
            self.payment_intent_id = None
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
