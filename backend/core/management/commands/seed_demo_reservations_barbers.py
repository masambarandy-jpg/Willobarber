"""RDV de démo pour Willo, Malik et Idris sur la semaine en cours (démo TFE).

Usage : python manage.py seed_demo_reservations_barbers

Charges volontairement très différentes d'un barbier à l'autre pour que la
rangée « DISPONIBILITÉ — SEMAINE » de l'écran Équipe montre à l'œil nu que
l'agenda est bien par barbier.

Idempotent : les RDV de démo de la semaine (client DEMO_EMAIL uniquement,
jamais un vrai client) sont supprimés puis recréés. Un créneau déjà pris par
un vrai RDV est remplacé par le premier créneau libre du même jour.
bulk_create volontaire : pas de signal post_save, donc ni notification
« Nouveau rendez-vous » ni événement SSE chez le coiffeur pour ces RDV fictifs.
"""
from datetime import time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import BarberLeave, ClosedPeriod, Reservation, Service, User
from core.recommendations import salon_now
from core.slots import day_hours, slot_times_for

DEMO_USERNAME = 'demo_regular'
# Même e-mail que seed_reco_demo : seul critère de suppression des RDV de démo.
DEMO_EMAIL = 'demo_regular@willobarber.test'
ACTIVE = ['pending', 'confirmed']

# Jour de la semaine (0 = lundi, fermé) → heures de début.
# Willo 18 RDV, Malik 6, Idris 7.
PLAN = {
    'Willo': {
        1: ['12:00', '17:30'],
        2: ['15:30'],
        3: ['11:30'],
        5: ['11:00', '12:00', '13:30', '14:30', '15:30', '17:00', '18:30', '19:30'],
        6: ['11:30', '13:00', '14:30', '16:00', '17:30', '19:00'],
    },
    'Malik': {
        1: ['12:30'],
        3: ['16:30'],
        5: ['11:30', '15:00', '18:00'],
        6: ['14:00'],
    },
    'Idris': {
        2: ['14:00'],
        5: ['13:00'],
        6: ['11:00', '12:30', '15:00', '17:00', '18:30'],
    },
}


class Command(BaseCommand):
    help = 'Crée des RDV de démo différenciés pour Willo, Malik et Idris sur la semaine en cours.'

    def handle(self, *args, **options):
        services = list(Service.objects.order_by('id'))
        if not services:
            self.stderr.write('Aucun service en base : rien à créer.')
            return

        today = salon_now().date()
        monday = today - timedelta(days=today.weekday())
        week = (monday, monday + timedelta(days=6))

        with transaction.atomic():
            client = self._demo_client()
            deleted, _ = Reservation.objects.filter(
                user__email=DEMO_EMAIL, barber__in=PLAN, date__range=week,
            ).delete()

            to_create = []
            for barber, days in PLAN.items():
                for weekday, wanted in days.items():
                    day = monday + timedelta(days=weekday)
                    if self._closed(barber, day):
                        continue
                    for hhmm in self._pick_slots(barber, day, wanted):
                        to_create.append(Reservation(
                            user=client, service=services[len(to_create) % len(services)],
                            barber=barber, date=day, time=time.fromisoformat(hhmm), status='confirmed',
                        ))
            Reservation.objects.bulk_create(to_create)

        self.stdout.write(f'{deleted} ancien(s) RDV de démo supprimé(s)')
        for barber in PLAN:
            n = sum(r.barber == barber for r in to_create)
            self.stdout.write(f'{barber} : {n} RDV créés (semaine du {monday:%d/%m/%Y})')

    def _demo_client(self):
        client, created = User.objects.get_or_create(
            username=DEMO_USERNAME,
            defaults={'email': DEMO_EMAIL, 'first_name': 'Démo', 'last_name': 'Régulier', 'role': 'client'},
        )
        if created:
            client.set_unusable_password()
            client.save()
        return client

    def _pick_slots(self, barber, day, wanted):
        """Heures voulues, sauf celles déjà prises par un vrai RDV : remplacées
        par les premiers créneaux libres du jour (le total reste exact)."""
        taken = {
            t.strftime('%H:%M') for t in Reservation.objects
            .filter(barber=barber, date=day, status__in=ACTIVE).values_list('time', flat=True)
        }
        picked = [h for h in wanted if h not in taken]
        spare = (s for s in slot_times_for(day) if s not in taken and s not in picked)
        picked += [s for _, s in zip(range(len(wanted) - len(picked)), spare)]
        return picked

    def _closed(self, barber, day):
        return (
            day_hours(day) is None
            or ClosedPeriod.objects.filter(start_date__lte=day, end_date__gte=day).exists()
            or BarberLeave.objects.filter(barber=barber, start_date__lte=day, end_date__gte=day).exists()
        )
