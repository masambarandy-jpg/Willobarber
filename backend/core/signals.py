from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Reservation, User

AT_RISK_THRESHOLD = 3
AT_RISK_STATUSES = ('cancelled', 'cancelled_client', 'no_show')


@receiver(post_save, sender=Reservation)
def flag_client_at_risk(sender, instance, **kwargs):
    if instance.status not in AT_RISK_STATUSES:
        return

    user = instance.user
    if user.is_at_risk:
        return

    incident_count = Reservation.objects.filter(
        user=user, status__in=AT_RISK_STATUSES,
    ).count()

    if incident_count >= AT_RISK_THRESHOLD:
        User.objects.filter(pk=user.pk).update(is_at_risk=True)
