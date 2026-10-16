from datetime import date, datetime, time, timedelta
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

import stripe

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Barbershop, BarberLeave, ClosedPeriod, Notification, OpeningHours, Reservation, Service, User
from .recommendations import (
    SALON_TZ, get_client_habits, process_user, should_send_seasonal_reminder, suggest_slots,
)

# Jeudi 15 octobre 2026, 10h à Bruxelles.
NOW = datetime(2026, 10, 15, 10, 0, tzinfo=SALON_TZ)


class RecommendationEngineTests(TestCase):
    def setUp(self):
        owner = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=owner)
        self.service = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        self.user = User.objects.create_user('client', role='client')

    def visit(self, d, hhmm='14:00', status='confirmed', user=None):
        return Reservation.objects.create(
            user=user or self.user, service=self.service, date=d, time=time.fromisoformat(hhmm), status=status,
        )

    def regular_history(self, visits=5):
        # Samedis tous les 28 jours, dernier le 19/09 → prochain attendu le 17/10.
        for i in range(visits):
            self.visit(date(2026, 9, 19) - timedelta(days=28 * i))

    def test_habits_high_confidence(self):
        self.regular_history()
        habits = get_client_habits(self.user.id, NOW)
        self.assertEqual(habits['confidence'], 'high')
        self.assertEqual(habits['avg_interval_days'], 28)
        self.assertEqual(habits['favorite_weekday'], 5)
        self.assertEqual(habits['favorite_time'], '14:00')
        self.assertEqual(habits['next_expected_date'], '2026-10-17')

    def test_confidence_thresholds(self):
        self.regular_history(visits=2)
        self.assertIsNone(get_client_habits(self.user.id, NOW)['confidence'])
        self.visit(date(2026, 6, 27))
        self.assertEqual(get_client_habits(self.user.id, NOW)['confidence'], 'medium')

    def test_cancelled_and_child_reservations_are_not_extra_visits(self):
        self.regular_history(visits=3)
        self.visit(date(2026, 9, 19), '14:30')  # 2e enfant, même jour
        self.visit(date(2026, 9, 5), status='cancelled_client')
        habits = get_client_habits(self.user.id, NOW)
        self.assertEqual(habits['visits_count'], 3)
        self.assertEqual(habits['avg_interval_days'], 28)

    def test_ideal_slot_then_alternatives_of_each_tier(self):
        self.regular_history()
        slots = suggest_slots(self.user.id, get_client_habits(self.user.id, NOW), now=NOW)
        self.assertEqual(slots[0], {
            'date': '2026-10-17', 'time': '14:00', 'service_id': self.service.id,
            'is_preferred': True, 'reason': 'Votre créneau habituel',
        })
        self.assertEqual([s['date'] for s in slots[1:]], ['2026-10-17', '2026-10-16', '2026-10-24'])

    def test_taken_ideal_slot_is_not_preferred(self):
        self.regular_history()
        self.visit(date(2026, 10, 17), user=User.objects.create_user('other'))
        slots = suggest_slots(self.user.id, get_client_habits(self.user.id, NOW), now=NOW)
        self.assertFalse(any(s['is_preferred'] for s in slots))
        self.assertNotIn(('2026-10-17', '14:00'), [(s['date'], s['time']) for s in slots])

    def test_closed_period_moves_target(self):
        self.regular_history()
        ClosedPeriod.objects.create(start_date=date(2026, 10, 17), end_date=date(2026, 10, 17), reason='Congé')
        slots = suggest_slots(self.user.id, get_client_habits(self.user.id, NOW), now=NOW)
        self.assertNotIn('2026-10-17', [s['date'] for s in slots])
        self.assertNotIn(0, [date.fromisoformat(s['date']).weekday() for s in slots])  # lundi fermé

    def test_exclude_slots_never_repeats(self):
        self.regular_history()
        habits = get_client_habits(self.user.id, NOW)
        seen = set()
        for _ in range(6):
            keys = {f"{s['date']}T{s['time']}" for s in suggest_slots(self.user.id, habits, list(seen), NOW)}
            self.assertEqual(len(keys), 3 if seen else 4)
            self.assertFalse(keys & seen)
            seen |= keys

    def test_seasonal_reminder(self):
        self.visit(date(2026, 8, 24))  # 52 jours
        self.assertTrue(should_send_seasonal_reminder(self.user.id, NOW))
        self.visit(date(2026, 11, 2), '15:00')  # RDV à venir
        self.assertFalse(should_send_seasonal_reminder(self.user.id, NOW))

    def test_process_user_sends_once_per_week(self):
        self.regular_history()
        self.assertEqual(process_user(self.user, NOW), 'recommendation')
        notif = Notification.objects.get(user=self.user)
        self.assertEqual(notif.type, 'recommendation')
        self.assertEqual(len(notif.data['suggested_slots']), 4)
        self.user.refresh_from_db()
        self.assertEqual(process_user(self.user, NOW), 'skipped')

    def test_process_user_respects_toggle(self):
        self.regular_history()
        self.user.ai_recommendations = False
        self.assertEqual(process_user(self.user, NOW), 'skipped')
        self.assertFalse(Notification.objects.filter(user=self.user).exists())


class RecommendationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('client', role='client')
        self.staff = User.objects.create_user('willo', role='admin')

    @override_settings(CRON_TOKEN='s3cret')
    def test_cron_requires_token(self):
        url = '/api/tasks/run-recommendations/'
        self.assertEqual(self.client.post(url).status_code, 403)
        self.assertEqual(self.client.post(url, HTTP_X_CRON_TOKEN='bad').status_code, 403)
        self.assertEqual(self.client.post(url, HTTP_X_CRON_TOKEN='s3cret').status_code, 200)

    def test_client_and_staff_notifications_are_separate(self):
        Notification.objects.create(type='rdv', title='coiffeur', desc='')
        Notification.objects.create(user=self.user, type='invoice', title='client', desc='')
        self.client.force_authenticate(self.staff)
        self.assertEqual([n['title'] for n in self.client.get('/api/notifications/').json()], ['coiffeur'])
        self.client.force_authenticate(self.user)
        self.assertEqual([n['title'] for n in self.client.get('/api/client-notifications/').json()], ['client'])

    def test_recommendations_shape_without_history(self):
        self.client.force_authenticate(self.user)
        data = self.client.get('/api/recommendations/').json()
        self.assertEqual(data['type'], 'none')
        self.assertEqual(data['habits']['visits_count'], 0)
        self.assertEqual(data['suggested_slots'], [])


def _card(pm_id, fingerprint, last4='4242', customer='cus_1'):
    return SimpleNamespace(
        id=pm_id, customer=customer,
        card=SimpleNamespace(brand='visa', last4=last4, exp_month=12, exp_year=2027, fingerprint=fingerprint),
    )


def _intent(status='requires_payment_method'):
    return SimpleNamespace(id='pi_1', client_secret='pi_1_secret', status=status)


@override_settings(STRIPE_SECRET_KEY='sk_test_dummy')
class SavedPaymentMethodTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('client', email='c@x.be', first_name='Ana', role='client')
        self.client.force_authenticate(self.user)

    @patch('core.views.stripe.PaymentIntent.create', return_value=_intent())
    @patch('core.views.stripe.Customer.create', return_value=SimpleNamespace(id='cus_new'))
    def test_first_payment_creates_customer_and_saves_card(self, customer_create, intent_create):
        r = self.client.post('/api/payments/create-payment-intent/', {'amount': 5}, format='json')
        self.assertEqual(r.json()['clientSecret'], 'pi_1_secret')
        self.user.refresh_from_db()
        self.assertEqual(self.user.stripe_customer_id, 'cus_new')
        kwargs = intent_create.call_args.kwargs
        self.assertEqual((kwargs['amount'], kwargs['customer'], kwargs['setup_future_usage']), (500, 'cus_new', 'on_session'))

    @patch('core.views.stripe.PaymentIntent.create', return_value=_intent())
    @patch('core.views.stripe.Customer.create', side_effect=stripe.error.APIConnectionError('down'))
    def test_payment_still_works_without_customer(self, customer_create, intent_create):
        r = self.client.post('/api/payments/create-payment-intent/', {'amount': 45}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertNotIn('customer', intent_create.call_args.kwargs)

    @patch('core.views.stripe.PaymentIntent.create', return_value=_intent('succeeded'))
    @patch('core.views.stripe.PaymentMethod.retrieve', return_value=_card('pm_1', 'fp1'))
    def test_saved_card_is_confirmed_server_side(self, retrieve, intent_create):
        self.user.stripe_customer_id = 'cus_1'
        self.user.save()
        r = self.client.post('/api/payments/create-payment-intent/', {'amount': 5, 'payment_method': 'pm_1'}, format='json')
        self.assertEqual(r.json()['status'], 'succeeded')
        kwargs = intent_create.call_args.kwargs
        self.assertEqual((kwargs['payment_method'], kwargs['off_session'], kwargs['confirm']), ('pm_1', True, True))

    @patch('core.views.stripe.PaymentMethod.retrieve', return_value=_card('pm_1', 'fp1'))
    def test_saved_card_requiring_3ds_returns_client_secret(self, retrieve):
        self.user.stripe_customer_id = 'cus_1'
        self.user.save()
        error = stripe.error.CardError('auth', None, 'authentication_required', json_body={'error': {
            'code': 'authentication_required', 'message': 'auth',
            'payment_intent': {'id': 'pi_3ds', 'client_secret': 'pi_3ds_secret', 'object': 'payment_intent'},
        }})
        with patch('core.views.stripe.PaymentIntent.create', side_effect=error):
            r = self.client.post('/api/payments/create-payment-intent/', {'amount': 5, 'payment_method': 'pm_1'}, format='json')
        self.assertEqual(r.json(), {'clientSecret': 'pi_3ds_secret', 'status': 'requires_action', 'paymentIntentId': 'pi_3ds'})

    @patch('core.views.stripe.PaymentMethod.retrieve', return_value=_card('pm_x', 'fp', customer='cus_other'))
    def test_cannot_pay_with_someone_elses_card(self, retrieve):
        self.user.stripe_customer_id = 'cus_1'
        self.user.save()
        r = self.client.post('/api/payments/create-payment-intent/', {'amount': 5, 'payment_method': 'pm_x'}, format='json')
        self.assertEqual(r.status_code, 404)

    def test_list_is_empty_without_customer(self):
        self.assertEqual(self.client.get('/api/auth/me/payment-methods/').json(), [])

    def _mock_list(self, cards):
        return patch('core.views.stripe.PaymentMethod.list', return_value=SimpleNamespace(auto_paging_iter=lambda: iter(cards)))

    def test_list_dedupes_by_fingerprint_and_delete_detaches_duplicates(self):
        self.user.stripe_customer_id = 'cus_1'
        self.user.save()
        cards = [_card('pm_new', 'fp1'), _card('pm_old', 'fp1'), _card('pm_mc', 'fp2', last4='4444')]
        with self._mock_list(cards):
            listed = self.client.get('/api/auth/me/payment-methods/').json()
        self.assertEqual([c['id'] for c in listed], ['pm_new', 'pm_mc'])
        self.assertEqual(listed[0], {'id': 'pm_new', 'brand': 'visa', 'last4': '4242', 'exp_month': 12, 'exp_year': 2027})
        with self._mock_list(cards), patch('core.views.stripe.PaymentMethod.detach') as detach:
            self.assertEqual(self.client.delete('/api/auth/me/payment-methods/pm_new/').status_code, 204)
            self.assertEqual(self.client.delete('/api/auth/me/payment-methods/pm_unknown/').status_code, 404)
        self.assertEqual([c.args[0] for c in detach.call_args_list], ['pm_new', 'pm_old'])


class SyncThread:
    """Remplace threading.Thread : exécute la cible tout de suite."""

    def __init__(self, target, args=(), kwargs=None, daemon=None):
        self.target, self.args, self.kwargs = target, args, kwargs or {}

    def start(self):
        self.target(*self.args, **self.kwargs)


@override_settings(SENDGRID_API_KEY='SG.test', SENDGRID_FROM_EMAIL='contact@willobarber.be', APP_URL='https://app.willobarber.be/')
@patch('core.emails.threading.Thread', SyncThread)
@patch('core.emails.sendgrid.SendGridAPIClient')
class ReservationEmailTests(TestCase):
    def setUp(self):
        owner = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=owner)
        self.service = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        self.staff = owner
        self.client_user = User.objects.create_user('randy', email='randy@example.com', first_name='Randy')
        self.api = APIClient()
        self.api.force_authenticate(self.client_user)

    def sent(self, sg):
        return [c.args[0].get() for c in sg.return_value.send.call_args_list]

    def book(self, **extra):
        body = {'service': self.service.id, 'date': '2026-11-20', 'time': '15:30',
                'payment_intent_id': 'pi_1', 'amount_paid': 5, **extra}
        with self.captureOnCommitCallbacks(execute=True):
            response = self.api.post('/api/reservations/', body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return Reservation.objects.get(pk=response.data['id'])

    def patch_resa(self, reservation, data, as_user=None):
        self.api.force_authenticate(as_user or self.client_user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.api.patch(f'/api/reservations/{reservation.id}/', data, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    @patch('core.views.send_online_payment_invoice')
    def test_confirmation_email_sent_on_booking(self, _invoice, sg):
        self.book()
        [mail] = self.sent(sg)
        self.assertEqual(mail['subject'], 'Votre rendez-vous WilloBarber est confirmé 💈')
        self.assertEqual(mail['from']['email'], 'contact@willobarber.be')
        self.assertEqual(mail['personalizations'][0]['to'][0]['email'], 'randy@example.com')
        html = mail['content'][0]['value']
        for text in ('Bonjour Randy', 'Signature', 'Willo', 'Vendredi 20 novembre 2026', '15h30',
                     'Rue Auguste Van Zande 78', 'Un acompte de 5 € a été payé via Stripe',
                     'Le solde de 40 € est à régler au salon', '24h', 'https://app.willobarber.be/'):
            self.assertIn(text, html)

    @patch('core.views.send_online_payment_invoice')
    def test_secondary_child_bookings_send_no_duplicate(self, _invoice, sg):
        self.book(child_count=2, amount_paid=10)
        self.book(time='16:00', payment_intent_id='', amount_paid=0, child_count=1)
        [mail] = self.sent(sg)
        self.assertIn('Signature × 2', mail['content'][0]['value'])

    @patch('core.views.send_online_payment_invoice')
    def test_sendgrid_failure_never_blocks_booking(self, _invoice, sg):
        sg.return_value.send.side_effect = RuntimeError('403 sender not verified')
        with self.assertLogs('core.emails', level='ERROR') as logs:
            reservation = self.book()
        self.assertTrue(Reservation.objects.filter(pk=reservation.pk).exists())
        self.assertIn('403 sender not verified', '\n'.join(logs.output))

    @patch('core.views.send_online_payment_invoice')
    def test_reschedule_email_shows_old_and_new_slot(self, _invoice, sg):
        reservation = self.book()
        self.patch_resa(reservation, {'date': '2026-11-27', 'time': '10:00'})
        mail = self.sent(sg)[-1]
        self.assertEqual(mail['subject'], 'Votre rendez-vous WilloBarber a été reprogrammé 💈')
        html = mail['content'][0]['value']
        self.assertIn('Vendredi 20 novembre 2026 · 15h30', html)  # ancien créneau (barré)
        self.assertIn('Vendredi 27 novembre 2026', html)
        self.assertIn('10h00', html)

    @patch('core.views.send_online_payment_invoice')
    def test_cancellation_more_than_24h_mentions_refund(self, _invoice, sg):
        reservation = self.book()
        self.patch_resa(reservation, {'status': 'cancelled_client'})
        mail = self.sent(sg)[-1]
        self.assertEqual(mail['subject'], 'Votre rendez-vous WilloBarber a été annulé')
        self.assertIn('vous sera intégralement remboursé', mail['content'][0]['value'])

    @patch('core.views.send_online_payment_invoice')
    def test_late_cancellation_keeps_deposit(self, _invoice, sg):
        # now + 3h peut tomber hors horaires (ex. lancé le soir) : salon ouvert 24h/24 ici.
        OpeningHours.objects.update(is_closed=False, open_time=time(0), close_time=time(0))
        tomorrow = (datetime.now(SALON_TZ) + timedelta(hours=3))
        reservation = self.book(date=tomorrow.date().isoformat(), time=tomorrow.strftime('%H:00'))
        self.patch_resa(reservation, {'status': 'cancelled_client'})
        self.assertIn("l'acompte de 5 € est conservé", self.sent(sg)[-1]['content'][0]['value'])

    @patch('core.views.send_online_payment_invoice')
    def test_salon_cancellation_apologises_and_refunds(self, _invoice, sg):
        reservation = self.book()
        self.patch_resa(reservation, {'status': 'cancelled'}, as_user=self.staff)
        html = self.sent(sg)[-1]['content'][0]['value']
        self.assertIn('Le salon a dû annuler', html)
        self.assertIn('intégralement remboursé', html)

    @patch('core.views.send_online_payment_invoice')
    def test_staff_payment_update_sends_nothing(self, _invoice, sg):
        reservation = self.book()
        self.patch_resa(reservation, {'payment_status': 'paid_onsite'}, as_user=self.staff)
        self.assertEqual(len(self.sent(sg)), 1)  # seulement la confirmation


@patch('core.views.queue_reservation_email')
class BarberAgendaTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=self.staff)
        self.service = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        self.client_user = User.objects.create_user('randy', email='randy@example.com')
        self.api = APIClient()
        self.api.force_authenticate(self.client_user)
        self.day = '2026-11-20'  # vendredi

    def book(self, barber=None, hhmm='15:30'):
        body = {'service': self.service.id, 'date': self.day, 'time': hhmm}
        if barber:
            body['barber'] = barber
        return self.api.post('/api/reservations/', body, format='json')

    def test_two_barbers_can_take_the_same_slot(self, _mail):
        self.assertEqual(self.book('Willo').status_code, 201)
        self.assertEqual(self.book('Malik').status_code, 201)
        self.assertEqual(self.book('Malik').status_code, 409)

    def test_missing_barber_defaults_to_willo(self, _mail):
        response = self.book()
        self.assertEqual(response.data['barber'], 'Willo')

    def test_available_slots_are_per_barber_and_respect_leave(self, _mail):
        self.book('Malik')
        BarberLeave.objects.create(barber='Idris', start_date=date(2026, 11, 20), end_date=date(2026, 11, 20))

        def free(barber):
            slots = self.api.get('/api/slots/available/', {'date': self.day, 'barber': barber}).data['slots']
            return {s['start_time'] for s in slots if s['is_available']}

        self.assertNotIn('15:30', free('Malik'))
        self.assertIn('15:30', free('Willo'))
        self.assertEqual(free('Idris'), set())
        self.assertEqual(self.api.get('/api/slots/available/', {'date': self.day, 'barber': 'Bob'}).status_code, 400)

    def test_week_availability_counts_free_slots_per_barber(self, _mail):
        self.book('Malik', '15:30')
        self.book('Malik', '16:00')
        self.api.force_authenticate(self.client_user)
        self.assertEqual(self.api.get('/api/barbers/availability/').status_code, 403)

        self.api.force_authenticate(self.staff)
        data = self.api.get('/api/barbers/availability/', {'week_start': '2026-11-16'}).data
        friday = data['barbers']['Malik']['days'][4]
        full_day = 20  # 11:00 → 20:30, horaires par défaut
        self.assertEqual((friday['state'], friday['booked'], friday['free']), ('open', 2, full_day - 2))
        self.assertEqual(data['barbers']['Willo']['days'][4]['free'], full_day)
        self.assertEqual(data['barbers']['Malik']['days'][0]['state'], 'closed')  # lundi
        self.assertEqual(data['barbers']['Malik']['week_rdv'], 2)

    def test_seed_demo_reservations_per_barber(self, _mail):
        from django.core.management import call_command
        from core.recommendations import salon_now
        today = salon_now().date()
        saturday = today - timedelta(days=today.weekday()) + timedelta(days=5)
        # Vrai RDV sur un créneau prévu par le seed : conservé, le seed se décale.
        real = Reservation.objects.create(
            user=self.client_user, service=self.service, barber='Willo', date=saturday, time=time(11, 0), status='confirmed',
        )
        Notification.objects.all().delete()  # notif du vrai RDV ci-dessus
        call_command('seed_demo_reservations_barbers', stdout=StringIO())
        call_command('seed_demo_reservations_barbers', stdout=StringIO())  # idempotent
        demo = Reservation.objects.filter(user__email='demo_regular@willobarber.test')
        self.assertEqual({b: demo.filter(barber=b).count() for b in ('Willo', 'Malik', 'Idris')},
                         {'Willo': 18, 'Malik': 6, 'Idris': 7})
        self.assertEqual(demo.filter(barber='Willo', date=saturday).count(), 8)
        self.assertTrue(Reservation.objects.filter(pk=real.pk, user=self.client_user).exists())
        self.assertFalse(Notification.objects.filter(type='rdv').exists())  # bulk_create : pas de notif coiffeur


@patch('core.views.queue_reservation_email')
class OpeningHoursTests(TestCase):
    """Les horaires réglés côté coiffeur pilotent la grille proposée au client."""

    def setUp(self):
        self.staff = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=self.staff)
        self.service = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        self.client_user = User.objects.create_user('randy', email='randy@example.com')
        self.api = APIClient()
        self.friday = '2026-11-20'
        self.monday = '2026-11-16'

    def slots(self, day):
        return self.api.get('/api/slots/available/', {'date': day, 'barber': 'Willo'}).data

    def put_hours(self, payload, as_user=None):
        self.api.force_authenticate(as_user or self.staff)
        return self.api.put('/api/opening-hours/', payload, format='json')

    def test_seeded_defaults_match_previous_grid(self, _mail):
        data = self.api.get('/api/opening-hours/').data
        self.assertEqual(len(data), 7)
        self.assertEqual(data[0], {'weekday': 0, 'is_closed': True, 'open_time': '11:00', 'close_time': '21:00'})
        friday = [s['start_time'] for s in self.slots(self.friday)['slots']]
        self.assertEqual((friday[0], friday[-1], len(friday)), ('11:00', '20:30', 20))
        self.assertEqual(self.slots(self.monday)['slots'], [])

    def test_only_staff_can_update(self, _mail):
        payload = [{'weekday': 4, 'is_closed': False, 'open_time': '15:00', 'close_time': '18:00'}]
        self.api.force_authenticate(None)
        self.assertEqual(self.api.put('/api/opening-hours/', payload, format='json').status_code, 403)
        self.assertEqual(self.put_hours(payload, as_user=self.client_user).status_code, 403)
        self.assertEqual(OpeningHours.objects.get(weekday=4).open_time, time(11))

    def test_friday_hours_restrict_client_slots(self, _mail):
        response = self.put_hours([{'weekday': 4, 'is_closed': False, 'open_time': '15:00', 'close_time': '18:00'}])
        self.assertEqual(response.status_code, 200, response.data)
        data = self.slots(self.friday)
        self.assertEqual([s['start_time'] for s in data['slots']], ['15:00', '15:30', '16:00', '16:30', '17:00', '17:30'])
        self.assertEqual((data['open_time'], data['close_time'], data['is_closed']), ('15:00', '18:00', False))

    def test_closing_a_day_empties_its_slots(self, _mail):
        self.put_hours([{'weekday': 1, 'is_closed': True}])
        data = self.slots('2026-11-17')  # mardi
        self.assertEqual((data['is_closed'], data['slots']), (True, []))

    def test_reopening_monday(self, _mail):
        self.put_hours([{'weekday': 0, 'is_closed': False, 'open_time': '09:00', 'close_time': '12:00'}])
        self.assertEqual([s['start_time'] for s in self.slots(self.monday)['slots']],
                         ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'])

    def test_invalid_range_is_rejected(self, _mail):
        response = self.put_hours([{'weekday': 4, 'is_closed': False, 'open_time': '18:00', 'close_time': '15:00'}])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(OpeningHours.objects.get(weekday=4).close_time, time(21))
        # 00:00 en fermeture = minuit : accepté.
        self.assertEqual(self.put_hours([{'weekday': 4, 'open_time': '20:00', 'close_time': '00:00'}]).status_code, 200)
        self.assertEqual(self.slots(self.friday)['slots'][-1]['start_time'], '23:30')

    def test_client_cannot_book_outside_hours(self, _mail):
        self.put_hours([{'weekday': 4, 'is_closed': False, 'open_time': '15:00', 'close_time': '18:00'}])
        self.api.force_authenticate(self.client_user)
        book = lambda day, hhmm: self.api.post(
            '/api/reservations/', {'service': self.service.id, 'date': day, 'time': hhmm}, format='json')
        self.assertEqual(book(self.friday, '11:00').status_code, 400)
        self.assertEqual(book(self.monday, '15:00').status_code, 400)
        self.assertEqual(book(self.friday, '15:00').status_code, 201)

    def test_week_availability_follows_hours(self, _mail):
        self.put_hours([{'weekday': 4, 'is_closed': False, 'open_time': '15:00', 'close_time': '18:00'},
                        {'weekday': 2, 'is_closed': True}])
        days = self.api.get('/api/barbers/availability/', {'week_start': self.monday}).data['barbers']['Willo']['days']
        self.assertEqual((days[4]['state'], days[4]['total']), ('open', 6))
        self.assertEqual(days[2]['state'], 'closed')
