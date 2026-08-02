from decimal import Decimal
from django.db import transaction
from django.db.models import F
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from core.permissions import IsStaffRole
from .models import Product, Order, OrderItem
from .serializers import ProductSerializer, OrderSerializer


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
        items_data = request.data.get('items', [])
        if not items_data:
            return Response(
                {'detail': 'La commande doit contenir au moins un article.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total = Decimal('0.00')
        validated_items = []

        for item in items_data:
            product_id = item.get('product_id')
            quantite = item.get('quantite', 1)
            try:
                product = Product.objects.get(pk=product_id, actif=True)
            except Product.DoesNotExist:
                return Response(
                    {'detail': f'Produit {product_id} introuvable.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if quantite > product.stock:
                return Response(
                    {'detail': f'Stock insuffisant pour {product.nom} (disponible : {product.stock}).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            total += product.prix * Decimal(str(quantite))
            validated_items.append({'product': product, 'quantite': quantite, 'prix_unitaire': product.prix})

        with transaction.atomic():
            order = Order.objects.create(user=request.user, total=total)
            for vi in validated_items:
                OrderItem.objects.create(
                    order=order,
                    product=vi['product'],
                    quantite=vi['quantite'],
                    prix_unitaire=vi['prix_unitaire'],
                )
                Product.objects.filter(pk=vi['product'].pk).update(stock=F('stock') - vi['quantite'])

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
