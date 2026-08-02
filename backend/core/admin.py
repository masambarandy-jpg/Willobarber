from django.contrib import admin
from .models import User, Barbershop, Service, Reservation, ClosedPeriod

admin.site.register(User)
admin.site.register(Barbershop)
admin.site.register(Service)
admin.site.register(Reservation)
admin.site.register(ClosedPeriod)
# Register your models here.
