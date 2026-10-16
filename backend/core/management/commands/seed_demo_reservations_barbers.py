"""RDV de démo pour Malik et Idris sur la semaine en cours (démo TFE).

Usage : python manage.py seed_demo_reservations_barbers

Idempotent : un créneau déjà pris pour ce barbier est simplement sauté.
bulk_create volontaire : pas de signal post_save, donc ni notification
« Nouveau rendez-vous » ni événement SSE chez le coiffeur pour ces RDV fictifs.
"""
from datetime import time, timedelta

from django.core.management.base import BaseCommand

from core.models import BarberLeave, ClosedPeriod, Reservation, Service, User
from core.recommendations import salon_now
from core.slots import CLOSED_WEEKDAYS

DEMO_CLIENT = 'demo_regular'
# Créneaux répartis sur la semaine (jour de la semaine → heure), décalés entre
# barbiers pour que le planning « Tous » reste lisible.
PLAN = {
    'Malik': [(1, '11:00'), (2, '14:30'), (3, '16:00'), (4, '12:30'), (5, '15:00'), (5, '18:30'), (6, '13:00')],
    'Idris': [(1, '13:30'), (2, '11:30'), (3, '18:00'), (4, '17:00'), (5, '11:00'), (6, '16:30'), (6, '19:00')],
}


class Command(BaseCommand):
    help = 'Crée des RDV de démo pour Malik et Idris sur la semaine en cours.'

    def handle(self, *args, **options):
        client = self._demo_client()
        services = list(Service.objects.order_by('id')[:4])
        if not services:
            self.stderr.write('Aucun service en base : rien à créer.')
            return

        today = salon_now().date()
        monday = today - timedelta(days=today.weekday())
        to_create = []
        for barber, slots in PLAN.items():
            for i, (weekday, hhmm) in enumerate(slots):
                day = monday + timedelta(days=weekday)
                slot = time.fromisoformat(hhmm)
                if self._closed(barber, day) or Reservation.objects.filter(
                    barber=barber, date=day, time=slot, status__in=['pending', 'confirmed'],
                ).exists():
                    continue
                to_create.append(Reservation(
                    user=client, service=services[i % len(services)], barber=barber,
                    date=day, time=slot, status='confirmed',
                ))

        Reservation.objects.bulk_create(to_create)
        for barber in PLAN:
            n = sum(r.barber == barber for r in to_create)
            self.stdout.write(f'{barber} : {n} RDV créés (semaine du {monday:%d/%m/%Y})')

    def _demo_client(self):
        client, created = User.objects.get_or_create(
            username=DEMO_CLIENT,
            defaults={'email': f'{DEMO_CLIENT}@willobarber.test', 'first_name': 'Démo', 'last_name': 'Régulier', 'role': 'client'},
        )
        if created:
            client.set_unusable_password()
            client.save()
        return client

    def _closed(self, barber, day):
        return (
            day.weekday() in CLOSED_WEEKDAYS
            or ClosedPeriod.objects.filter(start_date__lte=day, end_date__gte=day).exists()
            or BarberLeave.objects.filter(barber=barber, start_date__lte=day, end_date__gte=day).exists()
        )
