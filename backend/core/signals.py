from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from . import sse, waitlist
from .models import Notification, Reservation, Review
from .serializers import NotificationSerializer

CANCELLED_STATUSES = ('cancelled', 'cancelled_client')


def reservation_payload(reservation):
    user = reservation.user
    return {
        'reservation_id': reservation.id,
        'client_name': f"{user.first_name} {user.last_name}".strip() or user.username,
        'client_phone': user.phone or '',
        'service_name': reservation.service.name,
        'barber_name': reservation.barber,
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
    # L'ancien créneau sert à la liste d'attente : une reprogrammation libère
    # l'ancien horaire au même titre qu'une annulation.
    old = (
        Reservation.objects.filter(pk=instance.pk).values('status', 'barber', 'date', 'time').first()
        if instance.pk else None
    )
    instance._old_status = old['status'] if old else None
    instance._old_slot = (old['barber'], old['date'], old['time']) if old else None


def _sync_waitlist(instance, created):
    active = instance.status in waitlist.ACTIVE_RESERVATION_STATUSES
    if created:
        if active:
            waitlist.slot_booked(instance)
        return
    old_status = getattr(instance, '_old_status', None)
    old_slot = getattr(instance, '_old_slot', None)
    was_active = old_status in waitlist.ACTIVE_RESERVATION_STATUSES
    if was_active and not active and instance.status in CANCELLED_STATUSES:
        waitlist.notify_slot_freed(*old_slot)
    elif was_active and active and old_slot != (instance.barber, instance.date, instance.time):
        waitlist.notify_slot_freed(*old_slot)
        waitlist.slot_booked(instance)


@receiver(post_save, sender=Reservation)
def notify_on_reservation_change(sender, instance, created, **kwargs):
    _sync_waitlist(instance, created)
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
    """Nouveau commentaire client → notification coiffeur + SSE new_comment
    (toast « Nouveau message de … »). Les modifications ne renotifient pas."""
    if not created:
        return

    reservation = instance.reservation
    client_name = f"{instance.user.first_name} {instance.user.last_name}".strip() or instance.user.username
    service_name = reservation.service.name
    rating = instance.rating
    data = {
        'review_id': instance.id,
        'reservation_id': reservation.id,
        'client_name': client_name,
        'service_name': service_name,
        'date': reservation.date.isoformat(),
        'time': reservation.time.strftime('%H:%M'),
        'rating': rating,
        'comment': instance.comment or '',
    }
    notification = Notification.objects.create(
        type='avis',
        title=f"Nouveau message de {client_name}",
        desc=f"{client_name} · {service_name}" + (f" · {rating}★" if rating else ''),
        data=data,
    )
    payload = {**data, 'notification': NotificationSerializer(notification).data}

    def publish():
        sse.publish('new_comment', payload)
        print(f"[SSE] new_comment → coiffeurs: review {instance.id} de {client_name}")

    transaction.on_commit(publish)
