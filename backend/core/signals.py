from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from . import sse
from .models import Notification, Reservation, Review
from .serializers import NotificationSerializer

# Reservation n'a pas de champ barbier (agenda unique) : même valeur que
# l'email de confirmation envoyé dans ReservationViewSet.perform_create.
SALON_BARBER_NAME = 'Willo'
CANCELLED_STATUSES = ('cancelled', 'cancelled_client')


def reservation_payload(reservation):
    user = reservation.user
    return {
        'reservation_id': reservation.id,
        'client_name': f"{user.first_name} {user.last_name}".strip() or user.username,
        'client_phone': user.phone or '',
        'service_name': reservation.service.name,
        'barber_name': SALON_BARBER_NAME,
        'date': reservation.date.isoformat(),
        'time': reservation.time.strftime('%H:%M'),
        'price': float(reservation.service.price),
        'status': reservation.status,
    }


def _publish_after_commit(event, payload):
    # La création de résa tourne dans un transaction.atomic() (cf.
    # ReservationViewSet.create) : publier avant le commit laisserait le
    # coiffeur recharger le planning sans y trouver le nouveau RDV.
    transaction.on_commit(lambda: sse.publish(event, payload))


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
    payload = reservation_payload(instance)
    desc = f"{payload['client_name']} · {payload['service_name']} · {payload['time']}"

    if created:
        notification = Notification.objects.create(
            type='rdv',
            title='Nouveau rendez-vous',
            desc=desc,
            data=payload,
        )
        _publish_after_commit('new_reservation', {
            **payload,
            'notification': NotificationSerializer(notification).data,
        })
        return

    old_status = getattr(instance, '_old_status', None)
    if instance.status in CANCELLED_STATUSES and old_status not in CANCELLED_STATUSES:
        event = {'reservation_id': instance.id, 'barber_id': None}
        if instance.status == 'cancelled_client':
            notification = Notification.objects.create(
                type='annulation',
                title='Rendez-vous annulé',
                desc=desc,
                data=payload,
            )
            event['notification'] = NotificationSerializer(notification).data
        _publish_after_commit('reservation_cancelled', event)
        return

    _publish_after_commit('reservation_updated', payload)


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
