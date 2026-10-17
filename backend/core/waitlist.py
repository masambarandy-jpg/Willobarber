"""Liste d'attente par créneau (barbier + date + heure), opt-in strict.

Cycle d'une alerte (WaitlistEntry) :
- créée sur un créneau pris et à venir, au plus WAITLIST_MAX_PER_SLOT par créneau ;
- le créneau se libère (annulation ou reprogrammation du RDV) → tous les
  inscrits non encore prévenus le sont en même temps : notification 🔔, SSE
  waitlist_available et email. Premier qui réserve garde le créneau, les
  suivants reçoivent le 409 habituel de ReservationViewSet.create ;
- le créneau est repris : l'alerte du client qui l'a réservé disparaît, celles
  des autres sont réarmées (notified_at = NULL) pour la prochaine libération.
"""
from datetime import datetime, timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from . import sse
from .emails import queue_waitlist_email
from .models import Reservation, WaitlistEntry
from .recommendations import SALON_TZ, create_client_notification, salon_now

WAITLIST_MAX_PER_SLOT = 5
# En deçà, prévenir ne sert plus à rien : le client n'aurait pas le temps de venir.
NOTIFY_MIN_LEAD = timedelta(hours=2)
ACTIVE_RESERVATION_STATUSES = ('pending', 'confirmed')


def slot_start(day, at):
    return datetime.combine(day, at, tzinfo=SALON_TZ)


def upcoming_entries(now=None):
    now = now or salon_now()
    return WaitlistEntry.objects.filter(date__gte=now.date()).exclude(date=now.date(), time__lte=now.time())


def active_slot_reservation(barber, day, at, lock=False):
    """RDV qui occupe le créneau, verrouillé si lock=True : sert de verrou
    commun à toutes les inscriptions concurrentes sur ce créneau."""
    qs = Reservation.objects.filter(barber=barber, date=day, time=at, status__in=ACTIVE_RESERVATION_STATUSES)
    if lock:
        qs = qs.select_for_update()
    return qs.first()


def booking_link(entry):
    """Lien du wizard de réservation avec le créneau pré-sélectionné (cf.
    book.tsx, mode waitlist). Vide si APP_URL n'est pas configurée."""
    base = (settings.APP_URL or '').rstrip('/')
    if not base:
        return ''
    params = {
        'waitlist': 'true',
        'barbier': entry.barber,
        'date': entry.date.isoformat(),
        'heure': entry.time.strftime('%H:%M'),
    }
    if entry.service_name:
        params['prestation'] = entry.service_name
    return f"{base}/book?{urlencode(params)}"


@transaction.atomic
def notify_slot_freed(barber, day, at, now=None):
    """Prévient les inscrits du créneau libéré. Retourne le nombre d'alertes envoyées."""
    now = now or timezone.now()
    if slot_start(day, at) - now < NOTIFY_MIN_LEAD:
        return 0

    entries = list(
        WaitlistEntry.objects.select_for_update()
        .select_related('client')
        .filter(barber=barber, date=day, time=at, notified_at__isnull=True)
    )
    for entry in entries:
        entry.notified_at = now
        entry.save(update_fields=['notified_at'])
        payload = {
            'entry_id': entry.id,
            'barber': entry.barber,
            'date': entry.date.isoformat(),
            'time': entry.time.strftime('%H:%M'),
            'service_name': entry.service_name,
        }
        notification = create_client_notification(
            entry.client,
            'waitlist_available',
            'Un créneau s’est libéré ✨',
            f"{entry.barber} · {entry.date.strftime('%d/%m')} à {payload['time']}",
            payload,
        )
        event = {**payload, 'notification_id': notification.id}
        transaction.on_commit(
            lambda user_id=entry.client_id, event=event: sse.publish_to_client(user_id, 'waitlist_available', event)
        )
        queue_waitlist_email(entry, booking_link(entry))
    return len(entries)


def slot_booked(reservation):
    """Le créneau vient d'être (re)pris : l'alerte du client qui l'a réservé
    est satisfaite, celles des autres se réarment."""
    entries = WaitlistEntry.objects.filter(barber=reservation.barber, date=reservation.date, time=reservation.time)
    entries.filter(client_id=reservation.user_id).delete()
    entries.exclude(notified_at__isnull=True).update(notified_at=None)
