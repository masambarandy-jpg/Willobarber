from django.contrib import admin
from django.urls import path, include
from core.views import landing_page, qr_code

urlpatterns = [
    path('', landing_page, name='landing-page'),
    path('qr/', qr_code, name='qr-code'),
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/boutique/', include('boutique.urls')),
]