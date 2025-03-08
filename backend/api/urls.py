from django.urls import path
from .views import LoginView, LogoutView, ClubListView, ClubCreateView, ClubDetailView, ClubAdminStatusView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('clubs/', ClubListView.as_view(), name='club-list'),
    path('clubs/create/', ClubCreateView.as_view(), name='club-create'),
    path('clubs/<int:club_id>/', ClubDetailView.as_view(), name='club-detail'),
    path('club-admin-status/', ClubAdminStatusView.as_view(), name='club-admin-status'),
] 