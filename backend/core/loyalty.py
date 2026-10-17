"""Points fidélité gagnés par réservation — même calcul à l'attribution
(création du RDV), au retrait (annulation) et dans l'historique de l'app."""

# Coupe enfant : forfait fixe par enfant (chaque enfant d'un groupe a sa
# propre réservation, cf. book.tsx), et non 2 pts/€ comme les adultes.
CHILD_CUT_POINTS = 10
POINTS_PER_EURO = 2


def reservation_points(reservation):
    service = reservation.service
    if service.category == 'enfant':
        return CHILD_CUT_POINTS
    return int(round(service.price * POINTS_PER_EURO))
