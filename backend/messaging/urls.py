from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MessageViewSet, ClubMemberViewSet
from . import views

router = DefaultRouter()
router.register(r'messages', MessageViewSet)
router.register(r'club-members', ClubMemberViewSet, basename='club-members')

urlpatterns = [
    path('', include(router.urls)),
    path('read-message/<int:message_id>/', views.read_message, name='read-message'),
]