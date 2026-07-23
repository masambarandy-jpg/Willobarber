from rest_framework import serializers
from .models import User, Barbershop, Service, Reservation


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'phone', 'ai_recommendations']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'username', 'email', 'password', 'password2', 'phone']

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password2': 'Les mots de passe ne correspondent pas.'})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


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
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    service_price = serializers.DecimalField(source='service.price', max_digits=6, decimal_places=2, read_only=True)

    class Meta:
        model = Reservation
        fields = [
            'id',
            'user',
            'user_username',
            'service',
            'service_name',
            'service_price',
            'date',
            'time',
            'status',
            'payment_intent_id',
            'payment_status',
            'payment_method',
            'amount_paid',
        ]