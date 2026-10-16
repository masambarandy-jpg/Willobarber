# Grille horaire du salon, partagée par available_slots / barbers_week_availability
# (views.py) et le moteur de recommandations (recommendations.py).
#
# Elle découle des horaires hebdomadaires (modèle OpeningHours, réglés par le
# coiffeur dans Paramètres › Établissement) : un créneau toutes les 30 min, de
# l'ouverture à la dernière demi-heure avant la fermeture. Le mobile affiche la
# grille renvoyée par /api/slots/available/ (cf. Step3Date.tsx).
from .models import OpeningHours

SLOT_STEP_MINUTES = 30

# Repli si un jour n'a pas (encore) de ligne OpeningHours — mêmes valeurs que la
# migration initiale : 11h – 21h, lundi fermé (datetime.weekday() : lundi = 0).
DEFAULT_OPEN_MINUTES = 11 * 60
DEFAULT_CLOSE_MINUTES = 21 * 60
DEFAULT_CLOSED_WEEKDAYS = {0}


def hhmm_to_minutes(hhmm):
    h, m = hhmm.split(':')
    return int(h) * 60 + int(m)


def minutes_to_hhmm(minutes):
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _time_to_minutes(t, closing=False):
    minutes = t.hour * 60 + t.minute
    # Fermeture à 00:00 = minuit.
    return 24 * 60 if closing and minutes == 0 else minutes


def weekly_hours():
    """{weekday: (ouverture, fermeture) en minutes, ou None si fermé}."""
    hours = {
        wd: None if wd in DEFAULT_CLOSED_WEEKDAYS else (DEFAULT_OPEN_MINUTES, DEFAULT_CLOSE_MINUTES)
        for wd in range(7)
    }
    for h in OpeningHours.objects.all():
        hours[h.weekday] = None if h.is_closed else (
            _time_to_minutes(h.open_time), _time_to_minutes(h.close_time, closing=True),
        )
    return hours


def day_hours(d, hours=None):
    return (weekly_hours() if hours is None else hours)[d.weekday()]


def slot_times_for(d, hours=None):
    """Créneaux (« HH:MM ») du jour d ; liste vide si le salon est fermé ce jour-là."""
    span = day_hours(d, hours)
    if not span:
        return []
    open_minutes, close_minutes = span
    return [
        minutes_to_hhmm(m)
        for m in range(open_minutes, close_minutes - SLOT_STEP_MINUTES + 1, SLOT_STEP_MINUTES)
    ]


def slot_within_hours(d, hhmm, duration_minutes, hours=None):
    """True si une prestation de duration_minutes commencée à hhmm le jour d
    tient dans les horaires d'ouverture."""
    span = day_hours(d, hours)
    if not span:
        return False
    start = hhmm_to_minutes(hhmm)
    return span[0] <= start and start + (duration_minutes or 0) <= span[1]
