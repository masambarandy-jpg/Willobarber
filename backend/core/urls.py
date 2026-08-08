from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from .views import (
    BarbershopViewSet, BarberViewSet, ServiceViewSet, ReservationViewSet, ClosedPeriodViewSet,
    WaitingListViewSet, BarberLeaveViewSet, NotificationViewSet,
)

router = DefaultRouter()
router.register(r'barbershops', BarbershopViewSet)
router.register(r'barbers', BarberViewSet)
router.register(r'services', ServiceViewSet)
router.register(r'reservations', ReservationViewSet)
router.register(r'closed-periods', ClosedPeriodViewSet)
router.register(r'waiting-list', WaitingListViewSet)
router.register(r'barber-leaves', BarberLeaveViewSet)
router.register(r'notifications', NotificationViewSet)

urlpatterns = [
    path('reservations/<int:pk>/acompte-invoice/', views.generate_invoice, name='invoice'),
    path('reservations/<int:pk>/qr/', views.reservation_qr_code, name='reservation-qr'),
    path('checkin/<uuid:qr_code>/', views.checkin_reservation, name='checkin'),
    path('slots/available/', views.available_slots, name='available-slots'),
    path('', include(router.urls)),
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('auth/me/photo/', views.upload_profile_picture, name='me-photo'),
    path('auth/change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('auth/passwordless-login/', views.PasswordlessLoginView.as_view(), name='passwordless-login'),
    path('auth/oauth-login/', views.OAuthLoginView.as_view(), name='oauth-login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('appointments/check-client/', views.CheckClientView.as_view(), name='check-client'),
    path('recommendations/', views.recommendations, name='recommendations'),
    path('payments/create-payment-intent/', views.create_payment_intent, name='create-payment-intent'),
    path('reservations/<int:pk>/send-final-invoice/', views.send_final_invoice, name='send-final-invoice'),
    path('reservations/<int:pk>/invoice/', views.download_final_invoice, name='reservation-invoice'),
    path('media/upload/', views.upload_client_media, name='media-upload'),
    path('media/<int:pk>/share/', views.share_client_media, name='media-share'),
    path('clients/deleted/', views.deleted_client_list, name='client-deleted-list'),
    path('clients/', views.client_list, name='client-list'),
    path('clients/<int:pk>/media/', views.client_media_list, name='client-media-list'),
    path('clients/<int:pk>/restore/', views.restore_client, name='client-restore'),
    path('clients/<int:pk>/', views.delete_client, name='client-delete'),
    path('reminders/send/', views.send_reminders, name='reminders-send'),
    path('reviews/client/', views.my_reviews, name='reviews-client'),
    path('reviews/<int:pk>/reply/', views.reply_to_review, name='review-reply'),
    path('reviews/', views.ReviewListCreateView.as_view(), name='reviews'),
]
