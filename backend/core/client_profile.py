"""Fiche client affichée au barbier quand il scanne le QR d'une réservation.

Une « visite » est un RDV honoré (pending/confirmed — annulés et no-show
exclus) qui a lieu au plus tard au créneau du RDV scanné : les RDV futurs déjà
réservés ne comptent pas encore. Le RDV scanné compte, donc un premier
passage donne total_visits == 1.
"""
from django.db.models import Count, Max, Q

from .models import Reservation

VISIT_STATUSES = ('pending', 'confirmed')
FAVORITE_SERVICES_LIMIT = 3


def _visits_until(reservation):
    up_to_slot = Q(date__lt=reservation.date) | Q(date=reservation.date, time__lte=reservation.time)
    return Reservation.objects.filter(up_to_slot, user_id=reservation.user_id, status__in=VISIT_STATUSES)


def build_client_profile(reservation):
    client = reservation.user
    visits = _visits_until(reservation)

    # Exclut tout le créneau scanné, pas seulement ce RDV : un groupe d'enfants
    # = plusieurs réservations au même créneau (cf. book.tsx).
    last_visit = visits.exclude(
        date=reservation.date, time=reservation.time,
    ).aggregate(last=Max('date'))['last']

    favorite_services = [
        row['service__name']
        for row in visits.values('service__name')
        .annotate(n=Count('id'))
        .order_by('-n', 'service__name')[:FAVORITE_SERVICES_LIMIT]
    ]
    top_barber = visits.values('barber').annotate(n=Count('id')).order_by('-n', 'barber').first()

    return {
        'id': client.id,
        'first_name': client.first_name,
        'last_name': client.last_name,
        'profile_picture': client.profile_picture or None,
        'loyalty_points': client.loyalty_points,
        'total_visits': visits.count(),
        'member_since': client.date_joined,
        'last_visit': last_visit,
        'favorite_services': favorite_services,
        'favorite_barber': top_barber['barber'] if top_barber else None,
    }
