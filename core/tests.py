from datetime import date, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Barber, Service, Availability, Reservation,
    Review, WaitingList, SalonSettings, SlotLock
)

User = get_user_model()


def auth_header(user):
    return {'HTTP_AUTHORIZATION': f'Bearer {str(RefreshToken.for_user(user).access_token)}'}


def make_client(**kwargs):
    defaults = {'username': 'client', 'email': 'client@test.com',
                'password': 'TestPass123!', 'role': 'client'}
    defaults.update(kwargs)
    return User.objects.create_user(**defaults)


def make_admin(**kwargs):
    defaults = {'username': 'admin', 'email': 'admin@test.com', 'password': 'AdminPass123!'}
    defaults.update(kwargs)
    return User.objects.create_superuser(**defaults)


def make_barber_user(**kwargs):
    defaults = {'username': 'barber', 'email': 'barber@test.com',
                'password': 'TestPass123!', 'role': 'barber'}
    defaults.update(kwargs)
    return User.objects.create_user(**defaults)


# ══════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════
class LoginTestCase(APITestCase):
    def setUp(self):
        self.user = make_client()

    def test_login_with_username(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'client', 'password': 'TestPass123!'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data['user']['role'], 'client')

    def test_login_with_email(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'client@test.com', 'password': 'TestPass123!'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_login_wrong_password(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'client', 'password': 'wrongpass'
        })
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_missing_fields(self):
        res = self.client.post('/api/auth/login/', {'username': 'client'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_deleted_user(self):
        self.user.is_deleted = True
        self.user.save()
        res = self.client.post('/api/auth/login/', {
            'username': 'client', 'password': 'TestPass123!'
        })
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class RegisterTestCase(APITestCase):
    def test_register_success(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'newuser',
            'email': 'new@test.com',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'Secure@123!',
            'password2': 'Secure@123!',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', res.data)
        self.assertEqual(User.objects.filter(username='newuser').count(), 1)

    def test_register_password_mismatch(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'u2', 'email': 'u2@test.com',
            'password': 'Secure@123!', 'password2': 'Different@123!',
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_username(self):
        make_client()
        res = self.client.post('/api/auth/register/', {
            'username': 'client', 'email': 'other@test.com',
            'password': 'Secure@123!', 'password2': 'Secure@123!',
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class MeTestCase(APITestCase):
    def setUp(self):
        self.user = make_client()

    def test_get_me(self):
        res = self.client.get('/api/auth/me/', **auth_header(self.user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], 'client')

    def test_get_me_unauthenticated(self):
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_me(self):
        res = self.client.patch('/api/auth/me/', {'first_name': 'Updated'},
                                **auth_header(self.user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['first_name'], 'Updated')

    def test_patch_me_role_readonly(self):
        res = self.client.patch('/api/auth/me/', {'role': 'admin'},
                                **auth_header(self.user))
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, 'client')


class LogoutTestCase(APITestCase):
    def setUp(self):
        self.user = make_client()

    def test_logout_success(self):
        refresh = RefreshToken.for_user(self.user)
        res = self.client.post('/api/auth/logout/',
                               {'refresh': str(refresh)},
                               **auth_header(self.user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_logout_invalid_token(self):
        res = self.client.post('/api/auth/logout/',
                               {'refresh': 'invalidtoken'},
                               **auth_header(self.user))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


# ══════════════════════════════════════════
# BARBERS
# ══════════════════════════════════════════
class BarberTestCase(APITestCase):
    def setUp(self):
        self.client_user = make_client()
        bu = make_barber_user()
        self.barber = Barber.objects.create(user=bu, title='Senior', is_active=True)
        inactive_bu = make_barber_user(username='barber2', email='b2@test.com')
        Barber.objects.create(user=inactive_bu, is_active=False)

    def test_list_barbers_only_active(self):
        res = self.client.get('/api/barbers/', **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['title'], 'Senior')

    def test_list_barbers_unauthenticated(self):
        res = self.client.get('/api/barbers/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retrieve_barber(self):
        res = self.client.get(f'/api/barbers/{self.barber.pk}/',
                              **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['title'], 'Senior')


# ══════════════════════════════════════════
# SERVICES
# ══════════════════════════════════════════
class ServiceTestCase(APITestCase):
    def setUp(self):
        self.client_user = make_client()
        self.admin = make_admin()
        self.service = Service.objects.create(
            name='Coupe Homme', category='coupe_homme',
            price=Decimal('25.00'), duration=30, status='active'
        )
        Service.objects.create(
            name='Brouillon', category='barbe',
            price=Decimal('10.00'), duration=15, status='draft'
        )

    def test_list_services_client_sees_only_active(self):
        res = self.client.get('/api/services/', **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_list_services_admin_sees_all(self):
        res = self.client.get('/api/services/', **auth_header(self.admin))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)

    def test_create_service_admin(self):
        res = self.client.post('/api/services/', {
            'name': 'Barbe', 'category': 'barbe',
            'price': '15.00', 'duration': 20, 'status': 'active'
        }, **auth_header(self.admin))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_create_service_client_forbidden(self):
        res = self.client.post('/api/services/', {
            'name': 'Barbe', 'category': 'barbe',
            'price': '15.00', 'duration': 20, 'status': 'active'
        }, **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_service_soft(self):
        res = self.client.delete(f'/api/services/{self.service.pk}/',
                                 **auth_header(self.admin))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.service.refresh_from_db()
        self.assertTrue(self.service.is_deleted)


# ══════════════════════════════════════════
# RESERVATIONS
# ══════════════════════════════════════════
class ReservationTestCase(APITestCase):
    def setUp(self):
        self.client_user = make_client()
        self.admin = make_admin()
        bu = make_barber_user()
        self.barber = Barber.objects.create(user=bu, title='Barber', is_active=True)
        self.service = Service.objects.create(
            name='Coupe', category='coupe_homme',
            price=Decimal('25.00'), duration=30, status='active'
        )
        SalonSettings.objects.create(
            pk=1, booking_cutoff_hour=23, min_booking_hours_ahead=0,
            bookings_open=True, rush_mode_active=False
        )
        self.future_date = date.today() + timedelta(days=3)
        Availability.objects.create(
            barber=self.barber, date=self.future_date,
            start_time=time(10, 0), end_time=time(10, 30), is_available=True
        )
        Availability.objects.create(
            barber=self.barber, date=self.future_date,
            start_time=time(11, 0), end_time=time(11, 30), is_available=True
        )

    def test_create_reservation(self):
        res = self.client.post('/api/reservations/', {
            'barber': self.barber.pk,
            'service': self.service.pk,
            'date': str(self.future_date),
            'start_time': '10:00',
            'end_time': '10:30',
        }, **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Reservation.objects.filter(client=self.client_user).exists())

    def test_duplicate_slot_rejected(self):
        Reservation.objects.create(
            client=self.client_user, barber=self.barber, service=self.service,
            date=self.future_date, start_time=time(10, 0), end_time=time(10, 30),
            total_amount=Decimal('25.00'), status='confirmed'
        )
        res = self.client.post('/api/reservations/', {
            'barber': self.barber.pk, 'service': self.service.pk,
            'date': str(self.future_date), 'start_time': '10:00', 'end_time': '10:30',
        }, **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_own_reservations(self):
        other = make_client(username='other', email='other@test.com')
        Reservation.objects.create(
            client=self.client_user, barber=self.barber, service=self.service,
            date=self.future_date, start_time=time(10, 0), end_time=time(10, 30),
            total_amount=Decimal('25.00'), status='confirmed'
        )
        Reservation.objects.create(
            client=other, barber=self.barber, service=self.service,
            date=self.future_date, start_time=time(11, 0), end_time=time(11, 30),
            total_amount=Decimal('25.00'), status='confirmed'
        )
        res = self.client.get('/api/reservations/', **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_admin_sees_all_reservations(self):
        other = make_client(username='other2', email='other2@test.com')
        Reservation.objects.create(
            client=self.client_user, barber=self.barber, service=self.service,
            date=self.future_date, start_time=time(10, 0), end_time=time(10, 30),
            total_amount=Decimal('25.00'), status='confirmed'
        )
        Reservation.objects.create(
            client=other, barber=self.barber, service=self.service,
            date=self.future_date, start_time=time(11, 0), end_time=time(11, 30),
            total_amount=Decimal('25.00'), status='confirmed'
        )
        res = self.client.get('/api/reservations/', **auth_header(self.admin))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)

    def test_cancel_reservation(self):
        reservation = Reservation.objects.create(
            client=self.client_user, barber=self.barber, service=self.service,
            date=self.future_date, start_time=time(10, 0), end_time=time(10, 30),
            total_amount=Decimal('25.00'), status='confirmed'
        )
        res = self.client.post(f'/api/reservations/{reservation.pk}/cancel/',
                               **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, 'cancelled_client')

    def test_cancel_already_cancelled(self):
        reservation = Reservation.objects.create(
            client=self.client_user, barber=self.barber, service=self.service,
            date=self.future_date, start_time=time(10, 0), end_time=time(10, 30),
            total_amount=Decimal('25.00'), status='cancelled_client'
        )
        res = self.client.post(f'/api/reservations/{reservation.pk}/cancel/',
                               **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_by_barber_admin_only(self):
        reservation = Reservation.objects.create(
            client=self.client_user, barber=self.barber, service=self.service,
            date=self.future_date, start_time=time(10, 0), end_time=time(10, 30),
            total_amount=Decimal('25.00'), status='confirmed'
        )
        res = self.client.post(f'/api/reservations/{reservation.pk}/cancel-by-barber/',
                               **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = self.client.post(f'/api/reservations/{reservation.pk}/cancel-by-barber/',
                               **auth_header(self.admin))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, 'cancelled_barber')


# ══════════════════════════════════════════
# SLOT LOCK
# ══════════════════════════════════════════
class SlotLockTestCase(APITestCase):
    def setUp(self):
        self.user1 = make_client()
        self.user2 = make_client(username='client2', email='c2@test.com')
        bu = make_barber_user()
        self.barber = Barber.objects.create(user=bu, is_active=True)
        self.future_date = date.today() + timedelta(days=2)

    def test_lock_slot(self):
        res = self.client.post('/api/slots/lock/', {
            'barber_id': self.barber.pk,
            'date': str(self.future_date),
            'start_time': '10:00',
        }, **auth_header(self.user1))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(SlotLock.objects.filter(barber=self.barber).exists())

    def test_lock_conflict(self):
        self.client.post('/api/slots/lock/', {
            'barber_id': self.barber.pk,
            'date': str(self.future_date),
            'start_time': '10:00',
        }, **auth_header(self.user1))
        res = self.client.post('/api/slots/lock/', {
            'barber_id': self.barber.pk,
            'date': str(self.future_date),
            'start_time': '10:00',
        }, **auth_header(self.user2))
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)

    def test_unlock_slot(self):
        SlotLock.objects.create(
            barber=self.barber, date=self.future_date,
            start_time=time(10, 0), locked_by=self.user1,
            locked_until=__import__('django.utils.timezone', fromlist=['timezone']).timezone.now()
                         + timedelta(minutes=3)
        )
        res = self.client.delete('/api/slots/unlock/', {
            'barber_id': self.barber.pk,
            'date': str(self.future_date),
            'start_time': '10:00',
        }, **auth_header(self.user1))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(SlotLock.objects.filter(barber=self.barber, locked_by=self.user1).exists())


# ══════════════════════════════════════════
# REVIEWS
# ══════════════════════════════════════════
class ReviewTestCase(APITestCase):
    def setUp(self):
        self.client_user = make_client()
        self.admin = make_admin()
        bu = make_barber_user()
        self.barber = Barber.objects.create(user=bu, is_active=True)
        self.service = Service.objects.create(
            name='Coupe', category='coupe_homme',
            price=Decimal('25.00'), duration=30, status='active'
        )
        future_date = date.today() + timedelta(days=5)
        self.reservation = Reservation.objects.create(
            client=self.client_user, barber=self.barber, service=self.service,
            date=future_date, start_time=time(10, 0), end_time=time(10, 30),
            total_amount=Decimal('25.00'), status='completed'
        )

    def test_list_published_reviews(self):
        Review.objects.create(
            reservation=self.reservation, client=self.client_user,
            barber=self.barber, rating=5, status='published'
        )
        res = self.client.get('/api/reviews/', **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_create_review(self):
        res = self.client.post('/api/reviews/', {
            'reservation': self.reservation.pk,
            'rating': 5,
            'comment': 'Excellent service !'
        }, **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Review.objects.filter(client=self.client_user).count(), 1)

    def test_reply_to_review_admin(self):
        review = Review.objects.create(
            reservation=self.reservation, client=self.client_user,
            barber=self.barber, rating=4, status='published'
        )
        res = self.client.post(f'/api/reviews/{review.pk}/reply/',
                               {'reply': 'Merci pour votre avis !'},
                               **auth_header(self.admin))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.reply, 'Merci pour votre avis !')

    def test_reply_to_review_client_forbidden(self):
        review = Review.objects.create(
            reservation=self.reservation, client=self.client_user,
            barber=self.barber, rating=4, status='published'
        )
        res = self.client.post(f'/api/reviews/{review.pk}/reply/',
                               {'reply': 'Réponse non autorisée'},
                               **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


# ══════════════════════════════════════════
# WAITING LIST
# ══════════════════════════════════════════
class WaitingListTestCase(APITestCase):
    def setUp(self):
        self.client_user = make_client()
        self.admin = make_admin()
        self.service = Service.objects.create(
            name='Coupe', category='coupe_homme',
            price=Decimal('25.00'), duration=30, status='active'
        )
        self.preferred_date = date.today() + timedelta(days=1)

    def test_join_waiting_list(self):
        res = self.client.post('/api/waiting-list/', {
            'service': self.service.pk,
            'preferred_date': str(self.preferred_date),
        }, **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['position'], 1)

    def test_position_increments(self):
        other = make_client(username='other', email='other@test.com')
        self.client.post('/api/waiting-list/', {
            'service': self.service.pk,
            'preferred_date': str(self.preferred_date),
        }, **auth_header(other))
        res = self.client.post('/api/waiting-list/', {
            'service': self.service.pk,
            'preferred_date': str(self.preferred_date),
        }, **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['position'], 2)

    def test_client_sees_only_own(self):
        other = make_client(username='other2', email='other2@test.com')
        WaitingList.objects.create(
            client=other, service=self.service,
            preferred_date=self.preferred_date, position=1
        )
        WaitingList.objects.create(
            client=self.client_user, service=self.service,
            preferred_date=self.preferred_date, position=2
        )
        res = self.client.get('/api/waiting-list/', **auth_header(self.client_user))
        self.assertEqual(len(res.data), 1)

    def test_admin_sees_all(self):
        other = make_client(username='other3', email='other3@test.com')
        WaitingList.objects.create(
            client=other, service=self.service,
            preferred_date=self.preferred_date, position=1
        )
        WaitingList.objects.create(
            client=self.client_user, service=self.service,
            preferred_date=self.preferred_date, position=2
        )
        res = self.client.get('/api/waiting-list/', **auth_header(self.admin))
        self.assertEqual(len(res.data), 2)


# ══════════════════════════════════════════
# SALON SETTINGS
# ══════════════════════════════════════════
class SalonSettingsTestCase(APITestCase):
    def setUp(self):
        self.client_user = make_client()
        self.admin = make_admin()
        SalonSettings.objects.create(pk=1)

    def test_get_settings_client_limited_fields(self):
        res = self.client.get('/api/settings/', **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('bookings_open', res.data)
        self.assertNotIn('max_late_cancellations', res.data)

    def test_get_settings_admin_full(self):
        res = self.client.get('/api/settings/', **auth_header(self.admin))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('max_late_cancellations', res.data)
        self.assertIn('rush_message_fr', res.data)

    def test_patch_settings_admin(self):
        res = self.client.patch('/api/settings/', {'rush_mode_active': True},
                                **auth_header(self.admin))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['rush_mode_active'])

    def test_patch_settings_client_forbidden(self):
        res = self.client.patch('/api/settings/', {'rush_mode_active': True},
                                **auth_header(self.client_user))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_settings_unauthenticated(self):
        res = self.client.get('/api/settings/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
