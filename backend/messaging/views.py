from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from django.db.models import Q
from django.contrib.auth.models import User

from .models import Message
from .serializers import MessageSerializer, UserSerializer
from users.models import ClubUser

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
        
        # Get the user's current club
        current_club_id = self.request.query_params.get('club_id') or self.request.session.get('current_club_id')
        if not current_club_id:
            return Message.objects.none()
            
        # Clean club_id to ensure it's an integer
        try:
            current_club_id = int(current_club_id.rstrip('/') if isinstance(current_club_id, str) else current_club_id)
        except (ValueError, TypeError):
            # Return empty queryset on invalid club ID
            return Message.objects.none()
        
        # Get messages where the user is either the sender or recipient
        # or club-wide messages for the clubs they are a member of
        return Message.objects.filter(
            Q(sender=user, club_id=current_club_id) | 
            Q(recipient=user, club_id=current_club_id) |
            Q(is_club_wide=True, club_id=current_club_id)
        ).distinct()
    
    @action(detail=False, methods=['get'])
    def inbox(self, request):
        user = request.user
        current_club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
        
        if not current_club_id:
            return Response({"error": "No current club selected"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Clean club_id to ensure it's an integer
        try:
            current_club_id = int(current_club_id.rstrip('/') if isinstance(current_club_id, str) else current_club_id)
        except (ValueError, TypeError):
            return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get messages where user is the recipient or club-wide messages
        messages = Message.objects.filter(
            (Q(recipient=user) | Q(is_club_wide=True)) &
            Q(club_id=current_club_id)
        ).order_by('-created_at')
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def outbox(self, request):
        user = request.user
        current_club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
        
        if not current_club_id:
            return Response({"error": "No current club selected"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Clean club_id to ensure it's an integer
        try:
            current_club_id = int(current_club_id.rstrip('/') if isinstance(current_club_id, str) else current_club_id)
        except (ValueError, TypeError):
            return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get messages where user is the sender
        messages = Message.objects.filter(
            sender=user,
            club_id=current_club_id
        ).order_by('-created_at')
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        user = request.user
        current_club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
        
        if not current_club_id:
            return Response({"error": "No current club selected"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Clean club_id to ensure it's an integer
        try:
            current_club_id = int(current_club_id.rstrip('/') if isinstance(current_club_id, str) else current_club_id)
        except (ValueError, TypeError):
            return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get unread messages where user is the recipient or club-wide messages
        messages = Message.objects.filter(
            (Q(recipient=user) | Q(is_club_wide=True)) &
            Q(club_id=current_club_id),
            is_read=False
        ).order_by('-created_at')
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        message = self.get_object()
        user = request.user
        
        # Check if the user is the recipient or if the message is club-wide and user is a member
        is_recipient = message.recipient == user
        is_club_member = message.is_club_wide and hasattr(user, 'club_memberships') and user.club_memberships.filter(club=message.club).exists()
        
        if is_recipient or is_club_member:
            # Only update if not already read to avoid unnecessary DB writes
            if not message.is_read:
                message.is_read = True
                message.save()
            return Response({"status": "message marked as read", "message_id": message.id})
        else:
            return Response({"error": "Not allowed", "message_id": message.id}, status=status.HTTP_403_FORBIDDEN)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def read_message(request, message_id):
    try:
        # Get the message
        message = Message.objects.get(id=message_id)
        user = request.user
        
        # Check if user is recipient or club member for club-wide messages
        is_recipient = message.recipient == user
        is_club_member = message.is_club_wide and hasattr(user, 'club_memberships') and user.club_memberships.filter(club=message.club).exists()
        
        if not (is_recipient or is_club_member):
            return Response({"error": "Not authorized to mark this message as read"}, status=status.HTTP_403_FORBIDDEN)
            
        # Mark as read
        message.is_read = True
        message.save()
        
        return Response({"status": "success", "message": "Message marked as read"})
    except Message.DoesNotExist:
        return Response({"error": f"Message with ID {message_id} not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ClubMemberViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        current_club_id = self.request.session.get('current_club_id')
        club_id = self.kwargs.get('club_id', current_club_id)
        
        if not club_id:
            return User.objects.none()
            
        # Clean club_id to ensure it's an integer
        try:
            club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
        except (ValueError, TypeError):
            # Return empty queryset for invalid club ID
            return User.objects.none()
        
        # Get all users who are members of the specified club
        return User.objects.filter(
            club_memberships__club_id=club_id
        ).distinct().order_by('username')
        
    @action(detail=False, url_path=r'(?P<club_id>\d+)', methods=['get'])
    def club_members(self, request, club_id=None):
        if club_id:
            # Clean club_id to ensure it's an integer
            try:
                club_id = int(club_id.rstrip('/') if isinstance(club_id, str) else club_id)
            except (ValueError, TypeError):
                return Response({"error": "Invalid club ID format"}, status=status.HTTP_400_BAD_REQUEST)
                
        queryset = User.objects.filter(
            club_memberships__club_id=club_id
        ).distinct().order_by('username')
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)