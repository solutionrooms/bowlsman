from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
from .models import SocialBowl, SocialBowlParticipant
from .serializers import SocialBowlSerializer, SocialBowlParticipantSerializer
from users.models import ClubUser


class IsClubMemberOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow club members to create social bowls.
    """
    def has_permission(self, request, view):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Only allow club members to create social bowls
        if 'club' in request.data:
            club_id = request.data.get('club')
            return ClubUser.objects.filter(user=request.user, club_id=club_id).exists()
        
        return False

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Only allow club members to modify
        return ClubUser.objects.filter(user=request.user, club=obj.club).exists()


class SocialBowlViewSet(viewsets.ModelViewSet):
    """
    API endpoint for social bowling sessions.
    """
    serializer_class = SocialBowlSerializer
    permission_classes = [permissions.IsAuthenticated, IsClubMemberOrReadOnly]

    def get_queryset(self):
        queryset = SocialBowl.objects.all()
        
        # Filter by club if specified
        club_id = self.request.query_params.get('club', None)
        if club_id:
            queryset = queryset.filter(club_id=club_id)
        
        # Only show future social bowls by default
        show_past = self.request.query_params.get('show_past', False)
        if not show_past:
            today = timezone.now().date()
            queryset = queryset.filter(
                Q(date__gt=today) | 
                Q(date=today, time__gte=timezone.now().time())
            )
        
        # Filter by user participation
        my_bowls = self.request.query_params.get('my_bowls', False)
        if my_bowls:
            queryset = queryset.filter(participants__user=self.request.user)
        
        return queryset

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def join(self, request, pk=None):
        """Join a social bowling session."""
        social_bowl = self.get_object()
        
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
