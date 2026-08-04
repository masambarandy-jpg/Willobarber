from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import ClosedPeriod

# Jours fériés belges à date fixe.
JOURS_FERIES_FIXES = [
    ("01-01", "Jour férié - Nouvel An"),
    ("05-01", "Jour férié - Fête du Travail"),
    ("07-21", "Jour férié - Fête nationale"),
    ("08-15", "Jour férié - Assomption"),
    ("11-01", "Jour férié - Toussaint"),
    ("11-11", "Jour férié - Armistice"),
    ("12-25", "Jour férié - Noël"),
]

# Libellés alignés sur load_belgian_holidays.py pour rester idempotent avec
# cette commande existante (get_or_create matche sur start_date+end_date+reason).
JOURS_FERIES_MOBILES = [
    (1, "Jour férié - Lundi de Pâques"),
    (39, "Jour férié - Ascension"),
    (50, "Jour férié - Lundi de Pentecôte"),
]


def compute_easter(year: int) -> date:
    """Algorithme de Meeus/Jones/Butcher (calendrier grégorien)."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def holidays_for_year(year: int):
    for mmdd, reason in JOURS_FERIES_FIXES:
        month, day = map(int, mmdd.split('-'))
        yield date(year, month, day), reason

    easter = compute_easter(year)
    for offset, reason in JOURS_FERIES_MOBILES:
        yield easter + timedelta(days=offset), reason


class Command(BaseCommand):
    help = (
        "Génère les jours fériés belges (fixes + mobiles calculés depuis Pâques) "
        "pour l'année en cours et l'année suivante, sans doublon."
    )

    def handle(self, *args, **options):
        current_year = timezone.now().year
        created_count = 0
        total = 0

        for year in (current_year, current_year + 1):
            for holiday_date, reason in holidays_for_year(year):
                total += 1
                _, created = ClosedPeriod.objects.get_or_create(
                    start_date=holiday_date,
                    end_date=holiday_date,
                    reason=reason,
                )
                if created:
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Jours fériés belges {current_year}-{current_year + 1} : "
            f"{created_count} créés, {total - created_count} déjà présents."
        ))
