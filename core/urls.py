from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'barbers', views.BarberViewSet, basename='barber')
router.register(r'services', views.ServiceViewSet, basename='service')
router.register(r'reservations', views.ReservationViewSet, basename='reservation')
router.register(r'reviews', views.ReviewViewSet, basename='review')
router.register(r'waiting-list', views.WaitingListViewSet, basename='waiting-list')

urlpatterns = [
    path('auth/login/', views.login_view, name='login'),
    path('auth/register/', views.register_view, name='register'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.me_view, name='me'),
    path('dashboard/stats/', views.dashboard_stats, name='dashboard-stats'),
    path('slots/available/', views.available_slots, name='available-slots'),
    path('slots/lock/', views.lock_slot, name='lock-slot'),
    path('slots/unlock/', views.unlock_slot, name='unlock-slot'),
    path('reservations/<int:pk>/cancel/', views.cancel_reservation, name='cancel-reservation'),
    path('reservations/<int:pk>/cancel-by-barber/', views.cancel_reservation_by_barber, name='cancel-by-barber'),
    path('reservations/walk-in/', views.add_walk_in, name='walk-in'),
    path('recommendations/', views.recommendations, name='recommendations'),
    path('settings/', views.salon_settings_view, name='salon-settings'),
    path('', include(router.urls)),
]
