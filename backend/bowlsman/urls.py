"""
URL Configuration for bowlsman project
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.authtoken.views import obtain_auth_token

from users.views import (
    UserViewSet, CompetitionViewSet, CompetitionUserViewSet,
    create_schedule, LoginView, ClubViewSet, ClubUserViewSet, GameScoreViewSet,
    ClubSearchView, ClubApplicationViewSet, restart_competition, search_users,
    reset_password_request, validate_reset_token, reset_password, CompetitionTypeViewSet
)

from social.views import SocialBowlViewSet, SocialBowlParticipantViewSet
from messaging.views import MessageViewSet, ChatViewSet, ChatMessageViewSet, ChatMemberViewSet
from leagues.views import LeagueViewSet, LeagueMemberViewSet, player_stats

# Create a router and register our viewsets with it
router = routers.DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'competitions', CompetitionViewSet)
router.register(r'competition-users', CompetitionUserViewSet)
router.register(r'competition-types', CompetitionTypeViewSet)
router.register(r'clubs', ClubViewSet)
router.register(r'club-users', ClubUserViewSet)
router.register(r'game-scores', GameScoreViewSet)
router.register(r'club-applications', ClubApplicationViewSet)
router.register(r'social-bowls', SocialBowlViewSet)
router.register(r'social-bowl-participants', SocialBowlParticipantViewSet)
router.register(r'messages', MessageViewSet)
router.register(r'chats', ChatViewSet)
router.register(r'chat-messages', ChatMessageViewSet)
router.register(r'chat-members', ChatMemberViewSet)
router.register(r'leagues', LeagueViewSet)
router.register(r'league-members', LeagueMemberViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/token/', obtain_auth_token, name='api_token'),
    path('api/login/', LoginView.as_view(), name='login'),
    path('api/competitions/<int:competition_id>/schedule/', create_schedule, name='create_schedule'),
    path('api/competitions/<int:competition_id>/restart/', restart_competition, name='restart_competition'),
    path('api/clubs/search/', ClubSearchView.as_view(), name='club_search'),
    path('api/users/search/', search_users, name='search_users'),
    path('api/reset-password-request/', reset_password_request, name='reset_password_request'),
    path('api/validate-reset-token/<uuid:token>/', validate_reset_token, name='validate_reset_token'),
    path('api/reset-password/', reset_password, name='reset_password'),
    path('api/player-stats/<int:league_id>/', player_stats, name='player_stats'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) 