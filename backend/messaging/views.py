from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.db.models import Q, Max, F, Count
from django.contrib.auth.models import User
from django.utils import timezone
from django.shortcuts import get_object_or_404

from .models import Message, Chat, ChatMember, ChatMessage
from .serializers import (
    MessageSerializer, UserSerializer, ChatSerializer, 
    ChatMemberSerializer, ChatMessageSerializer, ChatDetailSerializer
)
from users.models import ClubUser, Club, Competition, CompetitionUser

class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        # Get club_id from query params, data, or session
        club_id = data.get('club_id') or request.query_params.get('club_id') or request.session.get('current_club_id')
        
        if not club_id:
            return Response({"error": "No club specified"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Clean club_id to ensure it's an integer
        try:
            club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
        except (ValueError, TypeError):
            return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Set sender to current user
        data['sender'] = request.user.id
        
        # Handle club-wide messages
        is_club_wide = data.get('is_club_wide')
        if is_club_wide and str(is_club_wide).lower() in ('true', '1'):
            data['is_club_wide'] = True
            data['recipient'] = None  # No specific recipient for club-wide messages
        elif not data.get('recipient'):
            return Response({"error": "Recipient is required for non-club-wide messages"}, 
                           status=status.HTTP_400_BAD_REQUEST)
            
        # Ensure club_id is in the data
        data['club'] = club_id
            
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def get_queryset(self):
        # Filter to only show messages related to the requesting user
        user = self.request.user
        club_id = self.request.query_params.get('club_id') or self.request.session.get('current_club_id')
        
        if not club_id:
            return Message.objects.none()
            
        # Clean club_id
        try:
            club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
        except (ValueError, TypeError):
            return Message.objects.none()
            
        # Check if user is a member of the club
        if not ClubUser.objects.filter(user=user, club_id=club_id).exists():
            return Message.objects.none()
            
        # Get messages where user is sender or recipient, or club-wide messages for the club
        return Message.objects.filter(
            Q(club_id=club_id) & (
                Q(sender=user) | 
                Q(recipient=user) | 
                Q(is_club_wide=True)
            )
        )
    
    @action(detail=False, methods=['get'])
    def inbox(self, request):
        user = request.user
        club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
        
        if not club_id:
            return Response({"error": "No club specified"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Clean club_id
        try:
            club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
        except (ValueError, TypeError):
            return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Get messages where user is recipient, or club-wide messages
        messages = Message.objects.filter(
            Q(club_id=club_id) & (
                Q(recipient=user) | 
                Q(is_club_wide=True)
            )
        )
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def outbox(self, request):
        user = request.user
        club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
        
        if not club_id:
            return Response({"error": "No club specified"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Clean club_id
        try:
            club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
        except (ValueError, TypeError):
            return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Get messages where user is sender
        messages = Message.objects.filter(sender=user, club_id=club_id)
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        user = request.user
        club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
        
        if not club_id:
            return Response({"error": "No club specified"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Clean club_id
        try:
            club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
        except (ValueError, TypeError):
            return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Get unread messages where user is recipient, or club-wide messages
        messages = Message.objects.filter(
            Q(club_id=club_id) & 
            Q(is_read=False) & (
                Q(recipient=user) | 
                Q(is_club_wide=True)
            )
        )
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        message = self.get_object()
        user = request.user
        
        # Check if user is recipient or club member for club-wide messages
        is_recipient = message.recipient == user
        is_club_member = False
        
        if message.is_club_wide:
            is_club_member = ClubUser.objects.filter(user=user, club=message.club).exists()
            
        if not (is_recipient or is_club_member):
            return Response(
                {"error": "You don't have permission to mark this message as read"}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        message.is_read = True
        message.save()
        
        serializer = self.get_serializer(message)
        return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def read_message(request, message_id):
    try:
        message = Message.objects.get(id=message_id)
    except Message.DoesNotExist:
        return Response({"error": "Message not found"}, status=status.HTTP_404_NOT_FOUND)
    
    user = request.user
    
    # Check if user is recipient or club member for club-wide messages
    is_recipient = message.recipient == user
    is_club_member = False
    
    if message.is_club_wide:
        is_club_member = ClubUser.objects.filter(user=user, club=message.club).exists()
        
    if not (is_recipient or is_club_member):
        return Response(
            {"error": "You don't have permission to mark this message as read"}, 
            status=status.HTTP_403_FORBIDDEN
        )
        
    message.is_read = True
    message.save()
    
    serializer = MessageSerializer(message)
    return Response(serializer.data)

class ClubMemberViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        club_id = self.request.query_params.get('club_id') or self.request.session.get('current_club_id')
        
        if not club_id:
            return User.objects.none()
            
        # Clean club_id
        try:
            club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
        except (ValueError, TypeError):
            return User.objects.none()
            
        # Check if user is a member of the club
        if not ClubUser.objects.filter(user=user, club_id=club_id).exists():
            return User.objects.none()
            
        # Get all users who are members of the club
        return User.objects.filter(club_memberships__club_id=club_id).exclude(id=user.id)
    
    @action(detail=False, url_path=r'(?P<club_id>\d+)', methods=['get'])
    def club_members(self, request, club_id=None):
        user = request.user
        
        if not club_id:
            return Response({"error": "No club specified"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check if user is a member of the club
        if not ClubUser.objects.filter(user=user, club_id=club_id).exists():
            return Response(
                {"error": "You are not a member of this club"}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Get all users who are members of the club
        members = User.objects.filter(club_memberships__club_id=club_id).exclude(id=user.id)
        
        serializer = self.get_serializer(members, many=True)
        return Response(serializer.data)

# New ViewSets for Chat functionality

class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        club_id = self.request.query_params.get('club_id') or self.request.session.get('current_club_id')
        
        if not club_id:
            return Chat.objects.none()
            
        # Clean club_id
        try:
            club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
        except (ValueError, TypeError):
            return Chat.objects.none()
            
        # Check if user is a member of the club
        if not ClubUser.objects.filter(user=user, club_id=club_id).exists():
            return Chat.objects.none()
            
        # Get all chats where user is a member
        return Chat.objects.filter(
            club_id=club_id,
            members__user=user
        ).annotate(
            last_message_time=Max('messages__created_at')
        ).order_by('-last_message_time', '-updated_at')
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ChatDetailSerializer
        return ChatSerializer
    
    def retrieve(self, request, *args, **kwargs):
        # Get the chat
        instance = self.get_object()
        
        # Check if user is a member of the chat
        if not instance.members.filter(user=request.user).exists():
            return Response(
                {"error": "You are not a member of this chat"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        # Get club_id from query params, data, or session
        club_id = data.get('club_id') or request.query_params.get('club_id') or request.session.get('current_club_id')
        
        if not club_id:
            return Response({"error": "No club specified"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Clean club_id to ensure it's an integer
        try:
            club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
        except (ValueError, TypeError):
            return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Set created_by to current user
        data['created_by'] = request.user.id
        
        # Ensure club_id is in the data
        data['club'] = club_id
        
        # Handle different chat types
        chat_type = data.get('chat_type', 'direct')
        
        # For direct chats, ensure there are exactly 2 members (including the creator)
        if chat_type == 'direct':
            if not data.get('members') or len(data.get('members', [])) != 1:
                return Response(
                    {"error": "Direct chats must have exactly one other member"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # For team chats, ensure the creator is a team captain
        if chat_type == 'team':
            # Check if user is a team captain (club admin)
            if not ClubUser.objects.filter(user=request.user, club_id=club_id, is_admin=True).exists():
                return Response(
                    {"error": "Only team captains can create team chats"}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # For competition chats, ensure the competition exists and belongs to the club
        if chat_type == 'competition':
            competition_id = data.get('competition')
            if not competition_id:
                return Response(
                    {"error": "Competition ID is required for competition chats"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                competition = Competition.objects.get(id=competition_id, club_id=club_id)
                data['competition'] = competition.id
            except Competition.DoesNotExist:
                return Response(
                    {"error": "Competition not found or does not belong to this club"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        chat = serializer.save()
        
        # Add the creator as a member and admin
        ChatMember.objects.create(
            chat=chat,
            user=request.user,
            is_admin=True,
            last_read_at=timezone.now()
        )
        
        # Add other members based on chat type
        if chat_type == 'direct':
            # Add the other user as a member
            other_user_id = data.get('members')[0]
            try:
                other_user = User.objects.get(id=other_user_id)
                ChatMember.objects.create(
                    chat=chat,
                    user=other_user,
                    is_admin=False
                )
            except User.DoesNotExist:
                # If the other user doesn't exist, delete the chat and return an error
                chat.delete()
                return Response(
                    {"error": "User not found"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        
        elif chat_type == 'team':
            # Add all club members as chat members
            club_members = ClubUser.objects.filter(club_id=club_id).exclude(user=request.user)
            for club_member in club_members:
                ChatMember.objects.create(
                    chat=chat,
                    user=club_member.user,
                    is_admin=club_member.is_admin
                )
        
        elif chat_type == 'competition':
            # Add all competition participants as chat members
            competition_id = data.get('competition')
            competition_users = CompetitionUser.objects.filter(
                competition_id=competition_id,
                user__isnull=False  # Exclude guest users
            ).exclude(user=request.user)
            
            for comp_user in competition_users:
                ChatMember.objects.create(
                    chat=chat,
                    user=comp_user.user,
                    is_admin=False
                )
        
        elif chat_type == 'group' and data.get('members'):
            # Add specified members to the group chat
            for member_id in data.get('members', []):
                try:
                    member = User.objects.get(id=member_id)
                    ChatMember.objects.create(
                        chat=chat,
                        user=member,
                        is_admin=False
                    )
                except User.DoesNotExist:
                    # Skip users that don't exist
                    continue
        
        # Return the created chat with detail serializer
        detail_serializer = ChatDetailSerializer(chat, context={'request': request})
        headers = self.get_success_headers(serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        chat = self.get_object()
        user = request.user
        
        # Check if user is an admin of the chat
        if not chat.members.filter(user=user, is_admin=True).exists():
            return Response(
                {"error": "Only chat admins can add members"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get the user to add
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {"error": "User ID is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            member_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user is already a member
        if chat.members.filter(user=member_user).exists():
            return Response(
                {"error": "User is already a member of this chat"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add the user as a member
        member = ChatMember.objects.create(
            chat=chat,
            user=member_user,
            is_admin=False
        )
        
        serializer = ChatMemberSerializer(member)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        chat = self.get_object()
        user = request.user
        
        # Check if user is an admin of the chat
        if not chat.members.filter(user=user, is_admin=True).exists():
            return Response(
                {"error": "Only chat admins can remove members"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get the user to remove
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {"error": "User ID is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user is a member
        try:
            member = chat.members.get(user_id=user_id)
        except ChatMember.DoesNotExist:
            return Response(
                {"error": "User is not a member of this chat"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Don't allow removing the last admin
        if member.is_admin and chat.members.filter(is_admin=True).count() <= 1:
            return Response(
                {"error": "Cannot remove the last admin from the chat"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Remove the member
        member.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        chat = self.get_object()
        user = request.user
        
        # Check if user is a member of the chat
        try:
            member = chat.members.get(user=user)
        except ChatMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this chat"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update the last_read_at timestamp
        member.last_read_at = timezone.now()
        member.save()
        
        return Response({"status": "Chat marked as read"})

class ChatMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        chat_id = self.kwargs.get('chat_pk')
        
        if not chat_id:
            return ChatMessage.objects.none()
        
        # Check if user is a member of the chat
        try:
            chat = Chat.objects.get(id=chat_id)
            if not chat.members.filter(user=user).exists():
                return ChatMessage.objects.none()
        except Chat.DoesNotExist:
            return ChatMessage.objects.none()
        
        # Get all messages in the chat
        return ChatMessage.objects.filter(chat_id=chat_id).order_by('created_at')
    
    def create(self, request, *args, **kwargs):
        chat_id = self.kwargs.get('chat_pk')
        if not chat_id:
            return Response(
                {"error": "Chat ID is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get club_id from query params, data, or session
        club_id = request.data.get('club_id') or request.query_params.get('club_id') or request.session.get('current_club_id')
        
        # Check if user is a member of the chat
        try:
            chat = Chat.objects.get(id=chat_id)
            
            # Verify the chat belongs to the specified club
            if club_id and str(chat.club.id) != str(club_id):
                return Response(
                    {"error": "Chat does not belong to the specified club"}, 
                    status=status.HTTP_403_FORBIDDEN
                )
                
            if not chat.members.filter(user=request.user).exists():
                return Response(
                    {"error": "You are not a member of this chat"}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        except Chat.DoesNotExist:
            return Response(
                {"error": "Chat not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create the message
        data = request.data.copy()
        data['chat'] = chat_id
        data['sender'] = request.user.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        
        # Update the chat's updated_at timestamp
        chat.updated_at = timezone.now()
        chat.save()
        
        # Update the sender's last_read_at timestamp
        member = chat.members.get(user=request.user)
        member.last_read_at = timezone.now()
        member.save()
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_unread_count(request):
    user = request.user
    club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
    
    if not club_id:
        return Response({"error": "No club specified"}, status=status.HTTP_400_BAD_REQUEST)
        
    # Clean club_id
    try:
        club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
    except (ValueError, TypeError):
        return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
        
    # Check if user is a member of the club
    if not ClubUser.objects.filter(user=user, club_id=club_id).exists():
        return Response({"unread_count": 0})
    
    # Get count of unread messages (old system)
    old_unread_count = Message.objects.filter(
        Q(club_id=club_id) & 
        Q(is_read=False) & (
            Q(recipient=user) | 
            Q(is_club_wide=True)
        )
    ).count()
    
    # Get count of unread messages in chats (new system)
    user_chats = Chat.objects.filter(club_id=club_id, members__user=user)
    
    new_unread_count = 0
    for chat in user_chats:
        try:
            member = chat.members.get(user=user)
            if not member.last_read_at:
                new_unread_count += chat.messages.count()
            else:
                new_unread_count += chat.messages.filter(created_at__gt=member.last_read_at).count()
        except ChatMember.DoesNotExist:
            continue
    
    # Return the total unread count
    return Response({"unread_count": old_unread_count + new_unread_count})

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_users(request):
    """
    Search for users in the same club as the requesting user.
    Used for finding users when creating a chat.
    """
    query = request.query_params.get('q', '').strip()
    club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
    
    if not query or not club_id:
        return Response([], status=status.HTTP_200_OK)
    
    # Clean club_id
    try:
        club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
    except (ValueError, TypeError):
        return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if user is a member of the club
    if not ClubUser.objects.filter(user=request.user, club_id=club_id).exists():
        return Response({"error": "You are not a member of this club"}, status=status.HTTP_403_FORBIDDEN)
    
    # Find users in the same club that match the query
    club_users = ClubUser.objects.filter(club_id=club_id).values_list('user_id', flat=True)
    
    users = User.objects.filter(
        id__in=club_users
    ).filter(
        Q(username__icontains=query) | 
        Q(first_name__icontains=query) | 
        Q(last_name__icontains=query) |
        Q(email__icontains=query)
    ).exclude(
        id=request.user.id  # Exclude the requesting user
    )[:10]  # Limit to 10 results
    
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)