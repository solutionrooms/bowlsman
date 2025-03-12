from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.conf import settings
from django.conf.urls.static import static
from .views import log_page_view

# Only register viewsets that aren't already in users.urls
router = DefaultRouter()

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/', include('users.urls')),  # Include the users app URLs
    path('api/', include('api.urls')),    # Include the api app URLs
    path('api/', include('messaging.urls')),  # Include the messaging app URLs
    path('api/', include('social.urls')),  # Include the social app URLs
    path('api/', include('leagues.urls')),  # Include the leagues app URLs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/log/page-view/', log_page_view, name='log-page-view'),  # Add page view logging endpoint
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) 