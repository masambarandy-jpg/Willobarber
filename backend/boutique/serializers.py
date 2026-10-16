from rest_framework import serializers
from .invoices import boutique_invoice_url, client_name
from .models import Product, Order, OrderItem


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'quantite', 'prix_unitaire']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'numero', 'status', 'total', 'delivery_type', 'delivery_address', 'delivery_fee',
            'paid_at', 'items', 'created_at',
        ]


class StaffOrderSerializer(OrderSerializer):
    """Commande vue par le coiffeur : coordonnées du client + lien facture signé."""
    client_name = serializers.SerializerMethodField()
    client_phone = serializers.SerializerMethodField()
    client_email = serializers.EmailField(source='user.email', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    invoice_url = serializers.SerializerMethodField()

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + [
            'client_name', 'client_phone', 'client_email', 'status_label', 'invoice_url',
        ]

    def get_client_name(self, order):
        return client_name(order.user)

    def get_client_phone(self, order):
        return order.user.phone or ''

    def get_invoice_url(self, order):
        return boutique_invoice_url(order, self.context['request'].build_absolute_uri('/'))
