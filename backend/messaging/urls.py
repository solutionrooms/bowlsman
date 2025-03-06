from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MessageViewSet, ClubMemberViewSet

router = DefaultRouter()
router.register(r'messages', MessageViewSet)
router.register(r'club-members', ClubMemberViewSet, basename='club-members')

urlpatterns = [
    path('', include(router.urls)),
]