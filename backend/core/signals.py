from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Notification, Reservation, Review, User

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


@receiver(pre_save, sender=Reservation)
def stash_old_reservation_status(sender, instance, **kwargs):
    # Nécessaire pour distinguer, dans le post_save ci-dessous, une transition
    # vers 'cancelled_client' d'un simple re-save d'une réservation déjà
    # annulée (sinon on créerait une Notification à chaque save() ultérieur).
    instance._old_status = (
        Reservation.objects.filter(pk=instance.pk).values_list('status', flat=True).first()
        if instance.pk else None
    )


@receiver(post_save, sender=Reservation)
def notify_on_reservation_change(sender, instance, created, **kwargs):
    client_name = f"{instance.user.first_name} {instance.user.last_name}".strip() or instance.user.username
    heure = instance.time.strftime('%H:%M')

    if created:
        Notification.objects.create(
            type='rdv',
            title='Nouveau rendez-vous',
            desc=f"{client_name} · {instance.service.name} · {heure}",
        )
        return

    old_status = getattr(instance, '_old_status', None)
    if instance.status == 'cancelled_client' and old_status != 'cancelled_client':
        Notification.objects.create(
            type='annulation',
            title='Rendez-vous annulé',
            desc=f"{client_name} · {instance.service.name} · {heure}",
        )


@receiver(post_save, sender=Review)
def notify_on_new_review(sender, instance, created, **kwargs):
    if not created:
        return

    client_name = f"{instance.user.first_name} {instance.user.last_name}".strip() or instance.user.username
    service_name = instance.reservation.service.name
    rating = instance.rating

    Notification.objects.create(
        type='avis',
        title=f"Nouvel avis {'⭐' * rating}",
        desc=f"{client_name} · {service_name} · {rating}★",
    )
