JOURS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
MOIS_FR = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]


def format_date_fr(date):
    """Ex: "Jeudi 30 juillet 2026\""""
    return f"{JOURS_FR[date.weekday()]} {date.day} {MOIS_FR[date.month - 1]} {date.year}"


def format_heure_fr(time):
    """Ex: "10h30\""""
    return f"{time.hour}h{str(time.minute).zfill(2)}"
