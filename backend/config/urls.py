from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from users.views import UserViewSet, CompetitionViewSet, CompetitionUserViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'competitions', CompetitionViewSet, basename='competition')
router.register(r'competition-users', CompetitionUserViewSet, basename='competition-user')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
] 