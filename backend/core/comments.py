"""Commentaires client sur un RDV passé (modèle Review) et réponses du barbier.

Temps réel : new_comment → tous les coiffeurs connectés (cf. signals.py),
new_comment_reply → uniquement le flux du client concerné.
"""
from datetime import datetime

from django.db import transaction
from django.utils import timezone

from . import sse
from .recommendations import SALON_TZ, create_client_notification
from .serializers import ReviewSerializer

COMMENT_MAX_LENGTH = 500
# Un RDV annulé ou manqué n'a pas eu lieu : rien à commenter.
COMMENTABLE_STATUSES = ('pending', 'confirmed')


class CommentError(ValueError):
    pass


def client_name(user):
    return f"{user.first_name} {user.last_name}".strip() or user.username


def check_commentable(reservation):
    """Seul un RDV passé et honoré peut être commenté. (L'ancienne règle
    exigeait status='completed', un statut que rien ne pose jamais.)"""
    starts_at = datetime.combine(reservation.date, reservation.time, tzinfo=SALON_TZ)
    if reservation.status not in COMMENTABLE_STATUSES or starts_at > timezone.now():
        raise CommentError('Seul un rendez-vous passé peut être commenté.')


def clean_text(raw, required=True):
    text = (raw or '').strip()
    if required and not text:
        raise CommentError('Le commentaire ne peut pas être vide.')
    if len(text) > COMMENT_MAX_LENGTH:
        raise CommentError(f'{COMMENT_MAX_LENGTH} caractères maximum.')
    return text


def clean_rating(raw, required=False):
    if raw in (None, ''):
        if required:
            raise CommentError('Note invalide.')
        return None
    try:
        rating = int(raw)
    except (TypeError, ValueError):
        raise CommentError('Note invalide.')
    if not 1 <= rating <= 5:
        raise CommentError('La note doit être comprise entre 1 et 5.')
    return rating


def save_reply(review, text):
    """Enregistre la réponse du barbier et prévient le client (🔔 + toast)."""
    review.reply = text
    review.replied_at = timezone.now()
    review.save(update_fields=['reply', 'replied_at', 'updated_at'])

    reservation = review.reservation
    message = 'Votre barbier vous a répondu !'
    notification = create_client_notification(
        review.user, 'comment_reply', message,
        f'{reservation.service.name} du {reservation.date.strftime("%d/%m/%Y")}',
        {'reservation_id': reservation.id, 'review_id': review.id, 'reply': text},
    )
    payload = {
        'type': 'new_comment_reply',
        'reservation_id': reservation.id,
        'review_id': review.id,
        'barber_name': reservation.barber,
        'reply': text,
        'message': message,
        'notification_id': notification.id,
    }

    def publish():
        reached = sse.publish_to_client(review.user_id, 'new_comment_reply', payload)
        print(f"[SSE] new_comment_reply → user {review.user_id} ({reached} flux ouvert(s)): {payload}")

    transaction.on_commit(publish)
    return ReviewSerializer(review).data
