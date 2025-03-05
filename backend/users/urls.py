from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet)
router.register(r'competitions', views.CompetitionViewSet, basename='competition')
router.register(r'clubs', views.ClubViewSet, basename='club')
router.register(r'club-users', views.ClubUserViewSet, basename='club-user')

urlpatterns = [
    path('', include(router.urls)),
    path('competitions/<int:competition_id>/add_player/', views.CompetitionViewSet.as_view({'post': 'add_player'})),
    path('competitions/<int:competition_id>/remove_player/', views.CompetitionViewSet.as_view({'delete': 'remove_player'})),
    path('competitions/<int:competition_id>/replace_player/', views.CompetitionViewSet.as_view({'post': 'replace_player'})),
    path('competitions/<int:competition_id>/delete_schedule/', views.CompetitionViewSet.as_view({'delete': 'delete_schedule'})),
    path('competitions/<int:competition_id>/create_schedule/', views.create_schedule),
    path('clubs/<int:club_id>/add_user/', views.ClubViewSet.as_view({'post': 'add_user'})),
    path('clubs/<int:club_id>/remove_user/', views.ClubViewSet.as_view({'post': 'remove_user'})),
    path('club-users/set_current_club/', views.ClubUserViewSet.as_view({'put': 'set_current_club'})),
] 