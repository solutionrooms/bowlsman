from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from .views import (
    MessageViewSet, ClubMemberViewSet, ChatViewSet, 
    ChatMessageViewSet, get_unread_count, search_users
)
from . import views

# Main router for top-level resources
router = DefaultRouter()
router.register(r'messages', MessageViewSet)
router.register(r'club-members', ClubMemberViewSet, basename='club-members')
router.register(r'chats', ChatViewSet, basename='chats')

# Nested router for chat messages
chat_router = routers.NestedSimpleRouter(router, r'chats', lookup='chat')
chat_router.register(r'messages', ChatMessageViewSet, basename='chat-messages')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(chat_router.urls)),
    path('read-message/<int:message_id>/', views.read_message, name='read-message'),
    path('unread-count/', views.get_unread_count, name='unread-count'),
    path('search-users/', search_users, name='search-users'),
]