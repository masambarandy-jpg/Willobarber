# Grille horaire du salon, partagée par available_slots (views.py) et le moteur
# de recommandations (recommendations.py).
#
# Créneaux proposés côté client (cf. SLOT_GROUPS dans mobile/components/booking/data.ts) —
# tenus en phase manuellement, le salon n'ayant qu'un seul barbier donc pas de agenda par
# ressource à interroger dynamiquement.
SLOT_TIMES = [
    '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
]

# Fin de service au plus tard à 21h (CLOSING_MINUTES côté mobile).
CLOSING_MINUTES = 21 * 60

# Lundi fermé (cf. isWeekdayClosed dans Step3Date.tsx) — datetime.weekday() : lundi = 0.
CLOSED_WEEKDAYS = {0}


def hhmm_to_minutes(hhmm):
    h, m = hhmm.split(':')
    return int(h) * 60 + int(m)


def slot_fits_before_closing(hhmm, duration_minutes):
    return hhmm_to_minutes(hhmm) + (duration_minutes or 0) <= CLOSING_MINUTES
