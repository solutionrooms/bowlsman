from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeagueViewSet, LeagueMemberViewSet

router = DefaultRouter()
router.register(r'leagues', LeagueViewSet, basename='league')
router.register(r'league-members', LeagueMemberViewSet, basename='league-member')

urlpatterns = [
    path('', include(router.urls)),
] 