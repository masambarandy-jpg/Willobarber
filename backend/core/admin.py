from django.contrib import admin, messages
from django.template.response import TemplateResponse
from django.urls import path
from django.utils import timezone

from .cancellations import barber_cancellation_stats, retry_refund
from .models import (
    User, Barbershop, Barber, Service, Reservation, ClosedPeriod, OpeningHours, Review,
    RefundAttempt, BarberCancellationLog,
)
from .recommendations import SALON_TZ

admin.site.register(User)
admin.site.register(Barbershop)
admin.site.register(Barber)
admin.site.register(Service)
admin.site.register(Reservation)
admin.site.register(ClosedPeriod)
admin.site.register(OpeningHours)
admin.site.register(Review)


@admin.register(RefundAttempt)
class RefundAttemptAdmin(admin.ModelAdmin):
    list_display = ('reservation', 'attempt_number', 'status', 'stripe_refund_id', 'cancellation_fee', 'error_message', 'created_at')
    list_filter = ('status', 'created_at')
    actions = ['retry_refund']

    @admin.action(description='Retry refund')
    def retry_refund(self, request, queryset):
        succeeded = failed = 0
        for attempt in queryset.filter(status='failed'):
            if retry_refund(attempt):
                succeeded += 1
            else:
                failed += 1
        if succeeded:
            self.message_user(request, f"{succeeded} remboursement(s) effectué(s).", messages.SUCCESS)
        if failed:
            # Stripe rejoue la réponse d'une même clé d'idempotence pendant au moins 24h.
            self.message_user(
                request,
                f"{failed} sans effet : déjà remboursé, ou échec Stripe (une même erreur peut être "
                "rejouée pendant 24h par la clé d'idempotence).",
                messages.WARNING,
            )


@admin.register(BarberCancellationLog)
class BarberCancellationLogAdmin(admin.ModelAdmin):
    list_display = ('reservation', 'barber_user', 'reason', 'client_was_refunded', 'refund_amount', 'created_at')
    list_filter = ('reason', 'barber_user', 'created_at')

    def get_urls(self):
        return [
            path('dashboard/', self.admin_site.admin_view(self.dashboard_view), name='core_barbercancellationlog_dashboard'),
            *super().get_urls(),
        ]

    def dashboard_view(self, request):
        context = {
            **self.admin_site.each_context(request),
            'title': 'Annulations par coiffeur — 30 derniers jours',
            'opts': self.model._meta,
            'stats': barber_cancellation_stats(timezone.localtime(timezone.now(), SALON_TZ).date()),
        }
        return TemplateResponse(request, 'admin/core/barbercancellationlog/dashboard.html', context)
