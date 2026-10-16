import logging
import threading
from datetime import timedelta
from decimal import Decimal

import stripe
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from core import sse
from core.models import Reservation
from core.permissions import IsStaffRole
from core.recommendations import SALON_TZ
from .invoices import (
    build_boutique_invoice_pdf, notify_coiffeur_new_order, order_from_invoice_token, send_boutique_invoice,
)
from .models import Product, Order, OrderItem
from .serializers import ProductSerializer, OrderSerializer, StaffOrderSerializer

logger = logging.getLogger(__name__)

# Même montant que l'option « Livraison à domicile » du panier (cart.tsx).
DELIVERY_FEE = Decimal('4.95')

# Statuts que le coiffeur peut appliquer, selon le mode de livraison.
STAFF_STATUSES = {
    'domicile': ('preparing', 'shipped', 'delivered'),
    'retrait_salon': ('preparing', 'ready', 'picked_up'),
}


def _intent_user_id(intent):
    # metadata est un StripeObject : pas de .get() (ce n'est plus un dict
    # depuis stripe-python 8), et il reste truthy même vide.
    metadata = intent.metadata.to_dict() if intent.metadata else {}
    return str(metadata.get('user_id'))


def _check_payment_intent(payment_intent_id, total, user):
    """Message d'erreur si le PaymentIntent ne règle pas exactement cette
    commande pour ce client, None sinon."""
    if not settings.STRIPE_SECRET_KEY:
        print(f"[BOUTIQUE] STRIPE_SECRET_KEY absent — PaymentIntent {payment_intent_id} non vérifié")
        return None
    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
    except stripe.error.StripeError:
        return 'Paiement introuvable.'
    if intent.status != 'succeeded':
        return "Le paiement n'a pas abouti."
    if intent.amount != int(round(total * 100)) or intent.currency != 'eur':
        return 'Le montant payé ne correspond pas à la commande.'
    if _intent_user_id(intent) != str(user.id):
        return 'Ce paiement ne vous appartient pas.'
    return None


def _payment_intent_used(payment_intent_id):
    return (
        Order.objects.filter(payment_intent_id=payment_intent_id).exists()
        or Reservation.objects.filter(payment_intent_id=payment_intent_id).exists()
    )


def _refund(payment_intent_id, user):
    """Rembourse un paiement fait pour une commande finalement refusée — jamais
    celui d'un autre client ni un paiement déjà rattaché à une commande/un RDV."""
    if not settings.STRIPE_SECRET_KEY or _payment_intent_used(payment_intent_id):
        return
    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        if intent.status == 'succeeded' and _intent_user_id(intent) == str(user.id):
            stripe.Refund.create(payment_intent=payment_intent_id)
            print(f"[BOUTIQUE] PaymentIntent {payment_intent_id} remboursé (commande refusée)")
    except stripe.error.StripeError as e:
        print(f"[BOUTIQUE] Remboursement impossible pour {payment_intent_id}: {e}")


class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Product.objects.filter(actif=True)


class ProductDetailView(generics.RetrieveAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Product.objects.filter(actif=True)


class OrderListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(user=request.user)
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    def post(self, request):
        """Commande déjà payée côté app (StripeCardField.pay(), comme une
        réservation) : le PaymentIntent est vérifié ici avant de créer la
        commande. Ensuite : notification coiffeur + SSE new_boutique_order, et
        facture PDF/email/notification client dans un thread."""
        items_data = request.data.get('items', [])
        payment_intent_id = (request.data.get('payment_intent_id') or '').strip()
        delivery_type = request.data.get('delivery_type') or 'retrait_salon'
        delivery_address = (request.data.get('delivery_address') or '').strip()

        if not items_data:
            return Response(
                {'detail': 'La commande doit contenir au moins un article.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not payment_intent_id:
            return Response({'detail': 'Paiement requis.'}, status=status.HTTP_400_BAD_REQUEST)

        def reject(detail):
            # Le client a déjà été débité : on le rembourse avant de refuser.
            _refund(payment_intent_id, request.user)
            return Response({'detail': detail}, status=status.HTTP_400_BAD_REQUEST)

        if delivery_type not in dict(Order.DELIVERY_CHOICES):
            return reject('Mode de livraison invalide.')
        if delivery_type == 'domicile' and not delivery_address:
            return reject("L'adresse de livraison est obligatoire.")

        subtotal = Decimal('0.00')
        validated_items = []

        for item in items_data:
            product_id = item.get('product_id')
            quantite = item.get('quantite', 1)
            if not isinstance(quantite, int) or isinstance(quantite, bool) or quantite < 1:
                return reject('Quantité invalide.')
            try:
                product = Product.objects.get(pk=product_id, actif=True)
            except Product.DoesNotExist:
                return reject(f'Produit {product_id} introuvable.')
            if quantite > product.stock:
                return reject(f'Stock insuffisant pour {product.nom} (disponible : {product.stock}).')
            subtotal += product.prix * Decimal(str(quantite))
            validated_items.append({'product': product, 'quantite': quantite, 'prix_unitaire': product.prix})

        delivery_fee = DELIVERY_FEE if delivery_type == 'domicile' else Decimal('0.00')
        total = subtotal + delivery_fee

        if _payment_intent_used(payment_intent_id):
            return Response({'detail': 'Ce paiement a déjà été utilisé.'}, status=status.HTTP_400_BAD_REQUEST)

        payment_error = _check_payment_intent(payment_intent_id, total, request.user)
        if payment_error:
            return Response({'detail': payment_error}, status=status.HTTP_402_PAYMENT_REQUIRED)

        site_root = request.build_absolute_uri('/')
        with transaction.atomic():
            order = Order.objects.create(
                user=request.user,
                total=total,
                status='preparing',
                delivery_type=delivery_type,
                delivery_address=delivery_address if delivery_type == 'domicile' else '',
                delivery_fee=delivery_fee,
                payment_intent_id=payment_intent_id,
                paid_at=timezone.now(),
            )
            for vi in validated_items:
                OrderItem.objects.create(
                    order=order,
                    product=vi['product'],
                    quantite=vi['quantite'],
                    prix_unitaire=vi['prix_unitaire'],
                )
                Product.objects.filter(pk=vi['product'].pk).update(stock=F('stock') - vi['quantite'])

            # Savepoint : un échec de la notif coiffeur ne doit jamais annuler
            # une commande déjà payée par le client.
            try:
                with transaction.atomic():
                    notify_coiffeur_new_order(order, site_root)
            except Exception:
                logger.exception("Notification coiffeur non créée (commande %s)", order.numero)
            transaction.on_commit(lambda: threading.Thread(
                target=send_boutique_invoice,
                args=(order.id, site_root),
                daemon=True,
            ).start())

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProductStockUpdateView(APIView):
    permission_classes = [IsStaffRole]

    def patch(self, request, pk):
        try:
            product = Product.objects.get(pk=pk)
        except Product.DoesNotExist:
            return Response({'detail': 'Produit introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            stock = int(request.data.get('stock'))
        except (TypeError, ValueError):
            return Response({'detail': 'stock doit être un entier.'}, status=status.HTTP_400_BAD_REQUEST)

        if stock < 0:
            return Response({'detail': 'Le stock ne peut pas être négatif.'}, status=status.HTTP_400_BAD_REQUEST)

        product.stock = stock
        product.save(update_fields=['stock'])
        return Response(ProductSerializer(product).data)


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)


class StaffOrderListView(APIView):
    """Commandes boutique pour l'espace coiffeur : ?period=today|week|all."""
    permission_classes = [IsStaffRole]

    def get(self, request):
        orders = Order.objects.select_related('user').prefetch_related('items__product').exclude(paid_at=None)
        period = request.query_params.get('period', 'week')
        # Journée du salon (Bruxelles), pas celle du serveur (UTC).
        today_start = timezone.localtime(timezone.now(), SALON_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
        if period == 'today':
            orders = orders.filter(created_at__gte=today_start)
        elif period == 'week':
            orders = orders.filter(created_at__gte=today_start - timedelta(days=6))
        serializer = StaffOrderSerializer(orders, many=True, context={'request': request})
        return Response(serializer.data)


class StaffOrderDetailView(APIView):
    permission_classes = [IsStaffRole]

    def get_order(self, pk):
        return Order.objects.select_related('user').prefetch_related('items__product').filter(pk=pk).first()

    def get(self, request, pk):
        order = self.get_order(pk)
        if order is None:
            return Response({'detail': 'Commande introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(StaffOrderSerializer(order, context={'request': request}).data)

    def patch(self, request, pk):
        order = self.get_order(pk)
        if order is None:
            return Response({'detail': 'Commande introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        new_status = request.data.get('status')
        if new_status not in STAFF_STATUSES[order.delivery_type]:
            return Response({'detail': 'Statut invalide pour ce mode de livraison.'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = new_status
        order.save(update_fields=['status'])
        # Les autres écrans coiffeur ouverts (liste Commandes, dashboard) se rechargent.
        sse.publish('boutique_order_updated', {'order_id': order.id, 'status': order.status})
        return Response(StaffOrderSerializer(order, context={'request': request}).data)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def download_boutique_invoice(request, token):
    order = order_from_invoice_token(token)
    if order is None:
        return Response({'detail': 'Lien de facture invalide ou expiré.'}, status=status.HTTP_404_NOT_FOUND)
    pdf_bytes, invoice_number = build_boutique_invoice_pdf(order)
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="Facture_WilloBarber_{invoice_number}.pdf"'
    return response
