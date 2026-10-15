from datetime import date, datetime, time, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import stripe

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Barbershop, ClosedPeriod, Notification, Reservation, Service, User
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
