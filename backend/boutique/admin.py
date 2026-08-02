from django.contrib import admin
from .models import Product, Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['prix_unitaire']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['nom', 'categorie', 'prix', 'stock', 'stock_alert', 'actif']
    list_filter = ['categorie', 'actif']
    search_fields = ['nom']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['numero', 'user', 'status', 'total', 'created_at']
    list_filter = ['status']
    inlines = [OrderItemInline]
    readonly_fields = ['numero', 'total', 'created_at']
