from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SocialBowlViewSet

router = DefaultRouter()
router.register(r'notices', SocialBowlViewSet, basename='notice')

urlpatterns = [
    path('', include(router.urls)),
]