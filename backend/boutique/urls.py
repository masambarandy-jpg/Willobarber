from django.urls import path
from .views import ProductListView, ProductDetailView, OrderListCreateView, OrderDetailView

urlpatterns = [
    path('produits/', ProductListView.as_view(), name='boutique-produits'),
    path('produits/<int:pk>/', ProductDetailView.as_view(), name='boutique-produit-detail'),
    path('commandes/', OrderListCreateView.as_view(), name='boutique-commandes'),
    path('commandes/<int:pk>/', OrderDetailView.as_view(), name='boutique-commande-detail'),
]
