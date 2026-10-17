from decimal import Decimal

from .models import Order, Product

# Même montant que l'option « Livraison à domicile » du panier (cart.tsx).
DELIVERY_FEE = Decimal('4.95')


class OrderPricingError(ValueError):
    pass


def price_order(items_data, delivery_type, delivery_address):
    """Total d'une commande boutique calculé depuis les prix en base — seule
    source de vérité, partagée par create-payment-intent (montant débité) et la
    création de la commande (montant vérifié). Lève OrderPricingError."""
    if not items_data:
        raise OrderPricingError('La commande doit contenir au moins un article.')
    if delivery_type not in dict(Order.DELIVERY_CHOICES):
        raise OrderPricingError('Mode de livraison invalide.')
    if delivery_type == 'domicile' and not delivery_address:
        raise OrderPricingError("L'adresse de livraison est obligatoire.")

    subtotal = Decimal('0.00')
    validated_items = []
    for item in items_data:
        product_id = item.get('product_id')
        quantite = item.get('quantite', 1)
        if not isinstance(quantite, int) or isinstance(quantite, bool) or quantite < 1:
            raise OrderPricingError('Quantité invalide.')
        try:
            product = Product.objects.get(pk=product_id, actif=True)
        except Product.DoesNotExist:
            raise OrderPricingError(f'Produit {product_id} introuvable.')
        if quantite > product.stock:
            raise OrderPricingError(f'Stock insuffisant pour {product.nom} (disponible : {product.stock}).')
        subtotal += product.prix * Decimal(str(quantite))
        validated_items.append({'product': product, 'quantite': quantite, 'prix_unitaire': product.prix})

    delivery_fee = DELIVERY_FEE if delivery_type == 'domicile' else Decimal('0.00')
    return validated_items, delivery_fee, subtotal + delivery_fee


def to_cents(total):
    return int(round(total * 100))
