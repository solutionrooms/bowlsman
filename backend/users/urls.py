from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet)
router.register(r'competitions', views.CompetitionViewSet, basename='competition')
router.register(r'clubs', views.ClubViewSet, basename='club')
router.register(r'club-users', views.ClubUserViewSet, basename='club-user')
router.register(r'game-scores', views.GameScoreViewSet, basename='game-score')
router.register(r'club-applications', views.ClubApplicationViewSet, basename='club-application')
router.register(r'competition-types', views.CompetitionTypeViewSet, basename='competition-type')

urlpatterns = [
    path('', include(router.urls)),
    path('competitions/<int:competition_id>/add_player/', views.CompetitionViewSet.as_view({'post': 'add_player'})),
    path('competitions/<int:competition_id>/remove_player/', views.CompetitionViewSet.as_view({'delete': 'remove_player'})),
    path('competitions/<int:competition_id>/replace_player/', views.CompetitionViewSet.as_view({'post': 'replace_player'})),
    path('competitions/<int:competition_id>/delete_schedule/', views.CompetitionViewSet.as_view({'delete': 'delete_schedule'})),
    path('competitions/<int:competition_id>/create_schedule/', views.CompetitionViewSet.as_view({'post': 'create_schedule'})),
    path('competitions/<int:competition_id>/start_competition/', views.CompetitionViewSet.as_view({'post': 'start_competition'})),
    path('clubs/<int:club_id>/add_user/', views.ClubViewSet.as_view({'post': 'add_user'})),
    path('clubs/<int:club_id>/remove_user/', views.ClubViewSet.as_view({'post': 'remove_user'})),
    path('clubs/<int:pk>/members/', views.ClubViewSet.as_view({'get': 'members'})),
    path('clubs/<int:pk>/apply/', views.ClubViewSet.as_view({'post': 'apply'})),
    path('club-users/set_current_club/', views.ClubUserViewSet.as_view({'post': 'set_current_club', 'put': 'set_current_club'})),
    path('users/set-current-club/', views.ClubUserViewSet.as_view({'post': 'set_current_club'})),
    path('club-applications/<int:pk>/approve/', views.ClubApplicationViewSet.as_view({'post': 'approve'})),
    path('club-applications/<int:pk>/reject/', views.ClubApplicationViewSet.as_view({'post': 'reject'})),
] 