import random
from datetime import date, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Reservation, Service, User

FAKE_CLIENTS = [
    ("thomas.martin@gmail.com", "Thomas", "Martin"),
    ("lucas.bernard@gmail.com", "Lucas", "Bernard"),
    ("hugo.dubois@gmail.com", "Hugo", "Dubois"),
    ("nathan.petit@gmail.com", "Nathan", "Petit"),
    ("mathieu.moreau@gmail.com", "Mathieu", "Moreau"),
    ("antoine.simon@gmail.com", "Antoine", "Simon"),
    ("kevin.laurent@gmail.com", "Kevin", "Laurent"),
    ("alexis.michel@gmail.com", "Alexis", "Michel"),
    ("romain.lefevre@gmail.com", "Romain", "Lefevre"),
    ("julien.garcia@gmail.com", "Julien", "Garcia"),
]

PASSWORD = "Test1234!"

PAST_START = date(2026, 5, 1)
PAST_END = date(2026, 7, 31)

SLOT_HOURS = list(range(9, 18))
SLOT_MINUTES = [0, 30]


def random_past_date():
    delta_days = (PAST_END - PAST_START).days
    return PAST_START + timedelta(days=random.randint(0, delta_days))


def random_slot_time():
    return time(hour=random.choice(SLOT_HOURS), minute=random.choice(SLOT_MINUTES))


def random_phone():
    digits = "".join(str(random.randint(0, 9)) for _ in range(8))
    return f"+336{digits}"


class Command(BaseCommand):
    help = "Crée 10 clients fictifs avec des réservations passées (données de démo)."

    @transaction.atomic
    def handle(self, *args, **options):
        services = list(Service.objects.all())
        if not services:
            self.stderr.write(self.style.ERROR(
                "Aucun service en base : impossible de créer des réservations."
            ))
            return

        clients_created = 0
        reservations_created = 0

        for email, first_name, last_name in FAKE_CLIENTS:
            if User.objects.filter(email=email).exists():
                self.stdout.write(self.style.WARNING(f"Déjà existant, ignoré : {email}"))
                continue

            user = User.objects.create_user(
                username=email,
                email=email,
                password=PASSWORD,
                first_name=first_name,
                last_name=last_name,
                phone=random_phone(),
                role="client",
            )
            clients_created += 1

            nb_reservations = random.randint(3, 8)
            for _ in range(nb_reservations):
                Reservation.objects.create(
                    user=user,
                    service=random.choice(services),
                    date=random_past_date(),
                    time=random_slot_time(),
                    status="completed",
                )
                reservations_created += 1

        self.stdout.write(self.style.SUCCESS(
            f"{clients_created} clients créés, {reservations_created} réservations créées."
        ))
