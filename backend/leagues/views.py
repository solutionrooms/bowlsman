from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q

from .models import League, LeagueMember
from .serializers import LeagueSerializer, LeagueDetailSerializer, LeagueMemberSerializer
from users.models import Club, ClubUser
from messaging.models import Message

class IsClubAdminOrLeagueCaptainOrDeputy(permissions.BasePermission):
    """
    Permission to allow only club admins or league captains/deputies to perform actions.
    """
    def has_object_permission(self, request, view, obj):
        # Get the user
        user = request.user
        
        # If it's a League object
        if isinstance(obj, League):
            # Check if user is club admin
            is_club_admin = ClubUser.objects.filter(
                user=user, club=obj.club, is_admin=True
            ).exists()
            
            # Check if user is captain or deputy
            is_captain_or_deputy = (obj.captain == user or obj.deputy == user)
            
            return is_club_admin or is_captain_or_deputy
        
        # If it's a LeagueMember object
        elif isinstance(obj, LeagueMember):
            league = obj.league
            
            # Check if user is club admin
            is_club_admin = ClubUser.objects.filter(
                user=user, club=league.club, is_admin=True
            ).exists()
            
            # Check if user is captain or deputy
            is_captain_or_deputy = (league.captain == user or league.deputy == user)
            
            return is_club_admin or is_captain_or_deputy
        
        return False

class LeagueViewSet(viewsets.ModelViewSet):
    """
    API endpoint for leagues.
    """
    serializer_class = LeagueSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Filter leagues by club if club_id is provided
        club_id = self.request.query_params.get('club_id')
        queryset = League.objects.all()
        
        if club_id:
            queryset = queryset.filter(club_id=club_id)
        
        # If user is not staff, only show leagues from clubs they belong to
        if not user.is_staff:
            user_clubs = ClubUser.objects.filter(user=user).values_list('club_id', flat=True)
            queryset = queryset.filter(club_id__in=user_clubs)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return LeagueDetailSerializer
        return LeagueSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Only club admins can create/update/delete leagues
            return [permissions.IsAuthenticated(), IsClubAdminOrLeagueCaptainOrDeputy()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        # Ensure user has admin rights for the club
        club_id = serializer.validated_data.get('club_id')
        user = self.request.user
        
        # Check if user is admin of the club
        is_admin = ClubUser.objects.filter(
            user=user, club_id=club_id, is_admin=True
        ).exists()
        
        if not is_admin and not user.is_staff:
            raise permissions.PermissionDenied("You must be a club admin to create a league.")
        
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def update_deputy(self, request, pk=None):
        league = self.get_object()
        user = request.user
        
        # Only captain can update deputy
        if league.captain != user:
            return Response(
                {"detail": "Only the league captain can update the deputy."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        deputy_id = request.data.get('deputy_id')
        
        # Validate deputy is a member of the club
        if deputy_id:
            is_club_member = ClubUser.objects.filter(
                user_id=deputy_id, club=league.club
            ).exists()
            
            if not is_club_member:
                return Response(
                    {"detail": "Deputy must be a member of the club."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Update deputy
        league.deputy_id = deputy_id
        league.save()
        
        serializer = self.get_serializer(league)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def message_members(self, request, pk=None):
        league = self.get_object()
        user = request.user
        
        # Check if user is captain or deputy
        if league.captain != user and league.deputy != user:
            return Response(
                {"detail": "Only the league captain or deputy can message members."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get message content
        content = request.data.get('content')
        if not content:
            return Response(
                {"detail": "Message content is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all league members
        members = LeagueMember.objects.filter(league=league).select_related('user')
        
        # Send message to all members
        messages_sent = 0
        for member in members:
            if member.user != user:  # Don't send message to self
                Message.objects.create(
                    sender=user,
                    recipient=member.user,
                    content=content,
                    club=league.club
                )
                messages_sent += 1
        
        return Response({
            "detail": f"Message sent to {messages_sent} league members.",
            "messages_sent": messages_sent
        })

class LeagueMemberViewSet(viewsets.ModelViewSet):
    """
    API endpoint for league members.
    """
    serializer_class = LeagueMemberSerializer
    
    def get_queryset(self):
        # Filter by league if league_id is provided
        league_id = self.request.query_params.get('league_id')
        queryset = LeagueMember.objects.all()
        
        if league_id:
            queryset = queryset.filter(league_id=league_id)
        
        # If user is not staff, only show members from leagues in clubs they belong to
        user = self.request.user
        if not user.is_staff:
            user_clubs = ClubUser.objects.filter(user=user).values_list('club_id', flat=True)
            queryset = queryset.filter(league__club_id__in=user_clubs)
        
        return queryset
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Only club admins or league captains/deputies can manage members
            return [permissions.IsAuthenticated(), IsClubAdminOrLeagueCaptainOrDeputy()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        league_id = serializer.validated_data.get('league').id
        user_id = serializer.validated_data.get('user_id')
        
        # Get the league
        league = get_object_or_404(League, id=league_id)
        
        # Check permissions
        request_user = self.request.user
        
        # Check if user is club admin
        is_club_admin = ClubUser.objects.filter(
            user=request_user, club=league.club, is_admin=True
        ).exists()
        
        # Check if user is captain or deputy
        is_captain_or_deputy = (league.captain == request_user or league.deputy == request_user)
        
        if not (is_club_admin or is_captain_or_deputy):
            raise permissions.PermissionDenied(
                "Only club admins or league captains/deputies can add members."
            )
        
        # Check if the user to be added is a member of the club
        is_club_member = ClubUser.objects.filter(
            user_id=user_id, club=league.club
        ).exists()
        
        if not is_club_member:
            raise serializers.ValidationError(
                {"user_id": "User must be a member of the club."}
            )
        
        serializer.save() 