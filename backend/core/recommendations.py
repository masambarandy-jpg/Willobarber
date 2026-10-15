"""Recommandations v1 — 100 % algorithmique, aucun appel LLM.

Deux moteurs :
- « regular » : le client a des habitudes (≥ 3 visites) → on calcule son
  intervalle moyen, sa prestation / son jour / son heure favoris, la date de
  sa prochaine visite attendue, et on lui propose des créneaux libres.
- « seasonal » : le client ne vient plus depuis plus de 45 jours et n'a aucun
  RDV à venir → simple rappel, sans pré-sélection.

Les dates de Reservation (date/time) sont naïves, en heure du salon : tous les
calculs « aujourd'hui / maintenant » se font donc en Europe/Brussels, et non en
UTC (TIME_ZONE du projet).
"""
from collections import Counter
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from . import sse
from .emails import JOURS_FR, format_date_fr
from .models import ClosedPeriod, Notification, Reservation, User
from .serializers import NotificationSerializer
from .slots import CLOSED_WEEKDAYS, SLOT_TIMES, hhmm_to_minutes, slot_fits_before_closing

SALON_TZ = ZoneInfo('Europe/Brussels')

ACTIVE_STATUSES = ('pending', 'confirmed')
# Une visite annulée ou manquée ne dit rien des habitudes du client.
NON_VISIT_STATUSES = ('cancelled', 'cancelled_client', 'no_show')

HIGH_CONFIDENCE_VISITS = 5
MEDIUM_CONFIDENCE_VISITS = 3
SEASONAL_REMINDER_DAYS = 45
RECO_WINDOW_DAYS = 3
RECO_COOLDOWN = timedelta(days=7)

# Fenêtre de recherche des créneaux autour de la date idéale : assez large pour
# que « Voir d'autres créneaux » ait toujours de nouvelles propositions.
SEARCH_DAYS_BEFORE = 3
SEARCH_DAYS_AFTER = 28
# Au-delà de ±2h on ne parle plus du « même créneau » décalé.
MAX_SHIFT_MINUTES = 120

TIER_SAME_DAY = 'same_day'
TIER_ADJACENT_DAY = 'adjacent_day'
TIER_NEXT_WEEK = 'next_week'
TIER_OTHER = 'other'
# Une alternative de chaque type avant de compléter au meilleur score.
DIVERSIFIED_TIERS = (TIER_SAME_DAY, TIER_ADJACENT_DAY, TIER_NEXT_WEEK)
TIER_BASE_COST = {TIER_SAME_DAY: 0, TIER_ADJACENT_DAY: 4, TIER_NEXT_WEEK: 8, TIER_OTHER: 12}


def salon_now():
    return timezone.now().astimezone(SALON_TZ)


def _upcoming_q(now):
    today = now.date()
    return Q(date__gt=today) | Q(date=today, time__gte=now.time())


def has_upcoming_reservation(user_id, now=None):
    now = now or salon_now()
    return (
        Reservation.objects
        .filter(user_id=user_id, status__in=ACTIVE_STATUSES)
        .filter(_upcoming_q(now))
        .exists()
    )


def _past_visits(user_id, now):
    """Une visite par jour : les RDV enfants (N réservations consécutives le
    même jour) ne doivent compter ni comme N visites, ni comme des intervalles
    de 0 jour. On garde la première réservation de la journée."""
    reservations = (
        Reservation.objects
        .filter(user_id=user_id)
        .exclude(status__in=NON_VISIT_STATUSES)
        .exclude(_upcoming_q(now))
        .select_related('service')
        .order_by('date', 'time')
    )
    visits = {}
    for r in reservations:
        visits.setdefault(r.date, r)
    return list(visits.values())


def _most_common_recent_first(values):
    # À égalité, la valeur la plus récente gagne (habitude actuelle > ancienne).
    return Counter(reversed(values)).most_common(1)[0][0]


def get_client_habits(user_id, now=None):
    """Habitudes du client, sérialisables telles quelles en JSON.

    confidence : 'high' (≥ 5 visites), 'medium' (3-4), None (< 3 : pas assez
    de données pour parler d'habitude)."""
    now = now or salon_now()
    visits = _past_visits(user_id, now)
    habits = {
        'visits_count': len(visits),
        'last_visit_date': None,
        'days_since_last_visit': None,
        'avg_interval_days': None,
        'favorite_service': None,
        'favorite_weekday': None,
        'favorite_weekday_label': None,
        'favorite_time': None,
        'favorite_hour': None,
        'next_expected_date': None,
        'confidence': None,
    }
    if not visits:
        return habits

    last = visits[-1]
    habits['last_visit_date'] = last.date.isoformat()
    habits['days_since_last_visit'] = (now.date() - last.date).days

    if len(visits) >= 2:
        intervals = [(b.date - a.date).days for a, b in zip(visits, visits[1:])]
        avg_interval = round(sum(intervals) / len(intervals))
        habits['avg_interval_days'] = avg_interval
        habits['next_expected_date'] = (last.date + timedelta(days=avg_interval)).isoformat()

    services = {v.service_id: v.service for v in visits}
    fav_service = services[_most_common_recent_first([v.service_id for v in visits])]
    habits['favorite_service'] = {
        'id': fav_service.id,
        'name': fav_service.name,
        'price': float(fav_service.price),
        'duration': fav_service.duration,
    }

    fav_weekday = _most_common_recent_first([v.date.weekday() for v in visits])
    habits['favorite_weekday'] = fav_weekday
    habits['favorite_weekday_label'] = JOURS_FR[fav_weekday]

    fav_time = _most_common_recent_first([v.time.strftime('%H:%M') for v in visits])
    habits['favorite_time'] = fav_time
    habits['favorite_hour'] = int(fav_time[:2])

    if len(visits) >= HIGH_CONFIDENCE_VISITS:
        habits['confidence'] = 'high'
    elif len(visits) >= MEDIUM_CONFIDENCE_VISITS:
        habits['confidence'] = 'medium'
    return habits


def _closed_dates(start, end):
    closed = set()
    for period in ClosedPeriod.objects.filter(start_date__lte=end, end_date__gte=start):
        d = max(period.start_date, start)
        while d <= min(period.end_date, end):
            closed.add(d)
            d += timedelta(days=1)
    return closed


def _is_open(d, closed_dates):
    return d.weekday() not in CLOSED_WEEKDAYS and d not in closed_dates


def ideal_target_date(habits, now=None):
    """Date idéale du prochain RDV : la date attendue (dernière visite +
    intervalle moyen), jamais avant demain, recalée sur le jour favori du client
    s'il tombe à ±3 jours, puis décalée au prochain jour d'ouverture."""
    now = now or salon_now()
    earliest = now.date() + timedelta(days=1)
    base = max(date.fromisoformat(habits['next_expected_date']), earliest)

    fav_weekday = habits.get('favorite_weekday')
    target = base
    if fav_weekday is not None and fav_weekday not in CLOSED_WEEKDAYS:
        nearby = [
            base + timedelta(days=offset)
            for offset in range(-3, 4)
            if (base + timedelta(days=offset)).weekday() == fav_weekday
            and base + timedelta(days=offset) >= earliest
        ]
        if nearby:
            target = min(nearby, key=lambda d: abs((d - base).days))
        else:
            # Le jour favori « le plus proche » est déjà passé : le suivant.
            target = base + timedelta(days=(fav_weekday - base.weekday()) % 7)

    closed_dates = _closed_dates(target, target + timedelta(days=SEARCH_DAYS_AFTER))
    while not _is_open(target, closed_dates):
        target += timedelta(days=1)
    return target


def _tier(day_delta, minute_delta):
    shifted = abs(minute_delta) <= MAX_SHIFT_MINUTES
    if day_delta == 0 and shifted:
        return TIER_SAME_DAY
    if abs(day_delta) == 1 and shifted:
        return TIER_ADJACENT_DAY
    if day_delta == 7 and shifted:
        return TIER_NEXT_WEEK
    return TIER_OTHER


def _cost(tier, day_delta, minute_delta, d, fav_weekday):
    cost = TIER_BASE_COST[tier] + abs(minute_delta) / 30
    if tier == TIER_OTHER:
        cost += abs(day_delta)
        if d.weekday() != fav_weekday:
            cost += 3
    return cost


def _format_shift(minute_delta):
    minutes = abs(minute_delta)
    h, m = divmod(minutes, 60)
    label = f"{h}h{m:02d}" if h and m else (f"{h}h" if h else f"{m} min")
    return f"{label} plus {'tôt' if minute_delta < 0 else 'tard'}"


def _reason(tier, day_delta, minute_delta):
    shift = '' if minute_delta == 0 else _format_shift(minute_delta)
    if tier == TIER_SAME_DAY:
        return f"Même jour, {shift}"
    if tier == TIER_ADJACENT_DAY:
        day = 'Le lendemain' if day_delta > 0 else 'La veille'
        return f"{day}, {shift or 'même heure'}"
    if tier == TIER_NEXT_WEEK:
        return f"Semaine suivante, {shift or 'même heure'}"
    return 'Autre date proche'


def slot_key(d, hhmm):
    return f"{d.isoformat() if isinstance(d, date) else d}T{hhmm}"


def suggest_slots(user_id, habits, exclude_slots=None, now=None, count=3):
    """Créneau idéal (is_preferred=True, s'il est libre et pas exclu) + `count`
    alternatives : d'abord une de chaque type (même jour ±2h, veille/lendemain,
    semaine suivante), puis complétées par les meilleurs scores restants.

    exclude_slots : clés « YYYY-MM-DDTHH:MM » déjà vues côté mobile — un
    rafraîchissement ne repropose jamais les mêmes créneaux."""
    if not habits.get('confidence') or not habits.get('next_expected_date'):
        return []
    now = now or salon_now()
    excluded = set(exclude_slots or ())
    earliest = now.date() + timedelta(days=1)

    target = ideal_target_date(habits, now)
    window_start = max(earliest, target - timedelta(days=SEARCH_DAYS_BEFORE))
    window_end = target + timedelta(days=SEARCH_DAYS_AFTER)
    closed_dates = _closed_dates(window_start, window_end)

    service = habits['favorite_service']
    fav_time = habits['favorite_time']
    fav_minutes = hhmm_to_minutes(fav_time)
    fav_weekday = habits['favorite_weekday']

    booked = {
        slot_key(d, t.strftime('%H:%M'))
        for d, t in Reservation.objects
            .filter(date__range=(window_start, window_end), status__in=ACTIVE_STATUSES)
            .values_list('date', 'time')
    }

    def to_slot(d, hhmm, is_preferred, reason):
        return {
            'date': d.isoformat(),
            'time': hhmm,
            'service_id': service['id'],
            'is_preferred': is_preferred,
            'reason': reason,
        }

    slots = []
    ideal_key = slot_key(target, fav_time)
    if (
        ideal_key not in booked and ideal_key not in excluded
        and slot_fits_before_closing(fav_time, service['duration'])
    ):
        slots.append(to_slot(target, fav_time, True, 'Votre créneau habituel'))

    candidates = []
    d = window_start
    while d <= window_end:
        if _is_open(d, closed_dates):
            day_delta = (d - target).days
            for hhmm in SLOT_TIMES:
                key = slot_key(d, hhmm)
                if key == ideal_key or key in booked or key in excluded:
                    continue
                if not slot_fits_before_closing(hhmm, service['duration']):
                    continue
                minute_delta = hhmm_to_minutes(hhmm) - fav_minutes
                tier = _tier(day_delta, minute_delta)
                candidates.append((
                    _cost(tier, day_delta, minute_delta, d, fav_weekday),
                    tier, d, hhmm, _reason(tier, day_delta, minute_delta),
                ))
        d += timedelta(days=1)
    candidates.sort(key=lambda c: (c[0], c[2], c[3]))

    picked = []
    for tier in DIVERSIFIED_TIERS:
        best = next((c for c in candidates if c[1] == tier), None)
        if best and len(picked) < count:
            picked.append(best)
    for c in candidates:
        if len(picked) >= count:
            break
        if c not in picked:
            picked.append(c)

    slots.extend(to_slot(d, hhmm, False, reason) for _, _, d, hhmm, reason in picked)
    return slots


def should_send_seasonal_reminder(user_id, now=None):
    """True si la dernière visite date de plus de 45 jours et qu'aucun RDV
    n'est à venir. Un client qui n'est jamais venu n'est pas concerné."""
    now = now or salon_now()
    last_visit = (
        Reservation.objects
        .filter(user_id=user_id)
        .exclude(status__in=NON_VISIT_STATUSES)
        .exclude(_upcoming_q(now))
        .order_by('-date')
        .values_list('date', flat=True)
        .first()
    )
    if last_visit is None or (now.date() - last_visit).days <= SEASONAL_REMINDER_DAYS:
        return False
    return not has_upcoming_reservation(user_id, now)


def _format_hour(hhmm):
    h, m = hhmm.split(':')
    return f"{int(h)}h" if m == '00' else f"{int(h)}h{m}"


def regular_message(habits, now=None):
    target = ideal_target_date(habits, now)
    return (
        f"Vous venez généralement tous les {habits['avg_interval_days']} jours "
        f"pour {habits['favorite_service']['name']}. "
        f"Prochain créneau idéal : {format_date_fr(target)} à {_format_hour(habits['favorite_time'])}."
    )


def seasonal_message(habits):
    return (
        f"Cela fait {habits['days_since_last_visit']} jours que nous ne vous avons pas vu. "
        "Envie d'un rafraîchissement ? Réservez votre prochain passage chez WilloBarber."
    )


def build_recommendation(user, exclude_slots=None, now=None):
    """Réponse de GET /recommendations/."""
    now = now or salon_now()
    habits = get_client_habits(user.id, now)
    result = {'type': 'none', 'message': None, 'habits': habits, 'suggested_slots': []}

    if not user.ai_recommendations:
        result['message'] = 'Recommandations désactivées.'
        return result
    if has_upcoming_reservation(user.id, now):
        return result

    if habits['confidence']:
        result.update(
            type='regular',
            message=regular_message(habits, now),
            suggested_slots=suggest_slots(user.id, habits, exclude_slots, now),
        )
    elif should_send_seasonal_reminder(user.id, now):
        result.update(type='seasonal', message=seasonal_message(habits))
    return result


def create_client_notification(user, type, title, desc, data):
    notification = Notification.objects.create(user=user, type=type, title=title, desc=desc, data=data)
    payload = NotificationSerializer(notification).data
    transaction.on_commit(lambda: sse.publish_to_client(user.id, 'notification', payload))
    return notification


def _log(user, text):
    print(f"[RECO] user_{user.id} {text}")


def process_user(user, now=None):
    """Envoie au plus une notification au client. Retourne 'recommendation',
    'seasonal_reminder' ou 'skipped'."""
    now = now or salon_now()

    if not user.ai_recommendations:
        _log(user, 'skipped (reco disabled)')
        return 'skipped'
    if user.last_reco_sent_at and timezone.now() - user.last_reco_sent_at < RECO_COOLDOWN:
        _log(user, 'skipped (recent notif)')
        return 'skipped'
    if has_upcoming_reservation(user.id, now):
        _log(user, 'skipped (upcoming rdv)')
        return 'skipped'

    habits = get_client_habits(user.id, now)
    if habits['confidence']:
        days_until = (date.fromisoformat(habits['next_expected_date']) - now.date()).days
        if days_until <= RECO_WINDOW_DAYS:
            slots = suggest_slots(user.id, habits, now=now)
            if slots:
                create_client_notification(
                    user, 'recommendation',
                    title="C'est bientôt l'heure de votre prochaine coupe",
                    desc=regular_message(habits, now),
                    data={'suggested_slots': slots, 'habits': habits},
                )
                user.last_reco_sent_at = timezone.now()
                user.save(update_fields=['last_reco_sent_at'])
                _log(user, f"habits={habits['confidence']} next={habits['next_expected_date']} "
                           f"slots={len(slots)} → notif sent")
                return 'recommendation'

    if should_send_seasonal_reminder(user.id, now):
        create_client_notification(
            user, 'seasonal_reminder',
            title='Vous nous manquez',
            desc=seasonal_message(habits),
            data={'days_since_last_visit': habits['days_since_last_visit']},
        )
        user.last_reco_sent_at = timezone.now()
        user.save(update_fields=['last_reco_sent_at'])
        habits_label = f"habits={habits['confidence']}" if habits['confidence'] else 'no habits'
        _log(user, f"{habits_label}, last_rdv={habits['days_since_last_visit']}d → seasonal_reminder sent")
        return 'seasonal_reminder'

    _log(user, f"habits={habits['confidence']} next={habits['next_expected_date']} → nothing to send")
    return 'skipped'


def run_daily_recommendations(now=None):
    """Tâche quotidienne (POST /tasks/run-recommendations/, via cron-job.org)."""
    now = now or salon_now()
    summary = {'recommendation': 0, 'seasonal_reminder': 0, 'skipped': 0}
    clients = (
        User.objects
        .filter(role='client', is_active=True, is_deleted=False, reservation__isnull=False)
        .distinct()
        .order_by('id')
    )
    for user in clients:
        summary[process_user(user, now)] += 1
    print(f"[RECO] run terminé : {summary}")
    return summary
