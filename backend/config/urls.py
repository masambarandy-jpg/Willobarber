from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from core.views import landing_page, qr_code

urlpatterns = [
    path('', landing_page, name='landing-page'),
    path('qr/', qr_code, name='qr-code'),
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/boutique/', include('boutique.urls')),
]


def server_error(request, *args, **kwargs):
    # Réponse 500 générique (DEBUG=False) : jamais de traceback côté client.
    return JsonResponse({'error': 'Internal server error'}, status=500)


handler500 = server_error
