from datetime import date

from django.core.management.base import BaseCommand

from core.models import ClosedPeriod

BELGIAN_HOLIDAYS_2026 = [
    (date(2026, 1, 1), "Jour férié - Nouvel An"),
    (date(2026, 4, 6), "Jour férié - Lundi de Pâques"),
    (date(2026, 5, 1), "Jour férié - Fête du Travail"),
    (date(2026, 5, 14), "Jour férié - Ascension"),
    (date(2026, 5, 25), "Jour férié - Lundi de Pentecôte"),
    (date(2026, 7, 21), "Jour férié - Fête nationale"),
    (date(2026, 8, 15), "Jour férié - Assomption"),
    (date(2026, 11, 1), "Jour férié - Toussaint"),
    (date(2026, 11, 11), "Jour férié - Armistice"),
    (date(2026, 12, 25), "Jour férié - Noël"),
]


class Command(BaseCommand):
    help = "Charge les jours fériés belges 2026 comme périodes de fermeture."

    def handle(self, *args, **options):
        created_count = 0
        for holiday_date, reason in BELGIAN_HOLIDAYS_2026:
            _, created = ClosedPeriod.objects.get_or_create(
                start_date=holiday_date,
                end_date=holiday_date,
                reason=reason,
            )
            if created:
                created_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Jours fériés belges 2026 : {created_count} créés, "
            f"{len(BELGIAN_HOLIDAYS_2026) - created_count} déjà présents."
        ))
