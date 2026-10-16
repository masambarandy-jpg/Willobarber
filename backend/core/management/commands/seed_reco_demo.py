from datetime import time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Barbershop, Notification, Reservation, Service, User
from core.recommendations import salon_now
from core.slots import slot_times_for

PASSWORD = 'Demo1234!'
REGULAR_INTERVAL_DAYS = 28  # multiple de 7 : toutes les visites tombent le même jour
REGULAR_VISITS = 5
IRREGULAR_DAYS_AGO = 52


def _get_or_create_user(username, first_name, last_name):
    user, _ = User.objects.get_or_create(username=username, defaults={'email': f'{username}@willobarber.test'})
    user.email = f'{username}@willobarber.test'
    user.first_name = first_name
    user.last_name = last_name
    user.role = 'client'
    user.ai_recommendations = True
    user.last_reco_sent_at = None
    user.is_deleted = False
    user.set_password(PASSWORD)
    user.save()
    Reservation.objects.filter(user=user).delete()
    Notification.objects.filter(user=user).delete()
    return user


def _service(name_fragment):
    service = Service.objects.filter(name__icontains=name_fragment).first() or Service.objects.first()
    if service:
        return service
    shop = Barbershop.objects.first()
    if shop is None:
        raise RuntimeError('Aucun salon ni service en base.')
    return Service.objects.create(name='Signature WilloBarber', price=45, duration=45, barbershop=shop)


def _free_time(day, preferred):
    """Le créneau préféré s'il est libre (contrainte unique date+heure sur les
    réservations actives), sinon le suivant de la grille."""
    taken = set(
        Reservation.objects.filter(date=day, status__in=['pending', 'confirmed']).values_list('time', flat=True)
    )
    grid = slot_times_for(day)
    start = grid.index(preferred) if preferred in grid else 0
    ordered = grid[start:] + grid[:start]
    for hhmm in ordered:
        t = time.fromisoformat(hhmm)
        if t not in taken:
            return t
    raise RuntimeError(f'Aucun créneau libre le {day}.')


def _past_reservation(user, service, day, preferred):
    return Reservation(
        user=user, service=service, date=day, time=_free_time(day, preferred),
        status='confirmed', payment_status='paid_onsite', payment_method='card',
        amount_paid=service.price, checked_in=True,
    )


class Command(BaseCommand):
    help = (
        "Crée demo_regular (5 RDV réguliers, tous les 28 jours le samedi à 14h) et "
        "demo_irregular (1 RDV il y a 52 jours) pour valider les deux moteurs de recommandation."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        today = salon_now().date()

        # Dernière visite = un samedi entre J-31 et J-25 → visite suivante attendue
        # entre J-3 et J+3 : la tâche quotidienne enverra bien une recommandation.
        last_visit = today - timedelta(days=25)
        while last_visit.weekday() != 5:
            last_visit -= timedelta(days=1)

        regular = _get_or_create_user('demo_regular', 'Rayan', 'Habitué')
        signature = _service('signature')
        # bulk_create : pas de signal post_save → aucune notification « Nouveau
        # rendez-vous » parasite chez le coiffeur pour ces RDV fictifs passés.
        Reservation.objects.bulk_create([
            _past_reservation(regular, signature, last_visit - timedelta(days=REGULAR_INTERVAL_DAYS * i), '14:00')
            for i in range(REGULAR_VISITS)
        ])

        irregular = _get_or_create_user('demo_irregular', 'Sami', 'Occasionnel')
        express = _service('express')
        Reservation.objects.bulk_create([
            _past_reservation(irregular, express, today - timedelta(days=IRREGULAR_DAYS_AGO), '11:00'),
        ])

        self.stdout.write(self.style.SUCCESS(
            f"demo_regular   : {REGULAR_VISITS} visites ({signature.name}), dernière le {last_visit}\n"
            f"demo_irregular : 1 visite ({express.name}) il y a {IRREGULAR_DAYS_AGO} jours\n"
            f"Mot de passe   : {PASSWORD}"
        ))
