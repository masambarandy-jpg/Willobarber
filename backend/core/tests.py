import hashlib
import hmac
import importlib
import json
import time as py_time
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

import stripe

from django.apps import apps as django_apps
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .cancellations import REFUND_FAILED_MESSAGE, retry_refund
from .models import (
    Barbershop, BarberCancellationLog, BarberLeave, ClosedPeriod, Notification, OpeningHours, RefundAttempt,
    Reservation, Service, User, WaitlistEntry,
)
from .recommendations import (
    SALON_TZ, salon_now, get_client_habits, process_user, should_send_seasonal_reminder, suggest_slots,
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

    @patch('core.views.stripe.PaymentIntent.create', return_value=_intent('succeeded'))
    @patch('core.views.stripe.PaymentMethod.retrieve', return_value=_card('pm_1', 'fp1'))
    def test_boutique_amount_is_computed_server_side(self, retrieve, intent_create):
        # Le prix affiché par l'app (22 €) diffère du prix en base (24 €) : on
        # débite le prix en base, celui que la commande vérifiera ensuite.
        from boutique.models import Product
        huile = Product.objects.create(nom='Huile Barbe Cèdre', categorie='huile', prix='24.00', stock=10)
        self.user.stripe_customer_id = 'cus_1'
        self.user.save()
        order = {'items': [{'product_id': huile.id, 'quantite': 2}], 'delivery_type': 'domicile', 'delivery_address': 'Rue X 1'}
        r = self.client.post('/api/payments/create-payment-intent/', {
            'amount': 22, 'payment_method': 'pm_1', 'order': order,
        }, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(intent_create.call_args.kwargs['amount'], 5295)

    def test_boutique_payment_refused_for_invalid_order(self):
        r = self.client.post('/api/payments/create-payment-intent/', {
            'amount': 22, 'order': {'items': [{'product_id': 999, 'quantite': 1}]},
        }, format='json')
        self.assertEqual(r.status_code, 400)

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

    def post_cancel(self, reservation, action, body, as_user=None):
        self.api.force_authenticate(as_user or self.client_user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.api.post(f'/api/reservations/{reservation.id}/{action}/', body, format='json')
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

    @patch('stripe.Refund.create', return_value=SimpleNamespace(id='re_1', amount=500, status='succeeded'))
    @patch('core.views.send_online_payment_invoice')
    def test_cancellation_more_than_24h_mentions_refund(self, _invoice, _refund, sg):
        reservation = self.book()
        self.post_cancel(reservation, 'cancel', {})
        mail = self.sent(sg)[-1]
        self.assertEqual(mail['subject'], 'Votre rendez-vous WilloBarber a été annulé')
        self.assertIn('intégralement remboursés', mail['content'][0]['value'])

    @patch('core.views.send_online_payment_invoice')
    def test_late_cancellation_keeps_deposit(self, _invoice, sg):
        # now + 3h peut tomber hors horaires (ex. lancé le soir) : salon ouvert 24h/24 ici.
        OpeningHours.objects.update(is_closed=False, open_time=time(0), close_time=time(0))
        tomorrow = (datetime.now(SALON_TZ) + timedelta(hours=3))
        reservation = self.book(date=tomorrow.date().isoformat(), time=tomorrow.strftime('%H:00'))
        self.post_cancel(reservation, 'cancel', {})
        html = self.sent(sg)[-1]['content'][0]['value']
        self.assertIn("Frais d'annulation tardive : 5€", html)
        self.assertIn('Montant remboursé : 0€', html)

    @patch('stripe.Refund.create', return_value=SimpleNamespace(id='re_1', amount=500, status='succeeded'))
    @patch('core.views.send_online_payment_invoice')
    def test_salon_cancellation_apologises_and_refunds(self, _invoice, _refund, sg):
        reservation = self.book()
        self.post_cancel(reservation, 'cancel-by-barber', {'reason': 'salon_unavailable'}, as_user=self.staff)
        html = self.sent(sg)[-1]['content'][0]['value']
        self.assertIn('Nous sommes désolés', html)
        self.assertIn('intégralement remboursés', html)


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


class OAuthLoginTests(TestCase):
    """L'oauth-login ne fait confiance qu'à un id_token Google vérifié — jamais
    à un email envoyé par l'app (faille : prise de contrôle de n'importe quel
    compte, y compris celui du gérant, avec juste son email)."""

    CLIENT_ID = 'test-client.apps.googleusercontent.com'

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from cryptography.hazmat.primitives.asymmetric import rsa
        cls.google_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.attacker_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    def setUp(self):
        self.admin = User.objects.create_user('willo', email='willo@salon.test', role='admin', phone='32470000000')
        self.api = APIClient()
        signing_key = SimpleNamespace(key=self.google_key.public_key())
        jwks = patch('core.oauth._google_jwks.get_signing_key_from_jwt', return_value=signing_key)
        jwks.start()
        self.addCleanup(jwks.stop)

    def id_token(self, key=None, **claims):
        import jwt
        now = datetime.now(tz=SALON_TZ)
        payload = {
            'iss': 'https://accounts.google.com', 'aud': self.CLIENT_ID, 'sub': '1234',
            'iat': now, 'exp': now + timedelta(minutes=5),
            'email': 'nouveau@gmail.com', 'email_verified': True,
            'given_name': 'Nora', 'family_name': 'Client', **claims,
        }
        return jwt.encode(payload, key or self.google_key, algorithm='RS256')

    def login(self, body):
        with self.settings(GOOGLE_OAUTH_CLIENT_IDS=[self.CLIENT_ID]):
            return self.api.post('/api/auth/oauth-login/', body, format='json')

    def test_email_alone_is_refused(self):
        response = self.login({'email': 'willo@salon.test'})
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('access', response.data)

    def test_forged_expired_or_foreign_tokens_are_refused(self):
        for token in (
            self.id_token(key=self.attacker_key, email='willo@salon.test'),  # pas signé par Google
            self.id_token(email='willo@salon.test', aud='autre-app'),         # autre application
            self.id_token(email='willo@salon.test', exp=datetime.now(tz=SALON_TZ) - timedelta(minutes=1)),
            self.id_token(email='willo@salon.test', iss='https://evil.example'),
            self.id_token(email='willo@salon.test', email_verified=False),
        ):
            response = self.login({'id_token': token})
            self.assertEqual(response.status_code, 401, response.data)

    def test_valid_token_logs_in_with_the_email_from_the_token(self):
        # L'email du body est ignoré : seul celui du token vérifié compte.
        response = self.login({'id_token': self.id_token(), 'email': 'willo@salon.test'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['user']['email'], 'nouveau@gmail.com')
        user = User.objects.get(email='nouveau@gmail.com')
        self.assertEqual((user.first_name, user.role, user.has_usable_password()), ('Nora', 'client', False))

    def test_existing_account_with_verified_google_email(self):
        response = self.login({'id_token': self.id_token(email='willo@salon.test')})
        self.assertEqual(response.data['user']['username'], 'willo')

    def test_not_configured_and_other_providers(self):
        with self.settings(GOOGLE_OAUTH_CLIENT_IDS=[]):
            response = self.api.post('/api/auth/oauth-login/', {'id_token': self.id_token()}, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.login({'provider': 'microsoft', 'email': 'willo@salon.test'}).status_code, 400)

    def test_passwordless_login_no_longer_exists(self):
        for body in ({'identifier': 'willo@salon.test'}, {'identifier': '+32 470 00 00 00'}):
            response = self.api.post('/api/auth/passwordless-login/', body, format='json')
            self.assertEqual(response.status_code, 404)


@patch('core.views.queue_reservation_email')
class LoyaltyPointsTests(TestCase):
    def setUp(self):
        owner = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=owner)
        self.signature = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        self.kids = Service.objects.create(name='Coupe enfant -15', price=15, duration=30, barbershop=shop, category='enfant')
        self.user = User.objects.create_user('randy', role='client')
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def book(self, service, barber, child_count=1):
        body = {'service': service.id, 'date': '2026-11-20', 'time': '15:30', 'barber': barber, 'child_count': child_count}
        response = self.api.post('/api/reservations/', body, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def points(self):
        self.user.refresh_from_db()
        return self.user.loyalty_points

    def test_three_child_cuts_give_30_points(self, _mail):
        # Groupe de 3 enfants = 3 réservations (cf. book.tsx), la 1re porte child_count.
        for i, barber in enumerate(('Willo', 'Malik', 'Idris')):
            data = self.book(self.kids, barber, child_count=3 if i == 0 else 1)
            self.assertEqual(data['loyalty_points'], 10)
        self.assertEqual(self.points(), 30)

    def test_adult_signature_still_gives_two_points_per_euro(self, _mail):
        data = self.book(self.signature, 'Willo')
        self.assertEqual((data['loyalty_points'], self.points()), (90, 90))

    def test_cancelled_child_cut_removes_its_10_points(self, _mail):
        self.book(self.signature, 'Willo')
        kid = self.book(self.kids, 'Malik')
        self.api.post(f"/api/reservations/{kid['id']}/cancel/", {}, format='json')
        self.assertEqual(self.points(), 90)


@patch('core.sse.publish_to_client', return_value=1)
@patch('core.sse.publish')
class ReservationCommentTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=self.staff)
        service = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        self.user = User.objects.create_user('randy', first_name='Randy', role='client')
        self.other = User.objects.create_user('other', role='client')
        self.past = Reservation.objects.create(
            user=self.user, service=service, date=date(2026, 9, 1), time=time(10, 0), status='confirmed', barber='Malik',
        )
        self.future = Reservation.objects.create(
            user=self.user, service=service, date=date(2027, 1, 5), time=time(10, 0), status='confirmed',
        )
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def url(self, reservation, suffix=''):
        return f'/api/reservations/{reservation.id}/comment/{suffix}'

    def comment(self, text='Merci Malik, top !', **extra):
        with self.captureOnCommitCallbacks(execute=True):
            return self.api.post(self.url(self.past), {'text': text, **extra}, format='json')

    def test_comment_notifies_coiffeur_in_real_time(self, publish, publish_to_client):
        r = self.comment(rating=5)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data['comment'], r.data['rating'], r.data['barber_name']), ('Merci Malik, top !', 5, 'Malik'))
        event, payload = publish.call_args.args
        self.assertEqual(event, 'new_comment')
        self.assertEqual(payload['notification']['title'], 'Nouveau message de Randy')
        self.assertEqual((payload['review_id'], payload['reservation_id']), (r.data['id'], self.past.id))

    def test_rating_is_optional(self, *_):
        self.assertIsNone(self.comment().data['rating'])

    def test_only_past_attended_own_reservations(self, *_):
        self.assertEqual(self.api.post(self.url(self.future), {'text': 'x'}, format='json').status_code, 400)
        self.past.status = 'no_show'
        self.past.save()
        self.assertEqual(self.comment().status_code, 400)
        self.api.force_authenticate(self.other)
        self.assertEqual(self.comment().status_code, 404)

    def test_edit_and_delete(self, *_):
        self.comment()
        self.assertEqual(self.comment().status_code, 400)  # un seul commentaire par RDV
        r = self.api.patch(self.url(self.past), {'text': '  Encore mieux  '}, format='json')
        self.assertEqual(r.data['comment'], 'Encore mieux')
        self.assertEqual(self.api.patch(self.url(self.past), {'text': 'x' * 501}, format='json').status_code, 400)
        self.assertEqual(self.api.delete(self.url(self.past)).status_code, 204)
        self.assertEqual(self.api.delete(self.url(self.past)).status_code, 404)

    def test_reply_notifies_only_the_client(self, publish, publish_to_client):
        review_id = self.comment().data['id']
        self.assertEqual(self.api.post(self.url(self.past, 'reply/'), {'text': 'Merci !'}, format='json').status_code, 403)

        self.api.force_authenticate(self.staff)
        self.assertEqual(self.api.get('/api/coiffeur/comments/').data[0]['id'], review_id)
        with self.captureOnCommitCallbacks(execute=True):
            r = self.api.post(self.url(self.past, 'reply/'), {'text': 'Merci à vous Randy !'}, format='json')
        self.assertEqual(r.data['reply'], 'Merci à vous Randy !')
        events = {c.args[1]: c.args[2] for c in publish_to_client.call_args_list}
        self.assertEqual({c.args[0] for c in publish_to_client.call_args_list}, {self.user.id})
        self.assertEqual(events['new_comment_reply']['reservation_id'], self.past.id)
        self.assertEqual(events['notification']['type'], 'comment_reply')
        self.assertEqual(events['notification']['title'], 'Votre barbier vous a répondu !')

    def test_legacy_review_endpoint_works_on_past_reservation(self, *_):
        # Avant : exigeait status='completed', que rien ne posait → toujours refusé.
        r = self.api.post('/api/reviews/', {'reservation': self.past.id, 'rating': 4, 'comment': 'Bien'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)


class CheckinClientProfileTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=self.staff)
        self.signature = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        self.beard = Service.objects.create(name='Barbe', price=20, duration=20, barbershop=shop)
        self.fade = Service.objects.create(name='Dégradé', price=30, duration=30, barbershop=shop)
        self.color = Service.objects.create(name='Coloration', price=50, duration=60, barbershop=shop)
        self.client_user = User.objects.create_user(
            'randy', first_name='Randy', last_name='M', role='client', loyalty_points=240,
        )
        self.today = self.book(self.signature, date(2026, 10, 17), 'Malik')
        self.api = APIClient()
        self.api.force_authenticate(self.staff)

    def book(self, service, day, barber='Willo', status='confirmed', at=time(10, 0)):
        return Reservation.objects.create(
            user=self.client_user, service=service, date=day, time=at, status=status, barber=barber,
        )

    def url(self, reservation):
        return f'/api/checkin/{reservation.qr_code}/'

    def test_valid_scan_checks_in_and_returns_profile(self):
        r = self.api.post(self.url(self.today))
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(r.data['already_checked_in'])
        self.assertTrue(r.data['reservation']['checked_in'])
        self.assertEqual(r.data['reservation']['service_name'], 'Signature')
        profile = r.data['client_profile']
        self.assertEqual((profile['first_name'], profile['loyalty_points'], profile['total_visits']), ('Randy', 240, 1))
        self.assertIsNone(profile['last_visit'])
        self.today.refresh_from_db()
        self.assertTrue(self.today.checked_in)

    def test_second_scan_reports_already_checked_in(self):
        first = self.api.post(self.url(self.today))
        second = self.api.post(self.url(self.today))
        self.assertTrue(second.data['already_checked_in'])
        self.assertEqual(second.data['reservation']['checked_in_at'], first.data['reservation']['checked_in_at'])

    def test_get_previews_profile_without_checking_in(self):
        r = self.api.get(self.url(self.today))
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['reservation']['checked_in'])
        self.today.refresh_from_db()
        self.assertFalse(self.today.checked_in)

    def test_non_staff_is_forbidden(self):
        self.api.force_authenticate(self.client_user)
        self.assertEqual(self.api.post(self.url(self.today)).status_code, 403)
        self.assertEqual(self.api.get(self.url(self.today)).status_code, 403)
        self.today.refresh_from_db()
        self.assertFalse(self.today.checked_in)

    def test_unknown_qr_returns_404(self):
        r = self.api.post('/api/checkin/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(r.status_code, 404)
        self.assertIn('error', r.data)

    def test_profile_counts_only_honoured_past_visits(self):
        self.book(self.fade, date(2026, 6, 1), 'Malik')
        self.book(self.fade, date(2026, 8, 1), 'Malik', status='pending')
        self.book(self.beard, date(2026, 9, 1), 'Idris')
        self.book(self.color, date(2026, 9, 20), 'Willo', status='cancelled_client')
        self.book(self.color, date(2026, 9, 25), 'Willo', status='no_show')
        self.book(self.color, date(2026, 12, 1), 'Willo')  # futur : pas encore une visite

        profile = self.api.get(self.url(self.today)).data['client_profile']
        self.assertEqual(profile['total_visits'], 4)
        self.assertEqual(profile['last_visit'], date(2026, 9, 1))
        self.assertEqual(profile['favorite_services'], ['Dégradé', 'Barbe', 'Signature'])
        self.assertEqual(profile['favorite_barber'], 'Malik')


@override_settings(SENDGRID_API_KEY='SG.test', SENDGRID_FROM_EMAIL='contact@willobarber.be', APP_URL='https://app.willobarber.be/')
@patch('core.emails.threading.Thread', SyncThread)
@patch('core.sse.publish_to_client')
@patch('core.emails.sendgrid.SendGridAPIClient')
class WaitlistTests(TestCase):
    SLOT = {'barber': 'Willo', 'date': '2026-11-20', 'time': '15:30'}

    def setUp(self):
        self.staff = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=self.staff)
        self.service = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        holder = User.objects.create_user('holder', role='client')  # sans email : pas de mail d'annulation
        self.booked = Reservation.objects.create(
            user=holder, service=self.service, date=date(2026, 11, 20), time=time(15, 30), barber='Willo',
            status='confirmed',
        )
        self.clients = [
            User.objects.create_user(f'client{i}', email=f'client{i}@example.com', first_name=f'C{i}', role='client')
            for i in range(6)
        ]
        self.api = APIClient()

    def join(self, user, **body):
        self.api.force_authenticate(user)
        return self.api.post('/api/waitlist/', {**self.SLOT, 'service_name': 'Signature', **body}, format='json')

    def cancel(self, reservation):
        self.api.force_authenticate(self.staff)
        with self.captureOnCommitCallbacks(execute=True):
            r = self.api.post(f'/api/reservations/{reservation.id}/cancel-by-barber/', {'reason': 'salon_unavailable'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    def waitlist_events(self, publish_to_client):
        return [(c.args[0], c.args[2]) for c in publish_to_client.call_args_list if c.args[1] == 'waitlist_available']

    def waitlist_mails(self, sg):
        mails = [c.args[0].get() for c in sg.return_value.send.call_args_list]
        return [m for m in mails if 'libérer' in m['subject']]

    def test_join_taken_slot_creates_entry(self, *_):
        r = self.join(self.clients[0])
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data['barber'], r.data['time'], r.data['notified_at']), ('Willo', '15:30:00', None))
        self.api.force_authenticate(self.clients[0])
        self.assertEqual([e['id'] for e in self.api.get('/api/waitlist/mine/').data], [r.data['id']])

    def test_join_twice_returns_400(self, *_):
        self.join(self.clients[0])
        r = self.join(self.clients[0])
        self.assertEqual((r.status_code, r.data['code']), (400, 'already_subscribed'))

    def test_sixth_join_returns_409(self, *_):
        for user in self.clients[:5]:
            self.assertEqual(self.join(user).status_code, 201)
        r = self.join(self.clients[5])
        self.assertEqual((r.status_code, r.data['code']), (409, 'full'))
        self.assertEqual(WaitlistEntry.objects.count(), 5)

    def test_free_or_past_slot_is_refused(self, *_):
        self.assertEqual(self.join(self.clients[0], time='16:30').data['code'], 'slot_free')
        self.assertEqual(self.join(self.clients[0], date='2026-01-05').data['code'], 'slot_past')

    def test_cancellation_notifies_every_subscriber(self, sg, publish_to_client):
        for user in self.clients[:3]:
            self.join(user)
        self.cancel(self.booked)

        events = self.waitlist_events(publish_to_client)
        self.assertEqual({user_id for user_id, _ in events}, {u.id for u in self.clients[:3]})
        self.assertEqual(events[0][1]['time'], '15:30')
        mails = self.waitlist_mails(sg)
        self.assertEqual(len(mails), 3)
        self.assertIn('/book?waitlist=true&amp;barbier=Willo&amp;date=2026-11-20&amp;heure=15%3A30', mails[0]['content'][0]['value'])
        self.assertFalse(WaitlistEntry.objects.filter(notified_at__isnull=True).exists())
        self.assertEqual(Notification.objects.filter(type='waitlist_available').count(), 3)

        # Re-sauvegarder un RDV déjà annulé ne renotifie pas.
        publish_to_client.reset_mock()
        with self.captureOnCommitCallbacks(execute=True):
            self.booked.save()
        self.assertEqual(self.waitlist_events(publish_to_client), [])

    def test_first_to_book_wins_others_get_409_and_keep_their_alert(self, *_):
        a, b, c = self.clients[:3]
        for user in (a, b, c):
            self.join(user)
        self.cancel(self.booked)

        statuses = []
        for user in (a, b, c):
            self.api.force_authenticate(user)
            with self.captureOnCommitCallbacks(execute=True):
                r = self.api.post('/api/reservations/', {'service': self.service.id, **self.SLOT}, format='json')
            statuses.append(r.status_code)
        self.assertEqual(statuses, [201, 409, 409])
        remaining = WaitlistEntry.objects.order_by('client_id')
        self.assertEqual([e.client_id for e in remaining], [b.id, c.id])
        # Réarmées : elles seront prévenues à la prochaine libération.
        self.assertTrue(all(e.notified_at is None for e in remaining))

    def test_reschedule_frees_the_old_slot(self, sg, publish_to_client):
        self.join(self.clients[0])
        self.api.force_authenticate(self.staff)
        with self.captureOnCommitCallbacks(execute=True):
            self.api.patch(f'/api/reservations/{self.booked.id}/', {'time': '16:30'}, format='json')
        self.assertEqual([uid for uid, _ in self.waitlist_events(publish_to_client)], [self.clients[0].id])

    def test_cancel_alert_removes_entry(self, *_):
        entry_id = self.join(self.clients[0]).data['id']
        self.api.force_authenticate(self.clients[1])
        self.assertEqual(self.api.delete(f'/api/waitlist/{entry_id}/').status_code, 404)
        self.api.force_authenticate(self.clients[0])
        self.assertEqual(self.api.delete(f'/api/waitlist/{entry_id}/').status_code, 204)
        self.assertFalse(WaitlistEntry.objects.exists())

    def test_slot_less_than_two_hours_away_is_not_notified(self, sg, publish_to_client):
        soon = (salon_now() + timedelta(hours=1)).replace(second=0, microsecond=0)
        reservation = Reservation.objects.create(
            user=self.staff, service=self.service, date=soon.date(), time=soon.time(), barber='Malik',
            status='confirmed',
        )
        entry = WaitlistEntry.objects.create(client=self.clients[0], barber='Malik', date=soon.date(), time=soon.time())
        self.cancel(reservation)
        self.assertEqual(self.waitlist_events(publish_to_client), [])
        self.assertEqual(self.waitlist_mails(sg), [])
        entry.refresh_from_db()
        self.assertIsNone(entry.notified_at)

    def test_for_slot_is_staff_only(self, *_):
        self.join(self.clients[0])
        self.join(self.clients[1])
        self.api.force_authenticate(self.clients[0])
        self.assertEqual(self.api.get('/api/waitlist/for-slot/', self.SLOT).status_code, 403)

        self.api.force_authenticate(self.staff)
        r = self.api.get('/api/waitlist/for-slot/', self.SLOT)
        self.assertEqual((r.status_code, r.data['count']), (200, 2))
        self.assertEqual(r.data['entries'][0]['client_name'], 'C0')
        self.assertEqual(self.api.get('/api/waitlist/for-slot/', {'date': '2026-11-20'}).data['count'], 2)
        self.assertEqual(self.api.get('/api/waitlist/for-slot/', {**self.SLOT, 'time': '16:30'}).data['count'], 0)
        self.assertEqual(self.api.get('/api/waitlist/for-slot/', {'date': 'demain'}).status_code, 400)


@patch('core.sse.publish_to_client', return_value=1)
@patch('core.sse.publish')
class HiddenByClientTests(TestCase):
    """Masquer une coupe de son historique (soft delete côté client)."""

    def setUp(self):
        owner = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=owner)
        service = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        self.client_user = User.objects.create_user('randy', role='client', loyalty_points=90)
        self.other = User.objects.create_user('other', role='client')
        today = salon_now().date()
        self.past = Reservation.objects.create(
            user=self.client_user, service=service, date=today - timedelta(days=30), time=time(10, 0), status='confirmed',
        )
        self.future = Reservation.objects.create(
            user=self.client_user, service=service, date=today + timedelta(days=30), time=time(10, 0), status='confirmed',
        )
        self.api = APIClient()
        self.api.force_authenticate(self.client_user)
        self.staff = APIClient()
        self.staff.force_authenticate(owner)

    def hide(self, reservation, api=None, **body):
        return (api or self.api).patch(f'/api/reservations/{reservation.id}/hide/', body, format='json')

    def ids(self, api, **params):
        return {r['id'] for r in api.get('/api/reservations/', params).data}

    def test_hide_past_cut_removes_it_from_client_list_only(self, *_):
        r = self.hide(self.past)
        self.assertEqual((r.status_code, r.data['hidden_by_client']), (200, True))
        self.past.refresh_from_db()
        self.assertTrue(self.past.hidden_by_client)
        self.assertEqual(self.ids(self.api), {self.future.id})
        self.assertEqual(self.ids(self.api, include_hidden='1'), {self.past.id, self.future.id})
        # Le salon voit toujours tout.
        self.assertEqual(self.ids(self.staff), {self.past.id, self.future.id})

    def test_hide_keeps_loyalty_points(self, *_):
        self.hide(self.past)
        self.client_user.refresh_from_db()
        self.assertEqual(self.client_user.loyalty_points, 90)

    def test_unhide(self, *_):
        self.hide(self.past)
        r = self.hide(self.past, hidden=False)
        self.assertEqual((r.status_code, r.data['hidden_by_client']), (200, False))
        self.assertIn(self.past.id, self.ids(self.api))

    def test_other_client_gets_403(self, *_):
        intruder = APIClient()
        intruder.force_authenticate(self.other)
        self.assertEqual(self.hide(self.past, api=intruder).status_code, 403)
        # Même le salon ne masque pas à la place du client.
        self.assertEqual(self.hide(self.past, api=self.staff).status_code, 403)
        self.past.refresh_from_db()
        self.assertFalse(self.past.hidden_by_client)

    def test_future_reservation_gets_400(self, *_):
        r = self.hide(self.future)
        self.assertEqual((r.status_code, r.data['code']), (400, 'not_past'))

    def test_invalid_payload_and_unknown_id(self, *_):
        self.assertEqual(self.hide(self.past, hidden='oui').status_code, 400)
        self.assertEqual(self.api.patch('/api/reservations/999999/hide/', {}, format='json').status_code, 404)

    def test_field_not_writable_through_generic_patch(self, *_):
        r = self.api.patch(f'/api/reservations/{self.past.id}/', {'hidden_by_client': True}, format='json')
        self.assertEqual(r.status_code, 403)
        self.past.refresh_from_db()
        self.assertFalse(self.past.hidden_by_client)


REFUND = SimpleNamespace(id='re_1', amount=4500, status='succeeded')
LATE_REFUND = SimpleNamespace(id='re_2', amount=4000, status='succeeded')


@override_settings(
    SENDGRID_API_KEY='SG.test', SENDGRID_FROM_EMAIL='contact@willobarber.be', APP_URL='https://app.willobarber.be/',
    ADMIN_EMAIL='admin@willobarber.be', STRIPE_SECRET_KEY='sk_test_dummy', STRIPE_WEBHOOK_SECRET='whsec_test',
    # Pages admin rendues sans collectstatic (le stockage Manifest exigerait le manifeste).
    STORAGES={
        'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    },
)
@patch('core.emails.threading.Thread', SyncThread)
@patch('core.sse.publish_to_client')
@patch('stripe.Refund.create')
@patch('core.emails.sendgrid.SendGridAPIClient')
class CancellationRefundTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=self.staff)
        self.service = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        self.client_user = User.objects.create_user(
            'randy', email='randy@example.com', first_name='Randy', loyalty_points=200,
        )
        self.api = APIClient()

    def book(self, delta=None, at=None, **extra):
        """RDV payé en ligne, à `delta` de maintenant ou à l'heure de Bruxelles `at`."""
        start = at or timezone.now().astimezone(SALON_TZ) + delta
        return Reservation.objects.create(**{
            'user': self.client_user, 'service': self.service, 'date': start.date(), 'time': start.time(),
            'status': 'confirmed', 'payment_intent_id': 'pi_1', 'amount_paid': 45, **extra,
        })

    def cancel(self, reservation, user=None, body=None):
        self.api.force_authenticate(user or self.client_user)
        with self.captureOnCommitCallbacks(execute=True):
            return self.api.post(f'/api/reservations/{reservation.id}/cancel/', body or {}, format='json')

    def cancel_by_barber(self, reservation, reason, user=None, notes=''):
        self.api.force_authenticate(user or self.staff)
        with self.captureOnCommitCallbacks(execute=True):
            return self.api.post(
                f'/api/reservations/{reservation.id}/cancel-by-barber/', {'reason': reason, 'notes': notes}, format='json',
            )

    def mails(self, sg):
        return [c.args[0].get() for c in sg.return_value.send.call_args_list]

    def points(self):
        return User.objects.get(pk=self.client_user.pk).loyalty_points

    # ─── Côté client ──────────────────────────────────────────────────────────

    def test_client_cancel_more_than_24h_triggers_full_refund(self, sg, refund, _sse):
        refund.return_value = REFUND
        reservation = self.book(timedelta(hours=48))
        r = self.cancel(reservation)

        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['status'], 'cancelled_and_refunded')
        self.assertEqual(r.data['refund_amount'], 45.0)
        self.assertEqual(r.data['loyalty_points_removed'], 90)
        refund.assert_called_once_with(payment_intent='pi_1', idempotency_key=f'refund-{reservation.id}')
        reservation.refresh_from_db()
        self.assertEqual(reservation.refund_id, 're_1')
        self.assertEqual(reservation.refund_amount, 45)
        self.assertIsNotNone(reservation.refunded_at)
        self.assertIsNotNone(reservation.cancelled_at)
        self.assertEqual(reservation.cancelled_by, 'client')
        attempt = RefundAttempt.objects.get(reservation=reservation)
        self.assertEqual((attempt.status, attempt.stripe_refund_id), ('succeeded', 're_1'))
        self.assertIn('45 € vous sont intégralement remboursés', self.mails(sg)[0]['content'][0]['value'])

    def test_late_cancellation_of_45_euro_slot_refunds_40_euros(self, sg, refund, _sse):
        refund.return_value = LATE_REFUND
        reservation = self.book(timedelta(hours=23))
        r = self.cancel(reservation)

        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(
            (r.data['status'], r.data['refund_amount'], r.data['cancellation_fee']),
            ('cancelled_late_partial_refund', 40.0, 5.0),
        )
        refund.assert_called_once_with(payment_intent='pi_1', idempotency_key=f'refund-{reservation.id}', amount=4000)
        attempt = RefundAttempt.objects.get(reservation=reservation)
        self.assertEqual((attempt.status, attempt.cancellation_fee), ('succeeded', 5))
        html = self.mails(sg)[0]['content'][0]['value']
        for text in ("Frais d'annulation tardive : 5€", 'Montant remboursé : 40€', "l'article 3.2 de nos CGV"):
            self.assertIn(text, html)

    def test_late_cancellation_refunds_amount_minus_5_euros(self, _sg, refund, _sse):
        refund.return_value = SimpleNamespace(id='re_3', amount=2350, status='succeeded')
        r = self.cancel(self.book(timedelta(hours=5), amount_paid='28.50'))
        self.assertEqual(refund.call_args.kwargs['amount'], 2350)
        self.assertEqual((r.data['refund_amount'], r.data['cancellation_fee']), (23.5, 5.0))

    def test_late_cancellation_of_cheap_slot_refunds_zero_if_total_below_5(self, _sg, refund, _sse):
        reservation = self.book(timedelta(hours=5), amount_paid=3)
        r = self.cancel(reservation)
        refund.assert_not_called()
        self.assertEqual((r.status_code, r.data['refund_amount'], r.data['cancellation_fee']), (200, 0, 3.0))
        self.assertEqual(RefundAttempt.objects.get(reservation=reservation).cancellation_fee, 3)

    def test_late_cancellation_of_5_euro_deposit_keeps_it_without_stripe(self, sg, refund, _sse):
        r = self.cancel(self.book(timedelta(hours=5), amount_paid=5))
        refund.assert_not_called()
        self.assertEqual((r.data['refund_amount'], r.data['cancellation_fee']), (0, 5.0))
        self.assertIn('Montant remboursé : 0€', self.mails(sg)[0]['content'][0]['value'])

    def test_late_cancellation_stripe_failure_keeps_fee_and_retries_same_amount(self, _sg, refund, _sse):
        refund.side_effect = stripe.error.APIConnectionError('down')
        reservation = self.book(timedelta(hours=5))
        with self.assertLogs('core.cancellations', level='ERROR'):
            r = self.cancel(reservation)
        self.assertEqual(r.data['message'], REFUND_FAILED_MESSAGE)
        attempt = RefundAttempt.objects.get(reservation=reservation)
        self.assertEqual((attempt.status, attempt.cancellation_fee), ('failed', 5))

        refund.side_effect = None
        refund.return_value = LATE_REFUND
        self.assertTrue(retry_refund(attempt))
        self.assertEqual(refund.call_args.kwargs['amount'], 4000)

    def test_migration_converts_old_late_status(self, _sg, _refund, _sse):
        reservation = self.book(timedelta(hours=5))
        Reservation.objects.filter(pk=reservation.pk).update(status='cancelled_late_no_refund')
        migration = importlib.import_module('core.migrations.0039_late_partial_refund_fee')
        migration.rename_late_status(django_apps, None)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, 'cancelled_late_partial_refund')

    def test_client_cancel_exactly_24h_is_late(self, _sg, refund, _sse):
        refund.return_value = LATE_REFUND
        now = datetime(2026, 11, 10, 12, 0, tzinfo=SALON_TZ)
        reservation = self.book(at=now + timedelta(hours=24))
        with patch('django.utils.timezone.now', return_value=now):
            r = self.cancel(reservation)
        self.assertEqual(r.data['status'], 'cancelled_late_partial_refund')
        self.assertEqual(refund.call_args.kwargs['amount'], 4000)

    def test_client_cancel_removes_loyalty_points_always(self, _sg, refund, _sse):
        refund.return_value = REFUND
        self.cancel(self.book(timedelta(hours=48)))
        self.assertEqual(self.points(), 110)
        r = self.cancel(self.book(timedelta(hours=2)))
        self.assertEqual(r.data['loyalty_points_removed'], 90)
        self.assertEqual(self.points(), 20)
        # Jamais de solde négatif : la réponse indique ce qui a réellement été retiré.
        r = self.cancel(self.book(timedelta(hours=3)))
        self.assertEqual(r.data['loyalty_points_removed'], 20)
        self.assertEqual(self.points(), 0)

    def test_client_cannot_cancel_other_user_reservation(self, _sg, refund, _sse):
        reservation = self.book(timedelta(hours=48))
        other = User.objects.create_user('other')
        self.assertEqual(self.cancel(reservation, user=other).status_code, 403)
        # Le client-endpoint n'est ouvert qu'au titulaire, même pour le salon.
        self.assertEqual(self.cancel(reservation, user=self.staff).status_code, 403)
        refund.assert_not_called()
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, 'confirmed')

    def test_client_cannot_cancel_already_cancelled(self, _sg, refund, _sse):
        reservation = self.book(timedelta(hours=48), status='cancelled_client')
        r = self.cancel(reservation)
        self.assertEqual((r.status_code, r.data['error']), (400, 'Déjà annulée'))
        refund.assert_not_called()

    def test_client_cannot_cancel_past_or_checked_in_reservation(self, _sg, refund, _sse):
        for reservation in (self.book(timedelta(days=-30), status='pending'), self.book(timedelta(hours=3), checked_in=True)):
            self.assertEqual(self.cancel(reservation).status_code, 400)
            reservation.refresh_from_db()
            self.assertIn(reservation.status, ('pending', 'confirmed'))
        refund.assert_not_called()
        self.assertEqual(self.points(), 200)

    def test_client_can_cancel_pending_booking_from_app(self, _sg, refund, _sse):
        refund.return_value = REFUND
        r = self.cancel(self.book(timedelta(hours=48), status='pending'))
        self.assertEqual((r.status_code, r.data['status']), (200, 'cancelled_and_refunded'))

    def test_client_reason_is_stored_in_full(self, _sg, refund, _sse):
        refund.return_value = REFUND
        reservation = self.book(timedelta(hours=48))
        self.assertEqual(self.cancel(reservation, body={'reason': 'x' * 500}).status_code, 200)
        reservation.refresh_from_db()
        self.assertEqual(reservation.cancellation_reason, 'x' * 500)

    def test_client_reason_over_500_chars_is_refused(self, _sg, _refund, _sse):
        r = self.cancel(self.book(timedelta(hours=48)), body={'reason': 'x' * 501})
        self.assertEqual(r.status_code, 400)

    def test_cancel_without_payment_intent_only_frees_slot(self, _sg, refund, _sse):
        reservation = self.book(timedelta(hours=48), payment_intent_id='', amount_paid=None)
        r = self.cancel(reservation)
        self.assertEqual((r.status_code, r.data['refund_amount']), (200, 0))
        refund.assert_not_called()
        self.assertFalse(RefundAttempt.objects.exists())

    # ─── Côté coiffeur ────────────────────────────────────────────────────────

    def test_barber_can_mark_no_show_after_15_min(self, sg, refund, _sse):
        reservation = self.book(timedelta(minutes=-16))
        r = self.cancel_by_barber(reservation, 'client_no_show')

        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['status'], 'cancelled_no_show')
        self.assertEqual((r.data['reason'], r.data['refund_amount'], r.data['loyalty_points_removed']), ('client_no_show', 0, 90))
        refund.assert_not_called()
        self.assertEqual(self.points(), 110)
        self.assertEqual(self.mails(sg)[0]['subject'], 'Vous avez manqué votre rendez-vous WilloBarber')

    def test_barber_cannot_mark_no_show_before_start(self, _sg, _refund, _sse):
        r = self.cancel_by_barber(self.book(timedelta(minutes=30)), 'client_no_show')
        self.assertEqual((r.status_code, r.data['error']), (400, "Vous ne pouvez marquer no-show qu'après +15 min"))

    def test_barber_cannot_mark_no_show_at_exactly_14_min(self, _sg, _refund, _sse):
        now = datetime(2026, 11, 10, 15, 14, tzinfo=SALON_TZ)
        reservation = self.book(at=datetime(2026, 11, 10, 15, 0, tzinfo=SALON_TZ))
        with patch('django.utils.timezone.now', return_value=now):
            r = self.cancel_by_barber(reservation, 'client_no_show')
        self.assertEqual(r.status_code, 400)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, 'confirmed')

    def test_barber_cannot_mark_checked_in_client_as_no_show(self, _sg, _refund, _sse):
        r = self.cancel_by_barber(self.book(timedelta(minutes=-30), checked_in=True), 'client_no_show')
        self.assertEqual(r.status_code, 400)

    def test_barber_cancel_client_requested_more_than_24h_refunds(self, sg, refund, _sse):
        refund.return_value = REFUND
        r = self.cancel_by_barber(self.book(timedelta(hours=48)), 'client_requested')
        self.assertEqual((r.data['status'], r.data['refund_amount'], r.data['loyalty_points_removed']), ('cancelled_and_refunded', 45.0, 90))
        refund.assert_called_once()
        self.assertIn('À votre demande', self.mails(sg)[0]['content'][0]['value'])

    def test_barber_cancel_client_requested_less_than_24h_keeps_fee(self, _sg, refund, _sse):
        refund.return_value = LATE_REFUND
        r = self.cancel_by_barber(self.book(timedelta(hours=5)), 'client_requested')
        self.assertEqual((r.data['status'], r.data['refund_amount'], r.data['loyalty_points_removed']), ('cancelled_late_partial_refund', 40.0, 90))
        self.assertEqual(refund.call_args.kwargs['amount'], 4000)
        self.assertTrue(BarberCancellationLog.objects.get().client_was_refunded)

    def test_barber_cancel_salon_unavailable_always_refunds_100(self, sg, refund, _sse):
        refund.return_value = REFUND
        # Même à moins de 24h : le service n'est pas rendu du fait du salon.
        r = self.cancel_by_barber(self.book(timedelta(hours=2)), 'salon_unavailable', notes='Barbier malade ce jour')
        self.assertEqual((r.data['status'], r.data['refund_amount']), ('cancelled_by_salon_refunded', 45.0))
        refund.assert_called_once()
        self.assertIn('Nous sommes désolés', self.mails(sg)[0]['content'][0]['value'])

    def test_barber_cancel_salon_unavailable_keeps_loyalty_points(self, _sg, refund, _sse):
        refund.return_value = REFUND
        r = self.cancel_by_barber(self.book(timedelta(hours=48)), 'salon_unavailable')
        self.assertEqual(r.data['loyalty_points_removed'], 0)
        self.assertEqual(self.points(), 200)

    def test_client_cannot_use_barber_endpoint(self, _sg, refund, _sse):
        reservation = self.book(timedelta(hours=48))
        r = self.cancel_by_barber(reservation, 'salon_unavailable', user=self.client_user)
        self.assertEqual(r.status_code, 403)
        refund.assert_not_called()

    def test_barber_role_is_available_in_choices(self, _sg, _refund, _sse):
        self.assertIn(('barber', 'Coiffeur'), User.ROLE_CHOICES)
        self.client.force_login(User.objects.create_superuser('root', password='x'))
        r = self.client.get(f'/admin/core/user/{self.client_user.pk}/change/')
        self.assertContains(r, '<option value="barber">Coiffeur</option>', html=True)

    def test_user_with_barber_role_can_use_cancel_by_barber_endpoint(self, _sg, refund, _sse):
        refund.return_value = REFUND
        barber = User.objects.create_user('malik', role='barber')
        r = self.cancel_by_barber(self.book(timedelta(hours=48)), 'salon_unavailable', user=barber)
        self.assertEqual(r.status_code, 200, r.data)

    def test_barber_endpoint_requires_valid_reason(self, _sg, _refund, _sse):
        r = self.cancel_by_barber(self.book(timedelta(hours=48)), 'because')
        self.assertEqual(r.status_code, 400)

    def test_barber_cancellation_creates_audit_log(self, _sg, refund, _sse):
        refund.return_value = REFUND
        reservation = self.book(timedelta(hours=48))
        self.cancel_by_barber(reservation, 'salon_unavailable', notes='Dégât des eaux au salon')
        log = BarberCancellationLog.objects.get(reservation=reservation)
        self.assertEqual((log.barber_user, log.reason, log.notes), (self.staff, 'salon_unavailable', 'Dégât des eaux au salon'))
        self.assertTrue(log.client_was_refunded)
        self.assertEqual(log.refund_amount, 45)
        reservation.refresh_from_db()
        self.assertEqual((reservation.cancelled_by, reservation.cancellation_reason), ('barber', 'salon_unavailable'))

    def test_no_show_increments_user_counter(self, _sg, _refund, _sse):
        self.cancel_by_barber(self.book(timedelta(minutes=-20)), 'client_no_show')
        self.assertEqual(User.objects.get(pk=self.client_user.pk).no_show_count, 1)
        self.assertFalse(BarberCancellationLog.objects.get().client_was_refunded)

    # ─── Transverses ──────────────────────────────────────────────────────────

    def test_stripe_failure_does_not_block_cancellation(self, sg, refund, _sse):
        refund.side_effect = stripe.error.APIConnectionError('Stripe injoignable')
        reservation = self.book(timedelta(hours=48))
        with self.assertLogs('core.cancellations', level='ERROR'):
            r = self.cancel(reservation)

        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['message'], REFUND_FAILED_MESSAGE)
        self.assertEqual(r.data['refund_amount'], 0)
        self.assertEqual(r.data['loyalty_points_removed'], 90)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, 'cancelled_and_refunded')
        self.assertIsNone(reservation.refund_id)
        attempt = RefundAttempt.objects.get(reservation=reservation)
        self.assertEqual((attempt.status, attempt.error_message), ('failed', 'Stripe injoignable'))
        recipients = [m['personalizations'][0]['to'][0]['email'] for m in self.mails(sg)]
        self.assertIn('admin@willobarber.be', recipients)
        self.assertIn('randy@example.com', recipients)

    def test_double_cancellation_is_idempotent(self, _sg, refund, _sse):
        refund.return_value = REFUND
        reservation = self.book(timedelta(hours=48))
        self.assertEqual(self.cancel(reservation).status_code, 200)
        self.assertEqual(self.cancel(reservation).status_code, 400)
        self.assertEqual(self.cancel_by_barber(reservation, 'salon_unavailable').status_code, 400)
        refund.assert_called_once()
        self.assertEqual(self.points(), 110)

    def test_old_patch_cancel_returns_410_gone(self, _sg, refund, _sse):
        reservation = self.book(timedelta(hours=48))
        for user, value in ((self.client_user, 'cancelled_client'), (self.staff, 'cancelled'),
                            (self.staff, 'cancelled_and_refunded'), (self.staff, 'cancelled_late_partial_refund')):
            self.api.force_authenticate(user)
            r = self.api.patch(f'/api/reservations/{reservation.id}/', {'status': value}, format='json')
            self.assertEqual(r.status_code, 410)
            self.assertEqual(r.data['detail'], 'Endpoint déprécié. Utilisez POST /api/reservations/<id>/cancel/')
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, 'confirmed')
        refund.assert_not_called()

    def test_patch_reschedule_still_works(self, sg, _refund, _sse):
        reservation = self.book(timedelta(hours=48))
        self.api.force_authenticate(self.client_user)
        with self.captureOnCommitCallbacks(execute=True):
            r = self.api.patch(f'/api/reservations/{reservation.id}/', {'time': '10:00'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('reprogrammé', self.mails(sg)[-1]['subject'])

    def test_delete_account_cancels_active_reservations_with_refund_policy(self, sg, refund, _sse):
        refund.side_effect = [REFUND, LATE_REFUND]
        far = self.book(timedelta(hours=48))
        late = self.book(timedelta(hours=5))
        past = self.book(timedelta(days=-3))
        self.api.force_authenticate(self.client_user)
        with self.captureOnCommitCallbacks(execute=True), self.assertLogs('core.cancellations', level='WARNING') as logs:
            r = self.api.delete('/api/auth/delete-account/')

        self.assertEqual(r.status_code, 200)
        far.refresh_from_db(); late.refresh_from_db(); past.refresh_from_db()
        self.assertEqual(far.status, 'cancelled_and_refunded')
        self.assertEqual(late.status, 'cancelled_late_partial_refund')
        self.assertEqual(past.status, 'confirmed')
        self.assertEqual(refund.call_count, 2)
        self.assertEqual(refund.call_args.kwargs['amount'], 4000)
        self.assertEqual(len(logs.records), 2)
        # L'email part à la vraie adresse, pas à l'adresse anonymisée.
        recipients = {m['personalizations'][0]['to'][0]['email'] for m in self.mails(sg)}
        self.assertEqual(recipients, {'randy@example.com'})
        self.assertTrue(User.objects.get(pk=self.client_user.pk).is_deleted)

    def family(self, delta=timedelta(hours=48), count=2):
        parent = self.book(delta, child_count=count + 1)
        start = timezone.now().astimezone(SALON_TZ) + delta
        children = [
            self.book(at=start + timedelta(minutes=30 * (i + 1)), payment_intent_id='', amount_paid=0, parent_reservation=parent)
            for i in range(count)
        ]
        return parent, children

    def test_cancel_parent_cascades_to_children(self, sg, refund, _sse):
        refund.return_value = REFUND
        User.objects.filter(pk=self.client_user.pk).update(loyalty_points=300)
        parent, children = self.family()
        r = self.cancel(parent, body={'reason': 'Empêchement'})

        self.assertEqual(r.data['loyalty_points_removed'], 270)
        self.assertEqual(self.points(), 30)
        parent.refresh_from_db()
        for child in children:
            child.refresh_from_db()
            self.assertEqual(child.status, parent.status)
            self.assertEqual(child.cancelled_at, parent.cancelled_at)
            self.assertEqual((child.cancelled_by, child.cancellation_reason), ('client', 'Empêchement'))
            self.assertIsNone(child.refund_amount)
        # Un seul email, qui récapitule tous les RDV annulés.
        client_mails = [m for m in self.mails(sg) if m['personalizations'][0]['to'][0]['email'] == 'randy@example.com']
        self.assertEqual(len(client_mails), 1)
        self.assertEqual(client_mails[0]['content'][0]['value'].count('RDV lié'), 2)

    def test_cannot_cancel_child_directly(self, _sg, refund, _sse):
        _, [child, _other] = self.family()
        expected = 'Annulez la réservation principale pour annuler toute la famille, ou contactez le support.'
        for r in (self.cancel(child), self.cancel_by_barber(child, 'salon_unavailable')):
            self.assertEqual((r.status_code, r.data['error']), (400, expected))
        child.refresh_from_db()
        self.assertEqual(child.status, 'confirmed')
        refund.assert_not_called()

    def test_parent_cancellation_refunds_once_not_per_child(self, _sg, refund, _sse):
        refund.return_value = REFUND
        parent, _ = self.family()
        self.cancel_by_barber(parent, 'salon_unavailable', notes='Barbier malade')
        refund.assert_called_once()
        self.assertEqual(RefundAttempt.objects.count(), 1)
        # Journal : une ligne par RDV, seul le parent porte le remboursement.
        logs = BarberCancellationLog.objects.all()
        self.assertEqual(logs.count(), 3)
        self.assertEqual(logs.filter(client_was_refunded=True).get().reservation, parent)

    def test_late_group_cancellation_keeps_a_single_fee(self, _sg, refund, _sse):
        refund.return_value = LATE_REFUND
        parent, _ = self.family(timedelta(hours=5))
        r = self.cancel(parent)
        self.assertEqual((r.data['refund_amount'], r.data['cancellation_fee']), (40.0, 5.0))
        self.assertEqual(refund.call_args.kwargs['amount'], 4000)

    def test_parent_cancellation_frees_all_child_slots(self, _sg, refund, publish_to_client):
        refund.return_value = REFUND
        parent, children = self.family()
        waiting = User.objects.create_user('waiting', email='waiting@example.com')
        entry = WaitlistEntry.objects.create(
            client=waiting, barber=children[0].barber, date=children[0].date, time=children[0].time,
        )
        self.cancel(parent)
        entry.refresh_from_db()
        self.assertIsNotNone(entry.notified_at)
        # La contrainte d'unicité ne bloque plus : chaque créneau est de nouveau réservable.
        for child in children:
            child.refresh_from_db()
            Reservation.objects.create(
                user=waiting, service=self.service, date=child.date, time=child.time, barber=child.barber, status='confirmed',
            )

    def test_no_show_on_group_counts_once(self, _sg, _refund, _sse):
        parent, children = self.family(timedelta(minutes=-20), count=1)
        r = self.cancel_by_barber(parent, 'client_no_show')
        self.assertEqual(r.data['loyalty_points_removed'], 180)
        self.assertEqual(User.objects.get(pk=self.client_user.pk).no_show_count, 1)
        children[0].refresh_from_db()
        self.assertEqual(children[0].status, 'cancelled_no_show')

    def test_no_show_refused_when_a_child_has_checked_in(self, _sg, _refund, _sse):
        parent, children = self.family(timedelta(minutes=-20), count=1)
        Reservation.objects.filter(pk=children[0].pk).update(checked_in=True)
        self.assertEqual(self.cancel_by_barber(parent, 'client_no_show').status_code, 400)

    def test_delete_account_cancels_group_once(self, _sg, refund, _sse):
        refund.return_value = REFUND
        parent, children = self.family()
        self.api.force_authenticate(self.client_user)
        with self.assertLogs('core.cancellations', level='WARNING'):
            self.api.delete('/api/auth/delete-account/')
        refund.assert_called_once()
        children[0].refresh_from_db()
        self.assertEqual(children[0].status, 'cancelled_and_refunded')

    def test_booking_links_child_to_parent_of_same_client_only(self, _sg, _refund, _sse):
        parent = self.book(timedelta(days=30))
        body = {'service': self.service.id, 'barber': 'Willo', 'date': '2030-03-05', 'time': '15:30',
                'parent_reservation': parent.id}
        self.api.force_authenticate(self.client_user)
        with patch('core.views.queue_reservation_email'):
            r = self.api.post('/api/reservations/', body, format='json')
            self.assertEqual(r.status_code, 201, r.data)
            self.assertEqual(r.data['parent_reservation'], parent.id)
            # Une réservation enfant ne peut pas devenir parente, ni celle d'un autre client.
            r = self.api.post('/api/reservations/', {**body, 'time': '16:00', 'parent_reservation': r.data['id']}, format='json')
            self.assertEqual(r.status_code, 400)
            self.api.force_authenticate(User.objects.create_user('other'))
            r = self.api.post('/api/reservations/', {**body, 'time': '16:30', 'parent_reservation': parent.id}, format='json')
            self.assertEqual(r.status_code, 400)

    def test_slot_is_freed_after_cancellation(self, _sg, refund, _sse):
        refund.return_value = REFUND
        start = datetime(2030, 3, 5, 15, 30, tzinfo=SALON_TZ)  # un mardi : salon ouvert
        reservation = self.book(at=start)
        self.api.force_authenticate(self.client_user)

        def is_available():
            data = self.api.get('/api/slots/available/', {'date': '2030-03-05', 'barber': 'Willo'}).data
            return next(s['is_available'] for s in data['slots'] if s['start_time'] == '15:30')

        self.assertFalse(is_available())
        self.cancel(reservation)
        self.assertTrue(is_available())
        # Plus de conflit en base : le créneau est de nouveau réservable.
        self.book(at=start)

    def test_waitlist_is_notified_after_cancellation(self, sg, refund, publish_to_client):
        refund.return_value = REFUND
        reservation = self.book(timedelta(hours=48))
        waiting = User.objects.create_user('waiting', email='waiting@example.com')
        entry = WaitlistEntry.objects.create(
            client=waiting, barber=reservation.barber, date=reservation.date, time=reservation.time,
        )
        self.cancel(reservation)

        entry.refresh_from_db()
        self.assertIsNotNone(entry.notified_at)
        self.assertEqual(publish_to_client.call_args.args[:2], (waiting.id, 'waitlist_available'))
        self.assertTrue(Notification.objects.filter(user=waiting, type='waitlist_available').exists())
        self.assertIn('waiting@example.com', [m['personalizations'][0]['to'][0]['email'] for m in self.mails(sg)])

    def test_timezone_calculation_uses_europe_brussels(self, _sg, refund, _sse):
        refund.return_value = LATE_REFUND
        # RDV à 12h00 à Bruxelles (11h00 UTC), 23h30 plus tard : lire l'heure en
        # UTC donnerait 24h30 et déclencherait à tort un remboursement.
        winter = self.book(at=datetime(2027, 1, 15, 12, 0, tzinfo=SALON_TZ))
        with patch('django.utils.timezone.now', return_value=datetime(2027, 1, 14, 11, 30, tzinfo=dt_timezone.utc)):
            self.assertEqual(self.cancel(winter).data['status'], 'cancelled_late_partial_refund')
        # Passage à l'heure d'été : 24h30 à l'horloge, mais 23h30 réellement écoulées.
        dst = self.book(at=datetime(2027, 3, 28, 13, 0, tzinfo=SALON_TZ))
        with patch('django.utils.timezone.now', return_value=datetime(2027, 3, 27, 11, 30, tzinfo=dt_timezone.utc)):
            self.assertEqual(self.cancel(dst).data['status'], 'cancelled_late_partial_refund')
        self.assertTrue(all(c.kwargs['amount'] == 4000 for c in refund.call_args_list))

    def test_client_cancellation_notifies_barber(self, _sg, refund, _sse):
        refund.return_value = REFUND
        self.cancel(self.book(timedelta(hours=48)))
        self.assertTrue(Notification.objects.filter(type='annulation', user__isnull=True).exists())

    # ─── Webhook Stripe ───────────────────────────────────────────────────────

    def post_webhook(self, refund_status, secret='whsec_test', event_type='charge.refund.updated', refund_id='re_1'):
        payload = json.dumps({
            'id': 'evt_1', 'object': 'event', 'type': event_type,
            'data': {'object': {'id': refund_id, 'object': 'refund', 'status': refund_status,
                                'payment_intent': 'pi_1', 'amount': 4500}},
        })
        stamp = int(py_time.time())
        signature = hmac.new(secret.encode(), f'{stamp}.{payload}'.encode(), hashlib.sha256).hexdigest()
        self.api.force_authenticate(None)
        with self.captureOnCommitCallbacks(execute=True):
            return self.api.post(
                '/api/payments/stripe-webhook/', payload, content_type='application/json',
                HTTP_STRIPE_SIGNATURE=f't={stamp},v1={signature}',
            )

    def test_webhook_rejects_invalid_signature(self, _sg, _refund, _sse):
        self.assertEqual(self.post_webhook('succeeded', secret='whsec_pirate').status_code, 400)

    def test_webhook_succeeded_confirms_refund(self, _sg, refund, _sse):
        refund.return_value = REFUND
        reservation = self.book(timedelta(hours=48))
        self.cancel(reservation)
        r = self.post_webhook('succeeded')
        self.assertEqual(r.status_code, 200, r.data)
        reservation.refresh_from_db()
        self.assertIsNotNone(reservation.refund_confirmed_at)

    def test_webhook_failed_alerts_admin_and_reopens_retry(self, sg, refund, _sse):
        refund.return_value = REFUND
        reservation = self.book(timedelta(hours=48))
        self.cancel(reservation)
        with self.assertLogs('core.cancellations', level='ERROR'):
            self.post_webhook('failed')
        reservation.refresh_from_db()
        self.assertIsNone(reservation.refund_id)
        self.assertTrue(RefundAttempt.objects.filter(reservation=reservation, status='failed').exists())
        self.assertIn('admin@willobarber.be', [m['personalizations'][0]['to'][0]['email'] for m in self.mails(sg)])

    def test_webhook_records_manual_dashboard_refund(self, _sg, refund, _sse):
        refund.side_effect = stripe.error.APIConnectionError('down')
        reservation = self.book(timedelta(hours=48))
        with self.assertLogs('core.cancellations', level='ERROR'):
            self.cancel_by_barber(reservation, 'salon_unavailable')
        self.post_webhook('succeeded', event_type='refund.updated', refund_id='re_manual')
        reservation.refresh_from_db()
        self.assertEqual((reservation.refund_id, reservation.refund_amount), ('re_manual', 45))
        self.assertTrue(BarberCancellationLog.objects.get(reservation=reservation).client_was_refunded)

    # ─── Admin ────────────────────────────────────────────────────────────────

    def test_admin_retry_refund_action(self, _sg, refund, _sse):
        refund.side_effect = stripe.error.APIConnectionError('down')
        reservation = self.book(timedelta(hours=48))
        with self.assertLogs('core.cancellations', level='ERROR'):
            self.cancel_by_barber(reservation, 'salon_unavailable')
        refund.side_effect = None
        refund.return_value = REFUND
        admin_user = User.objects.create_superuser('root', password='x')
        self.client.force_login(admin_user)
        r = self.client.post('/admin/core/refundattempt/', {
            'action': 'retry_refund', '_selected_action': [RefundAttempt.objects.get().pk],
        }, follow=True)
        self.assertContains(r, '1 remboursement(s) effectué(s)')

        reservation.refresh_from_db()
        self.assertEqual(reservation.refund_id, 're_1')
        self.assertEqual(RefundAttempt.objects.filter(status='succeeded').first().attempt_number, 2)
        self.assertEqual(refund.call_args.kwargs['idempotency_key'], f'refund-{reservation.id}')
        self.assertTrue(BarberCancellationLog.objects.get().client_was_refunded)

    def test_admin_dashboard_flags_high_no_show_rate(self, _sg, _refund, _sse):
        self.cancel_by_barber(self.book(timedelta(minutes=-30), barber='Malik'), 'client_no_show')
        self.book(timedelta(hours=1), barber='Malik')
        self.book(timedelta(days=-1), barber='Willo')
        self.client.force_login(User.objects.create_superuser('root', password='x'))
        r = self.client.get('/admin/core/barbercancellationlog/dashboard/')
        self.assertEqual(r.status_code, 200)
        malik, willo = r.context['stats']
        self.assertEqual((malik['barber'], malik['total'], malik['client_no_show'], malik['no_show_rate'], malik['flagged']), ('Malik', 2, 1, 50.0, True))
        self.assertEqual((willo['total'], willo['flagged']), (1, False))
        self.assertContains(r, 'background:#C0392B')
