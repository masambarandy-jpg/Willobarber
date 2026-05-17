from rest_framework import viewsets
from .models import Barbershop, Service, Reservation
from .serializers import BarbershopSerializer, ServiceSerializer, ReservationSerializer


class BarbershopViewSet(viewsets.ModelViewSet):
    queryset = Barbershop.objects.all()
    serializer_class = BarbershopSerializer


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer


class ReservationViewSet(viewsets.ModelViewSet):
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer
# Create your views here.
