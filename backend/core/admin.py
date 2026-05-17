from django.contrib import admin
from .models import User, Barbershop, Service, Reservation

admin.site.register(User)
admin.site.register(Barbershop)
admin.site.register(Service)
admin.site.register(Reservation)
# Register your models here.
