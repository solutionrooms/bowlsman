from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SocialBowlViewSet

router = DefaultRouter()
router.register(r'social-bowls', SocialBowlViewSet, basename='social-bowl')

urlpatterns = [
    path('', include(router.urls)),
]