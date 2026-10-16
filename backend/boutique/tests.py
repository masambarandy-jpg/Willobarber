import json
from datetime import date, time
from decimal import Decimal
from unittest.mock import patch

import stripe

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Barbershop, Notification, Reservation, Service, User
from .invoices import boutique_invoice_url, build_boutique_invoice_pdf
from .models import Order, Product


def intent(amount, user_id, status='succeeded', currency='eur'):
    # Vrai StripeObject (et non un dict) : c'est ce que renvoie PaymentIntent.retrieve().
    return stripe.StripeObject.construct_from(
        {'status': status, 'amount': amount, 'currency': currency, 'metadata': {'user_id': str(user_id)}},
        'sk_test_x',
    )


class SyncThread:
    """Remplace threading.Thread : exécute la cible tout de suite."""

    def __init__(self, target, args=(), daemon=None):
        self.target, self.args = target, args

    def start(self):
        self.target(*self.args)


@override_settings(STRIPE_SECRET_KEY='sk_test_x')
@patch('boutique.views.threading.Thread', SyncThread)
@patch('boutique.invoices.send_invoice_email')
@patch('core.sse.publish_to_client')
@patch('core.sse.publish')
class BoutiqueOrderPaymentTests(TestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(
            'randy', email='randy@example.com', first_name='Randy', last_name='Masamba', phone='+32470000000',
        )
        self.cire = Product.objects.create(nom='Cire Mate Signature', categorie='cire', prix=Decimal('18.00'), stock=10)
        self.huile = Product.objects.create(nom='Huile Barbe Cèdre', categorie='huile', prix=Decimal('24.00'), stock=10)
        self.api = APIClient()
        self.api.force_authenticate(self.client_user)

    def order_body(self, **extra):
        return {
            'items': [{'product_id': self.cire.id, 'quantite': 1}, {'product_id': self.huile.id, 'quantite': 2}],
            'payment_intent_id': 'pi_123',
            'delivery_type': 'retrait_salon',
            **extra,
        }

    def post(self, body):
        with self.captureOnCommitCallbacks(execute=True):
            return self.api.post('/api/boutique/commandes/', body, format='json')

    @patch('stripe.PaymentIntent.retrieve')
    def test_paid_order_triggers_invoice_and_coiffeur_notification(self, retrieve, publish, publish_to_client, send_email):
        retrieve.return_value = intent(6600, self.client_user.id)
        response = self.post(self.order_body())

        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get()
        self.assertEqual(order.status, 'preparing')
        self.assertEqual(order.total, Decimal('66.00'))
        self.assertIsNotNone(order.paid_at)
        self.assertIsNotNone(order.invoice_sent_at)
        self.cire.refresh_from_db()
        self.assertEqual(self.cire.stock, 9)

        # Email avec la facture PDF en pièce jointe.
        send_email.assert_called_once()
        self.assertTrue(send_email.call_args.kwargs['pdf_bytes'].startswith(b'%PDF'))

        # Notification client « boutique_invoice » avec lien signé, poussée en SSE client.
        client_notif = Notification.objects.get(user=self.client_user)
        self.assertEqual(client_notif.type, 'boutique_invoice')
        self.assertIn('/api/boutique/factures/', client_notif.data['invoice_url'])
        publish_to_client.assert_called_once()
        self.assertEqual(publish_to_client.call_args.args[:2], (self.client_user.id, 'notification'))

        # Notification coiffeur + événement new_boutique_order.
        coiffeur_notif = Notification.objects.get(user__isnull=True)
        self.assertEqual(coiffeur_notif.type, 'boutique_order')
        publish.assert_called_once()
        event, payload = publish.call_args.args
        self.assertEqual(event, 'new_boutique_order')
        self.assertEqual(payload['order_id'], order.id)
        self.assertEqual(payload['client_name'], 'Randy Masamba')
        self.assertEqual(payload['client_phone'], '+32470000000')
        self.assertEqual(payload['items'], [
            {'name': 'Cire Mate Signature', 'qty': 1, 'price': 18.0},
            {'name': 'Huile Barbe Cèdre', 'qty': 2, 'price': 24.0},
        ])
        self.assertEqual(payload['total'], 66.0)
        self.assertEqual(payload['delivery_type'], 'retrait_salon')
        self.assertTrue(payload['created_at'].endswith('Z'))
        self.assertEqual(payload['notification']['id'], coiffeur_notif.id)

    @patch('stripe.PaymentIntent.retrieve')
    def test_home_delivery_adds_fee_to_total(self, retrieve, *_):
        retrieve.return_value = intent(7095, self.client_user.id)
        response = self.post(self.order_body(delivery_type='domicile', delivery_address='Rue Neuve 1, 1000 Bruxelles'))

        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get()
        self.assertEqual(order.delivery_fee, Decimal('4.95'))
        self.assertEqual(order.total, Decimal('70.95'))
        self.assertEqual(order.delivery_address, 'Rue Neuve 1, 1000 Bruxelles')

    @patch('boutique.views.notify_coiffeur_new_order', side_effect=RuntimeError('boom'))
    @patch('stripe.PaymentIntent.retrieve')
    def test_coiffeur_notification_failure_never_cancels_paid_order(self, retrieve, _notify, publish, publish_to_client, send_email):
        retrieve.return_value = intent(6600, self.client_user.id)
        with self.assertLogs('boutique.views', level='ERROR'):
            response = self.post(self.order_body())

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Order.objects.exists())
        send_email.assert_called_once()  # la facture client part quand même

    @patch('stripe.PaymentIntent.retrieve')
    def test_sse_publish_failure_is_logged_not_raised(self, retrieve, publish, *_):
        retrieve.return_value = intent(6600, self.client_user.id)
        publish.side_effect = RuntimeError('broker down')
        with self.assertLogs('boutique.invoices', level='ERROR'):
            response = self.post(self.order_body())

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Notification.objects.filter(type='boutique_order').exists())

    def test_payment_is_required(self, publish, *_):
        response = self.post(self.order_body(payment_intent_id=''))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Order.objects.exists())
        publish.assert_not_called()

    @patch('stripe.PaymentIntent.retrieve')
    def test_amount_mismatch_is_rejected(self, retrieve, publish, *_):
        retrieve.return_value = intent(100, self.client_user.id)
        response = self.post(self.order_body())
        self.assertEqual(response.status_code, 402)
        self.assertFalse(Order.objects.exists())
        publish.assert_not_called()

    @patch('stripe.PaymentIntent.retrieve')
    def test_someone_elses_payment_is_rejected(self, retrieve, *_):
        retrieve.return_value = intent(6600, self.client_user.id + 1)
        response = self.post(self.order_body())
        self.assertEqual(response.status_code, 402)
        self.assertFalse(Order.objects.exists())

    @patch('stripe.PaymentIntent.retrieve')
    def test_payment_cannot_pay_two_orders(self, retrieve, *_):
        retrieve.return_value = intent(6600, self.client_user.id)
        self.assertEqual(self.post(self.order_body()).status_code, 201)
        self.assertEqual(self.post(self.order_body()).status_code, 400)
        self.assertEqual(Order.objects.count(), 1)

    @patch('stripe.Refund.create')
    @patch('stripe.PaymentIntent.retrieve')
    def test_out_of_stock_after_payment_is_refunded(self, retrieve, refund, *_):
        retrieve.return_value = intent(6600, self.client_user.id)
        Product.objects.filter(pk=self.huile.pk).update(stock=1)
        response = self.post(self.order_body())
        self.assertEqual(response.status_code, 400)
        refund.assert_called_once_with(payment_intent='pi_123')

    @patch('stripe.Refund.create')
    @patch('stripe.PaymentIntent.retrieve')
    def test_never_refunds_another_clients_payment(self, retrieve, refund, *_):
        retrieve.return_value = intent(6600, self.client_user.id + 1)
        Product.objects.filter(pk=self.huile.pk).update(stock=1)
        self.post(self.order_body())
        refund.assert_not_called()


class BoutiqueStaffOrderTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('willo', role='admin')
        self.customer = User.objects.create_user('client', first_name='Sam', phone='+32 470 11 22 33')
        product = Product.objects.create(nom='Pommade', categorie='pommade', prix=Decimal('20.00'), stock=5)
        self.order = Order.objects.create(
            user=self.customer, total=Decimal('24.95'), delivery_fee=Decimal('4.95'),
            delivery_type='domicile', delivery_address='Rue X 1', status='preparing',
            payment_intent_id='pi_staff', paid_at=timezone.now(),
        )
        self.order.items.create(product=product, quantite=1, prix_unitaire=Decimal('20.00'))
        self.api = APIClient()

    def test_only_staff_can_list_orders(self):
        self.api.force_authenticate(self.customer)
        self.assertEqual(self.api.get('/api/boutique/gestion/commandes/').status_code, 403)

        self.api.force_authenticate(self.staff)
        data = self.api.get('/api/boutique/gestion/commandes/?period=all').data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['client_name'], 'Sam')
        self.assertEqual(data[0]['client_phone'], '+32 470 11 22 33')
        self.assertIn('/api/boutique/factures/', data[0]['invoice_url'])

    def test_unpaid_legacy_orders_are_hidden(self):
        Order.objects.create(user=self.customer, total=Decimal('10.00'))
        self.api.force_authenticate(self.staff)
        self.assertEqual(len(self.api.get('/api/boutique/gestion/commandes/?period=all').data), 1)

    @patch('core.sse.publish')
    def test_status_change_follows_delivery_type(self, publish):
        self.api.force_authenticate(self.staff)
        url = f'/api/boutique/gestion/commandes/{self.order.id}/'

        self.assertEqual(self.api.patch(url, {'status': 'picked_up'}, format='json').status_code, 400)

        response = self.api.patch(url, {'status': 'shipped'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status_label'], 'Expédiée')
        publish.assert_called_once_with('boutique_order_updated', {'order_id': self.order.id, 'status': 'shipped'})

    def test_signed_invoice_link(self):
        url = boutique_invoice_url(self.order, 'http://testserver/')
        response = self.api.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')

        self.assertEqual(self.api.get('/api/boutique/factures/forged/').status_code, 404)

    def test_pdf_escapes_user_input(self):
        self.order.delivery_address = '<b>Rue & Co</b>'
        pdf_bytes, number = build_boutique_invoice_pdf(self.order)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))
        self.assertEqual(number, f'WB-BTQ-{self.order.created_at.year}-{self.order.id:05d}')


class ReservationFlowRegressionTests(TestCase):
    @patch('core.sse.publish')
    def test_new_reservation_event_unchanged(self, publish):
        owner = User.objects.create_user('owner', role='admin')
        shop = Barbershop.objects.create(name='WB', address='x', phone='x', owner=owner)
        service = Service.objects.create(name='Signature', price=45, duration=45, barbershop=shop)
        with self.captureOnCommitCallbacks(execute=True):
            Reservation.objects.create(user=owner, service=service, date=date(2026, 10, 20), time=time(14, 0))

        self.assertEqual(Notification.objects.get().type, 'rdv')
        self.assertEqual(publish.call_args.args[0], 'new_reservation')


class ServerErrorHandlerTests(TestCase):
    def test_500_is_generic_json_without_traceback(self):
        from django.conf import settings
        from django.test import RequestFactory
        from config.urls import handler500

        self.assertFalse(settings.DEBUG)
        response = handler500(RequestFactory().get('/'))
        self.assertEqual(response.status_code, 500)
        self.assertEqual(json.loads(response.content), {'error': 'Internal server error'})
