"""Annulation d'un RDV et remboursement Stripe, côté client comme côté salon.

Tout s'exécute dans la transaction de la vue, réservation verrouillée : une
double annulation concurrente trouve le statut déjà changé et n'atteint jamais
Stripe. Un échec Stripe ne bloque pas l'annulation (cf. RefundAttempt).
"""
import logging
from datetime import timedelta
from decimal import Decimal

import stripe
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from .emails import (
    late_cancellation_amounts, queue_cancellation_email, queue_refund_failure_alert, reservation_start,
)
from .loyalty import reservation_points
from .models import BarberCancellationLog, RefundAttempt, Reservation, User
from .waitlist import ACTIVE_RESERVATION_STATUSES

logger = logging.getLogger(__name__)

# L'app crée ses réservations en 'pending' (book.tsx n'envoie pas de statut) et
# rien ne les fait passer à 'confirmed' : les deux sont des RDV annulables.
CANCELLABLE_STATUSES = ACTIVE_RESERVATION_STATUSES
LATE_STATUS = 'cancelled_late_partial_refund'
NO_SHOW_GRACE = timedelta(minutes=15)
NO_SHOW_ALERT_RATE = 20
REFUND_FAILED_MESSAGE = (
    "Votre annulation est bien prise en compte. Le remboursement sera traité manuellement dans les 24h."
)


def has_started(reservation, now):
    """Un RDV honoré reste 'pending' ou 'confirmed' : sans ce contrôle, un client
    pourrait annuler une coupe déjà faite et se la faire rembourser."""
    return reservation.checked_in or now >= reservation_start(reservation)


def _record_refund(reservation, refund, now):
    amount = Decimal(refund.amount) / 100
    reservation.refund_id = refund.id
    reservation.refund_amount = amount
    reservation.refunded_at = now
    return amount


def attempt_refund(reservation, now, late=False):
    """Rembourse le paiement en ligne, moins les frais si l'annulation est tardive.
    Retourne (montant remboursé, échec Stripe)."""
    if not reservation.payment_intent_id:
        return Decimal('0'), False

    attempt_number = RefundAttempt.objects.filter(reservation=reservation).count() + 1
    fee = Decimal('0')
    params = {}
    if late:
        amount, fee = late_cancellation_amounts(reservation)
        if amount <= 0:
            # Rien à rembourser, donc pas de Stripe : on trace seulement les frais conservés.
            if fee > 0:
                RefundAttempt.objects.create(
                    reservation=reservation, attempt_number=attempt_number, status='succeeded', cancellation_fee=fee,
                )
            return Decimal('0'), False
        params['amount'] = int(amount * 100)

    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        refund = stripe.Refund.create(
            payment_intent=reservation.payment_intent_id,
            idempotency_key=f"refund-{reservation.id}",
            **params,
        )
    except stripe.error.StripeError as e:
        logger.error("Échec du remboursement Stripe (réservation %s)", reservation.id, exc_info=True)
        RefundAttempt.objects.create(
            reservation=reservation, attempt_number=attempt_number, status='failed', error_message=str(e),
            cancellation_fee=fee,
        )
        queue_refund_failure_alert(reservation, str(e))
        return Decimal('0'), True

    RefundAttempt.objects.create(
        reservation=reservation, attempt_number=attempt_number, status='succeeded', stripe_refund_id=refund.id,
        cancellation_fee=fee,
    )
    return _record_refund(reservation, refund, now), False


def remove_loyalty_points(reservation):
    """Retire les points gagnés à la réservation. Retourne le nombre réellement retiré."""
    client = User.objects.select_for_update().get(pk=reservation.user_id)
    removed = min(reservation_points(reservation), max(client.loyalty_points or 0, 0))
    client.loyalty_points = (client.loyalty_points or 0) - removed
    client.save(update_fields=['loyalty_points'])
    return removed


def apply_cancellation(reservation, new_status, cancelled_by, reason, now, *, refund, remove_points):
    """Annule la réservation verrouillée : le save() libère le créneau et déclenche
    _sync_waitlist (signals.py). Retourne le dict commun des réponses HTTP."""
    late = new_status == LATE_STATUS
    refund_amount, refund_failed = attempt_refund(reservation, now, late) if refund else (Decimal('0'), False)
    points_removed = remove_loyalty_points(reservation) if remove_points else 0

    reservation.status = new_status
    reservation.cancelled_at = now
    reservation.cancelled_by = cancelled_by
    reservation.cancellation_reason = reason
    reservation.save()
    queue_cancellation_email(reservation, refund_failed)

    return {
        'status': new_status,
        'refund_amount': float(refund_amount),
        'cancellation_fee': float(late_cancellation_amounts(reservation)[1]) if late else 0,
        'loyalty_points_removed': points_removed,
        'refund_failed': refund_failed,
    }


def log_barber_cancellation(reservation, user, reason, notes, refund_amount):
    BarberCancellationLog.objects.create(
        reservation=reservation,
        barber_user=user,
        reason=reason,
        notes=notes,
        client_was_refunded=bool(refund_amount),
        refund_amount=refund_amount,
    )


@transaction.atomic
def retry_refund(attempt):
    """Relance admin d'un remboursement en échec. Retourne True s'il a abouti."""
    reservation = Reservation.objects.select_for_update().get(pk=attempt.reservation_id)
    if reservation.refund_id:
        return False
    # Mêmes paramètres qu'au 1er essai : Stripe refuse une clé d'idempotence réutilisée autrement.
    amount, failed = attempt_refund(reservation, timezone.now(), late=reservation.status == LATE_STATUS)
    if failed:
        return False
    reservation.save(update_fields=['refund_id', 'refund_amount', 'refunded_at'])
    BarberCancellationLog.objects.filter(reservation=reservation).update(
        client_was_refunded=amount > 0, refund_amount=amount,
    )
    return True


@transaction.atomic
def handle_refund_webhook(refund):
    """Met à jour la réservation concernée selon l'état du remboursement Stripe."""
    reservation = (
        Reservation.objects.select_for_update()
        .filter(Q(refund_id=refund.id) | Q(payment_intent_id=refund.payment_intent), payment_intent_id__gt='')
        .first()
    )
    if reservation is None:
        return

    now = timezone.now()
    if refund.status == 'succeeded':
        # refund_id vide : remboursement manuel fait depuis le dashboard Stripe.
        if not reservation.refund_id:
            amount = _record_refund(reservation, refund, now)
            RefundAttempt.objects.create(
                reservation=reservation,
                attempt_number=RefundAttempt.objects.filter(reservation=reservation).count() + 1,
                status='succeeded',
                stripe_refund_id=refund.id,
            )
            BarberCancellationLog.objects.filter(reservation=reservation).update(
                client_was_refunded=True, refund_amount=amount,
            )
        reservation.refund_confirmed_at = now
        reservation.save(update_fields=['refund_id', 'refund_amount', 'refunded_at', 'refund_confirmed_at'])
    elif refund.status == 'failed':
        error = f"Remboursement {refund.id} refusé par la banque"
        logger.error("%s (réservation %s)", error, reservation.id)
        RefundAttempt.objects.create(
            reservation=reservation,
            attempt_number=RefundAttempt.objects.filter(reservation=reservation).count() + 1,
            status='failed',
            stripe_refund_id=refund.id,
            error_message=error,
        )
        # Les fonds ne sont pas rendus : on rouvre la relance depuis l'admin.
        reservation.refund_id = None
        reservation.refund_amount = None
        reservation.refunded_at = None
        reservation.refund_confirmed_at = None
        reservation.save(update_fields=['refund_id', 'refund_amount', 'refunded_at', 'refund_confirmed_at'])
        BarberCancellationLog.objects.filter(reservation=reservation).update(
            client_was_refunded=False, refund_amount=None,
        )
        queue_refund_failure_alert(reservation, error)


def barber_cancellation_stats(today):
    """Par coiffeur, sur les 30 derniers jours : RDV, annulations par motif, taux de no-show."""
    since = today - timedelta(days=30)
    window = Q(date__gte=since, date__lte=today)
    per_reason = {
        reason: Count('barbercancellationlog', filter=Q(barbercancellationlog__reason=reason))
        for reason, _ in BarberCancellationLog.REASON_CHOICES
    }
    rows = (
        Reservation.objects.filter(window).values('barber')
        .annotate(total=Count('id', distinct=True), **per_reason)
        .order_by('barber')
    )
    stats = []
    for row in rows:
        rate = round(row['client_no_show'] / row['total'] * 100, 1) if row['total'] else 0
        stats.append({**row, 'no_show_rate': rate, 'flagged': rate > NO_SHOW_ALERT_RATE})
    return stats
