from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeagueViewSet, LeagueMemberViewSet, FixtureViewSet, PlayerAvailabilityViewSet

router = DefaultRouter()
router.register(r'leagues', LeagueViewSet, basename='league')
router.register(r'league-members', LeagueMemberViewSet, basename='league-member')
router.register(r'fixtures', FixtureViewSet, basename='fixture')
router.register(r'player-availabilities', PlayerAvailabilityViewSet, basename='player-availability')

urlpatterns = [
    path('', include(router.urls)),
] 