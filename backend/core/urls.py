from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BarbershopViewSet, ServiceViewSet, ReservationViewSet

router = DefaultRouter()
router.register(r'barbershops', BarbershopViewSet)
router.register(r'services', ServiceViewSet)
router.register(r'reservations', ReservationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]