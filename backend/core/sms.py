import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from twilio.rest import Client

from .emails import format_heure_fr

logger = logging.getLogger(__name__)


def send_sms_reminder(reservation) -> bool:
    """Envoie un SMS de rappel de RDV au client. Retourne True si l'envoi a réussi."""
    client_user = reservation.user
    phone = client_user.phone
    if not phone:
        logger.warning(f"[SMS] Pas de téléphone pour {client_user} — rappel non envoyé (reservation {reservation.id})")
        return False

    message_body = (
        f"Bonjour {client_user.first_name} ! \U0001F44B\n"
        f"Rappel : vous avez un RDV demain à {format_heure_fr(reservation.time)} chez WilloBarber.\n"
        f"Service : {reservation.service.name}\n"
        f"À demain ! \U0001F4AA"
    )

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=message_body,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=phone,
        )
        logger.info(f"[SMS] Rappel envoyé à {phone} (reservation {reservation.id}) — sid={message.sid}")
        return True
    except Exception as e:
        logger.error(f"[SMS] Échec envoi rappel à {phone} (reservation {reservation.id}): {e}")
        return False


def send_reminders_for_tomorrow() -> dict:
    """Envoie les rappels SMS pour tous les RDV de demain. Utilisé par la commande
    manage.py send_reminders et par l'endpoint POST /api/reminders/send/."""
    from .models import Reservation

    tomorrow = timezone.localdate() + timedelta(days=1)
    reservations = Reservation.objects.filter(date=tomorrow).exclude(status__in=['cancelled', 'cancelled_client'])

    sent = 0
    failed = 0
    skipped = 0

    for reservation in reservations:
        if not reservation.user.phone:
            logger.warning(f"[SMS] Pas de téléphone pour {reservation.user} — rappel non envoyé (reservation {reservation.id})")
            skipped += 1
            continue
        if send_sms_reminder(reservation):
            sent += 1
        else:
            failed += 1

    return {'sent': sent, 'failed': failed, 'skipped': skipped, 'total': reservations.count()}
