from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
from .models import SocialBowl, SocialBowlParticipant, NoticeImage
from .serializers import SocialBowlSerializer, SocialBowlParticipantSerializer
from users.models import ClubUser
import json


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
    """
    serializer_class = SocialBowlSerializer
    permission_classes = [permissions.IsAuthenticated, IsClubMemberOrReadOnly]

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

    def create(self, request, *args, **kwargs):
        """Handle creating a notice with multiple images"""
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
        
        # Remove user from participants
        participant.delete()
        
        serializer = SocialBowlSerializer(
            social_bowl, 
            context={'request': request}
        )
        return Response(serializer.data)
