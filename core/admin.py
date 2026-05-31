from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Barber, Service, Availability, Reservation, Review, WaitingList, SalonSettings, ConsentLog, SlotLock

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'loyalty_points', 'late_cancellations', 'is_deleted')
    list_filter = ('role', 'is_deleted')
    fieldsets = UserAdmin.fieldsets + (
        ('WilloBarber', {'fields': ('role', 'phone', 'language', 'dark_mode', 'ai_recommendations', 'loyalty_points', 'late_cancellations', 'is_deleted', 'deleted_at')}),
    )

@admin.register(Barber)
class BarberAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'is_active', 'experience_years')

@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'duration', 'is_popular', 'status', 'is_deleted')
    list_filter = ('category', 'status', 'is_popular')

@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ('reference', 'client', 'barber', 'service', 'date', 'start_time', 'status', 'payment_status', 'is_deleted')
    list_filter = ('status', 'payment_status', 'is_deleted', 'is_walk_in')
    search_fields = ('reference', 'client__username', 'client__email')

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('client', 'barber', 'rating', 'status', 'created_at')

@admin.register(SalonSettings)
class SalonSettingsAdmin(admin.ModelAdmin):
    list_display = ('booking_cutoff_hour', 'min_booking_hours_ahead', 'rush_mode_active', 'bookings_open')

admin.site.register(Availability)
admin.site.register(WaitingList)
admin.site.register(ConsentLog)
admin.site.register(SlotLock)
