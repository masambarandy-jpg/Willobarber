from django.urls import path
from .views import (
    ProductListView, ProductDetailView, ProductStockUpdateView,
    OrderListCreateView, OrderDetailView, StaffOrderListView, StaffOrderDetailView,
    download_boutique_invoice,
)

urlpatterns = [
    path('produits/', ProductListView.as_view(), name='boutique-produits'),
    path('produits/<int:pk>/', ProductDetailView.as_view(), name='boutique-produit-detail'),
    path('produits/<int:pk>/stock/', ProductStockUpdateView.as_view(), name='boutique-produit-stock'),
    path('commandes/', OrderListCreateView.as_view(), name='boutique-commandes'),
    path('commandes/<int:pk>/', OrderDetailView.as_view(), name='boutique-commande-detail'),
    path('gestion/commandes/', StaffOrderListView.as_view(), name='boutique-gestion-commandes'),
    path('gestion/commandes/<int:pk>/', StaffOrderDetailView.as_view(), name='boutique-gestion-commande-detail'),
    path('factures/<str:token>/', download_boutique_invoice, name='boutique-invoice-download'),
]
