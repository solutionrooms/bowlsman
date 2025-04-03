from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
import datetime
from .models import SocialBowl, SocialBowlParticipant, NoticeImage
from .serializers import SocialBowlSerializer, SocialBowlParticipantSerializer
from users.models import ClubUser
from messaging.models import Chat, ChatMember
from .services import get_weather_forecast
import json
import logging

logger = logging.getLogger(__name__)


class IsClubMemberOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow club members to create notices.
    """
    def has_permission(self, request, view):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Only allow club members to create notices
        if 'club' in request.data:
            club_id = request.data.get('club')
            return ClubUser.objects.filter(user=request.user, club_id=club_id).exists()
        
        return False

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Allow if user is the creator of the notice
        if obj.created_by == request.user:
            return True
            
        # Allow if user is an admin of the club
        club_user = ClubUser.objects.filter(user=request.user, club=obj.club).first()
        if club_user and club_user.is_admin:
            return True
            
        # For other operations, only allow club members to modify
        return ClubUser.objects.filter(user=request.user, club=obj.club).exists()


class SocialBowlViewSet(viewsets.ModelViewSet):
    """
    API endpoint for noticeboard notices.
    
    Includes weather forecast data for social bowling events with future dates.
    """
    serializer_class = SocialBowlSerializer
    permission_classes = [permissions.IsAuthenticated, IsClubMemberOrReadOnly]
    
    def _update_weather_forecast(self, instance):
        """Update weather forecast for social bowling events if needed."""
        # Only update for social bowling events with future dates
        if (instance.notice_type == 'social_bowl' and 
                instance.date and instance.location and 
                instance.date >= timezone.now().date()):
            
            # Check if we need to update (not updated or last update was > 6 hours ago)
            weather_stale = (
                not instance.weather_updated_at or 
                timezone.now() - instance.weather_updated_at > datetime.timedelta(hours=6)
            )
            
            if weather_stale:
                try:
                    # Get weather forecast from service
                    weather = get_weather_forecast(instance.location, instance.date)
                    
                    if weather:
                        instance.weather_forecast = weather
                        instance.weather_updated_at = timezone.now()
                        instance.save(update_fields=['weather_forecast', 'weather_updated_at'])
                        logger.info(f"Updated weather forecast for social bowl {instance.id}")
                    else:
                        logger.warning(f"No weather data available for social bowl {instance.id} at location {instance.location}")
                except Exception as e:
                    logger.exception(f"Error updating weather for social bowl {instance.id}: {str(e)}")
        
        return instance

    def get_queryset(self):
        queryset = SocialBowl.objects.all()
        
        # Filter by club if specified
        club_id = self.request.query_params.get('club', None)
        if club_id:
            queryset = queryset.filter(club_id=club_id)
        
        # Filter by notice type if specified
        notice_type = self.request.query_params.get('notice_type', None)
        if notice_type:
            queryset = queryset.filter(notice_type=notice_type)
        
        # Filter by is_broadcast flag if specified
        is_broadcast = self.request.query_params.get('is_broadcast', None)
        if is_broadcast and is_broadcast.lower() == 'true':
            queryset = queryset.filter(is_broadcast=True)
        
        # Only show future social bowls by default if filtering for social_bowl type
        if notice_type == 'social_bowl':
            show_past = self.request.query_params.get('show_past', False)
            if not show_past:
                today = timezone.now().date()
                queryset = queryset.filter(
                    Q(date__gt=today) | 
                    Q(date=today, time__gte=timezone.now().time())
                )
        
        # Filter by user participation
        my_notices = self.request.query_params.get('my_notices', False)
        if my_notices:
            queryset = queryset.filter(participants__user=self.request.user)
        
        return queryset
        
    def retrieve(self, request, *args, **kwargs):
        """Retrieve a notice with weather forecast for social bowling events."""
        instance = self.get_object()
        
        # Update weather for social bowling events
        instance = self._update_weather_forecast(instance)
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
        
    def list(self, request, *args, **kwargs):
        """List notices with weather forecasts for social bowling events."""
        response = super().list(request, *args, **kwargs)
        
        # Update weather for social bowling events in the response
        # Only do this if we're specifically looking for social bowls to avoid performance issues
        if request.query_params.get('notice_type') == 'social_bowl':
            queryset = self.filter_queryset(self.get_queryset())
            
            # Only process the first page if paginated to avoid performance issues
            if self.paginator and hasattr(self.paginator, 'page'):
                queryset = self.paginator.page.object_list
                
            # Update weather for each social bowl
            for instance in queryset:
                self._update_weather_forecast(instance)
        
        return response

    def create(self, request, *args, **kwargs):
        """Handle creating a notice with multiple images"""
        # Check if this is a broadcast notice
        is_broadcast = request.data.get('is_broadcast') == 'true'
        notice_type = request.data.get('notice_type')
        
        # If it's a broadcast notice or request, check permissions
        if is_broadcast or notice_type == 'broadcast':
            club_id = request.data.get('club')
            user = request.user
            
            # Get the user's club membership
            club_user = ClubUser.objects.filter(user=user, club_id=club_id).first()
            
            # Check if user is a system admin, club admin, or has an official role
            is_authorized = (
                user.is_staff or 
                (club_user and club_user.is_admin) or
                (club_user and club_user.club_role in ['President', 'Vice-President', 'Secretary', 'Treasurer'])
            )
            
            if not is_authorized:
                return Response(
                    {"detail": "You do not have permission to create broadcast notices."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        has_multiple_images = False
        additional_images = []
        
        # Check if multiple images are being uploaded
        for key in request.data.keys():
            if key.startswith('image_') and key != 'image':
                has_multiple_images = True
                additional_images.append((key, request.data[key]))
        
        if has_multiple_images:
            # Create a mutable copy of the request data
            mutable_data = request.data.copy()
            
            # Create the notice first without additional images
            serializer = self.get_serializer(data=mutable_data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            
            # Add additional images
            notice = serializer.instance
            for i, (_, image) in enumerate(additional_images):
                NoticeImage.objects.create(
                    notice=notice,
                    image=image,
                    order=i+1
                )
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        else:
            # Standard create behavior
            return super().create(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """Handle updating a notice with multiple images"""
        # Check if this is a broadcast notice update
        is_broadcast = request.data.get('is_broadcast') == 'true'
        notice_type = request.data.get('notice_type')
        
        # If it's being changed to a broadcast notice, check permissions
        if is_broadcast or notice_type == 'broadcast':
            instance = self.get_object()
            club_id = instance.club.id
            user = request.user
            
            # Get the user's club membership
            club_user = ClubUser.objects.filter(user=user, club_id=club_id).first()
            
            # Check if user is a system admin, club admin, or has an official role
            is_authorized = (
                user.is_staff or 
                (club_user and club_user.is_admin) or
                (club_user and club_user.club_role in ['President', 'Vice-President', 'Secretary', 'Treasurer'])
            )
            
            if not is_authorized:
                return Response(
                    {"detail": "You do not have permission to create broadcast notices."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        has_multiple_images = False
        additional_images = []
        
        # Check if multiple images are being uploaded
        for key in request.data.keys():
            if key.startswith('image_') and key != 'image':
                has_multiple_images = True
                additional_images.append((key, request.data[key]))
        
        # Get the notice instance
        instance = self.get_object()
        
        if 'remove_image' in request.data and request.data['remove_image'] == 'true':
            instance.image = None
        
        if 'remove_pdf' in request.data and request.data['remove_pdf'] == 'true':
            instance.pdf_file = None
        
        if has_multiple_images:
            # Create a mutable copy of the request data
            mutable_data = request.data.copy()
            
            # Update the notice first without additional images
            serializer = self.get_serializer(instance, data=mutable_data, partial=kwargs.get('partial', False))
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            
            # If has_multiple_images flag is set to true, clear existing additional images
            if 'has_multiple_images' in request.data and request.data['has_multiple_images'] == 'true':
                # Remove existing additional images if we're uploading new ones
                instance.additional_images.all().delete()
                
                # Add new additional images
                for i, (_, image) in enumerate(additional_images):
                    NoticeImage.objects.create(
                        notice=instance,
                        image=image,
                        order=i+1
                    )
            
            return Response(serializer.data)
        else:
            # Standard update behavior
            return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def join(self, request, pk=None):
        """Join a social bowling session."""
        social_bowl = self.get_object()
        
        # Only allow joining social bowl notices
        if social_bowl.notice_type != 'social_bowl':
            return Response(
                {"detail": "You can only join social bowling notices."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user is a member of the club
        is_member = ClubUser.objects.filter(
            user=request.user,
            club=social_bowl.club
        ).exists()
        
        if not is_member:
            return Response(
                {"detail": "You must be a member of this club to join social events."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if user is already a participant
        if SocialBowlParticipant.objects.filter(
            social_bowl=social_bowl, 
            user=request.user
        ).exists():
            return Response(
                {"detail": "You are already registered for this social bowl."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add user as participant
        participant = SocialBowlParticipant.objects.create(
            social_bowl=social_bowl,
            user=request.user
        )
        
        # Add user to any associated group chats for this social bowl
        associated_chats = Chat.objects.filter(
            notice=social_bowl,
            chat_type='group'
        )
        
        for chat in associated_chats:
            # Check if user is already in the chat
            if not ChatMember.objects.filter(chat=chat, user=request.user).exists():
                ChatMember.objects.create(
                    chat=chat,
                    user=request.user,
                    is_admin=False
                )
        
        serializer = SocialBowlSerializer(
            social_bowl, 
            context={'request': request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def leave(self, request, pk=None):
        """Leave a social bowling session."""
        social_bowl = self.get_object()
        
        # Only allow leaving social bowl notices
        if social_bowl.notice_type != 'social_bowl':
            return Response(
                {"detail": "You can only leave social bowling notices."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user is a participant
        participant = SocialBowlParticipant.objects.filter(
            social_bowl=social_bowl, 
            user=request.user
        ).first()
        
        if not participant:
            return Response(
                {"detail": "You are not registered for this social bowl."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Remove user from participation
        participant.delete()
        
        # Remove user from any associated group chats for this social bowl
        associated_chats = Chat.objects.filter(
            notice=social_bowl,
            chat_type='group'
        )
        
        for chat in associated_chats:
            # Only remove if user is not the creator of the chat
            if chat.created_by != request.user:
                ChatMember.objects.filter(chat=chat, user=request.user).delete()
        
        serializer = SocialBowlSerializer(
            social_bowl, 
            context={'request': request}
        )
        return Response(serializer.data)
