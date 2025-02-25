from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet)
router.register(r'competitions', views.CompetitionViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('competitions/<int:competition_id>/add_player/', views.CompetitionViewSet.as_view({'post': 'add_player'})),
    path('competitions/<int:competition_id>/remove_player/', views.CompetitionViewSet.as_view({'delete': 'remove_player'})),
    path('competitions/<int:competition_id>/reorder_players/', views.CompetitionViewSet.as_view({'post': 'reorder_players'})),
    path('competitions/<int:competition_id>/replace_player/', views.CompetitionViewSet.as_view({'post': 'replace_player'})),
]

# Add create_schedule as a viewset action
views.CompetitionViewSet.create_schedule = views.create_schedule
views.CompetitionViewSet.create_schedule.mapping = {'post': 'create_schedule'}
views.CompetitionViewSet.create_schedule.detail = True
views.CompetitionViewSet.create_schedule.url_path = 'create_schedule' 