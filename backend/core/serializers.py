from rest_framework import serializers
from .models import User, Barbershop, Service, Reservation


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'phone']


class BarbershopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barbershop
        fields = '__all__'


class ServiceSerializer(serializers.ModelSerializer):
    barbershop_name = serializers.CharField(source='barbershop.name', read_only=True)

    class Meta:
        model = Service
        fields = ['id', 'name', 'price', 'duration', 'barbershop', 'barbershop_name']


class ReservationSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)

    class Meta:
        model = Reservation
        fields = [
            'id',
            'user',
            'user_username',
            'service',
            'service_name',
            'date',
            'time',
            'status',
        ]