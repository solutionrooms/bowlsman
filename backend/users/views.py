from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from django.utils import timezone
from .serializers import (
    UserSerializer, CompetitionSerializer, CompetitionUserSerializer, 
    CompetitionScheduleSerializer, ClubSerializer, ClubUserSerializer,
    GameScoreSerializer
)
from .models import Competition, CompetitionUser, CompetitionSchedule, Club, ClubUser, GameScore
import logging
import random
from .scheduling import create_round_robin_schedule
from django.db import models, transaction

logger = logging.getLogger(__name__)

class ClubViewSet(viewsets.ModelViewSet):
    serializer_class = ClubSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only superusers can see all clubs
        if self.request.user.is_superuser:
            return Club.objects.all()
        # Regular users can only see clubs they are members of
        return Club.objects.filter(members__user=self.request.user)

    def perform_create(self, serializer):
        club = serializer.save()
        # Add the user who created the club as an admin
        ClubUser.objects.create(user=self.request.user, club=club, is_admin=True)
        
    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """Get all members of a club"""
        club = self.get_object()
        
        # Check if user is a member of this club
        if not ClubUser.objects.filter(user=request.user, club=club).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'You must be a member of this club to view members'}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        club_users = ClubUser.objects.filter(club=club)
        users = [cu.user for cu in club_users]
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_user(self, request, pk=None):
        club = self.get_object()
        
        # Check if the user is an admin of this club
        if not ClubUser.objects.filter(user=request.user, club=club, is_admin=True).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'Only club admins can add users'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_id = request.data.get('user_id')
        username = request.data.get('username')
        is_admin = request.data.get('is_admin', False)
        
        if not user_id and not username:
            return Response(
                {'error': 'User ID or username must be provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            if user_id:
                user = User.objects.get(id=user_id)
            else:
                user = User.objects.get(username=username)
                
            # Check if user is already a member
            if ClubUser.objects.filter(user=user, club=club).exists():
                return Response(
                    {'error': 'User is already a member of this club'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            club_user = ClubUser.objects.create(
                user=user, 
                club=club,
                is_admin=is_admin
            )
            
            return Response(
                ClubUserSerializer(club_user).data, 
                status=status.HTTP_201_CREATED
            )
            
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def remove_user(self, request, pk=None):
        club = self.get_object()
        
        # Check if the user is an admin of this club
        if not ClubUser.objects.filter(user=request.user, club=club, is_admin=True).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'Only club admins can remove users'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'User ID must be provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            club_user = ClubUser.objects.get(user_id=user_id, club=club)
            
            # Prevent removing the last admin
            if club_user.is_admin and ClubUser.objects.filter(club=club, is_admin=True).count() <= 1:
                return Response(
                    {'error': 'Cannot remove the last admin of the club'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            club_user.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except ClubUser.DoesNotExist:
            return Response(
                {'error': 'User is not a member of this club'}, 
                status=status.HTTP_404_NOT_FOUND
            )

class ClubUserViewSet(viewsets.ModelViewSet):
    serializer_class = ClubUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return ClubUser.objects.all()
        
        # Users can only see their own memberships or memberships in clubs they administer
        admin_clubs = ClubUser.objects.filter(user=self.request.user, is_admin=True).values_list('club_id', flat=True)
        return ClubUser.objects.filter(
            models.Q(user=self.request.user) | models.Q(club_id__in=admin_clubs)
        )

    @action(detail=False, methods=['post', 'put'])
    def set_current_club(self, request):
        club_id = request.data.get('club_id')
        if not club_id:
            return Response(
                {'error': 'Club ID must be provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # For staff users, allow switching to any club
        if request.user.is_staff:
            try:
                club = Club.objects.get(id=club_id)
                
                # Check if user is already a member of this club
                club_user, created = ClubUser.objects.get_or_create(
                    user=request.user,
                    club=club,
                    defaults={'is_admin': False}
                )
                
                # Update last login time
                club_user.last_login_at = timezone.now()
                club_user.save()
                
                # Save club ID in session
                request.session['current_club_id'] = club.id
                
                return Response({
                    'message': 'Current club updated',
                    'club': ClubSerializer(club).data
                })
                
            except Club.DoesNotExist:
                return Response(
                    {'error': 'Club not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Regular users can only switch to clubs they are members of
            try:
                club_user = ClubUser.objects.get(user=request.user, club_id=club_id)
                club_user.last_login_at = timezone.now()
                club_user.save()
                
                # Save club ID in session
                request.session['current_club_id'] = club_user.club.id
                
                return Response({
                    'message': 'Current club updated',
                    'club': ClubSerializer(club_user.club).data
                })
                
            except ClubUser.DoesNotExist:
                return Response(
                    {'error': 'You are not a member of this club'}, 
                    status=status.HTTP_404_NOT_FOUND
                )

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]
    authentication_classes = [TokenAuthentication]

    def get_permissions(self):
        logger.info(f'Checking permissions for action: {self.action}')
        if self.action in ['create', 'login', 'me', 'register']:
            return [permissions.AllowAny()]
        elif self.action in ['list', 'clubs']:
            # Allow authenticated users to list users and access their clubs
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        logger.info(f'Getting users queryset. User: {self.request.user}, Action: {self.action}')
        queryset = User.objects.all().order_by('-is_active', 'username')
        
        # Filter by club_id if specified in query params
        club_id = self.request.query_params.get('club_id')
        show_non_members = self.request.query_params.get('show_non_members') == 'true'
        
        if club_id and club_id.isdigit():
            club_id = int(club_id)
            logger.info(f'Filtering users by club_id: {club_id}')
            
            # Get users who are members of the specified club
            club_member_ids = ClubUser.objects.filter(club_id=club_id).values_list('user_id', flat=True)
            logger.info(f'Found club members: {list(club_member_ids)}')
            
            # Check if user is club admin
            is_club_admin = ClubUser.objects.filter(user=self.request.user, club_id=club_id, is_admin=True).exists()
            
            # For staff users or club admins showing non-members
            if (self.request.user.is_staff or is_club_admin) and show_non_members:
                logger.info('Staff/admin user showing non-members of club for management')
                queryset = queryset.exclude(id__in=club_member_ids)
            else:
                # Otherwise just show members (default behavior)
                logger.info('Showing club members only')
                queryset = queryset.filter(id__in=club_member_ids)
        
        logger.info(f'Final queryset count: {queryset.count()}')
        return queryset

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('password')
        if not new_password:
            return Response(
                {'error': 'Password is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(new_password)
        user.save()
        return Response({'status': 'password reset'})

    @action(detail=False, methods=['get'])
    def me(self, request):
        if request.user.is_authenticated:
            serializer = UserSerializer(request.user)
            
            # Get the user's current or last club
            current_club = None
            club_users = ClubUser.objects.filter(user=request.user).order_by('-last_login_at')
            
            if club_users.exists():
                current_club = ClubSerializer(club_users.first().club).data
                
                # Set current club in session if not already set
                if 'current_club_id' not in request.session:
                    request.session['current_club_id'] = club_users.first().club.id
                
            # Get all clubs the user is a member of
            clubs = [ClubSerializer(cu.club).data for cu in club_users]
                
            return Response({
                'user': serializer.data,
                'current_club': current_club,
                'clubs': clubs
            })
        return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        
    @action(detail=False, methods=['get'])
    def clubs(self, request):
        """Get all clubs that the user is a member of"""
        if request.user.is_authenticated:
            club_users = ClubUser.objects.filter(user=request.user).order_by('-last_login_at')
            clubs = [cu.club for cu in club_users]
            serializer = ClubSerializer(clubs, many=True)
            return Response(serializer.data)
        return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def login(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        club_id = request.data.get('club_id')
        
        if not username or not password:
            return Response(
                {'error': 'Username and password are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = authenticate(username=username, password=password)
        
        if not user:
            return Response(
                {'error': 'Invalid credentials'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not user.is_active:
            return Response(
                {'error': 'User account is disabled'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get or create token
        token, created = Token.objects.get_or_create(user=user)
        
        # User's clubs
        club_users = ClubUser.objects.filter(user=user)
        
        if not club_users.exists():
            # No clubs for this user
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data,
                'clubs': [],
                'error': 'User is not a member of any club'
            }, status=status.HTTP_200_OK)
        
        # If club_id is provided, set it as current
        current_club = None
        if club_id:
            try:
                club_user = club_users.get(club_id=club_id)
                club_user.last_login_at = timezone.now()
                club_user.save()
                current_club = ClubSerializer(club_user.club).data
            except ClubUser.DoesNotExist:
                # Club ID provided but user is not a member
                return Response({
                    'token': token.key,
                    'user': UserSerializer(user).data,
                    'clubs': [ClubSerializer(cu.club).data for cu in club_users],
                    'error': 'You are not a member of the selected club'
                }, status=status.HTTP_200_OK)
        else:
            # No club_id provided, use the most recent one
            most_recent = club_users.order_by('-last_login_at').first()
            if most_recent:
                most_recent.last_login_at = timezone.now()
                most_recent.save()
                current_club = ClubSerializer(most_recent.club).data
        
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
            'clubs': [ClubSerializer(cu.club).data for cu in club_users],
            'current_club': current_club
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def register(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email')
        
        if not username or not password or not email:
            return Response(
                {'error': 'Username, password and email are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if username already exists
        if User.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check if email already exists
        if User.objects.filter(email=email).exists():
            return Response(
                {'error': 'Email already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )
        
        # Create token
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
            'message': 'Registration successful'
        }, status=status.HTTP_201_CREATED)

class CompetitionViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def retrieve(self, request, *args, **kwargs):
        logger.info(f"CompetitionViewSet.retrieve called - User: {request.user}, PK: {kwargs.get('pk')}")
        try:
            # First check if the competition exists
            competition_id = self.kwargs.get('pk')
            try:
                competition = Competition.objects.get(id=competition_id)
            except Competition.DoesNotExist:
                logger.warning(f"Competition {competition_id} not found")
                return Response(
                    {"error": "Competition not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
                
            # Now check if the user has access
            is_member = ClubUser.objects.filter(user=request.user, club=competition.club).exists()
            if not is_member and not request.user.is_superuser:
                logger.warning(f"User {request.user.username} denied access to competition {competition_id}")
                return Response(
                    {"error": "You do not have access to this competition"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # If we get here, proceed with the normal flow
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error in CompetitionViewSet.retrieve: {str(e)}", exc_info=True)
            return Response(
                {"error": f"Failed to retrieve competition: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def get_queryset(self):
        logger.info(f"CompetitionViewSet.get_queryset - User: {self.request.user}, Action: {self.action}")
        logger.info(f"Query params: {self.request.query_params}")
        
        # Get the user's current club (most recently accessed)
        current_club = ClubUser.objects.filter(
            user=self.request.user
        ).order_by('-last_login_at').first()
        
        # For actions that need to handle a specific competition (retrieve, schedule, etc.)
        if self.action in ['retrieve', 'schedule'] and self.kwargs.get('pk'):
            logger.info(f"Handling retrieve or schedule for competition ID: {self.kwargs.get('pk')}")
            try:
                competition_id = int(self.kwargs['pk'])
                logger.info(f"Looking up competition with ID: {competition_id}")
                competition = Competition.objects.get(id=competition_id)
                logger.info(f"Found competition: {competition.id} - {competition.name}, Club: {competition.club.id}")
                
                # Check if user is a member of the club that owns this competition
                is_member = ClubUser.objects.filter(user=self.request.user, club=competition.club).exists()
                logger.info(f"User membership check: is_member={is_member}, is_superuser={self.request.user.is_superuser}")
                
                if is_member or self.request.user.is_superuser:
                    logger.info(f"User has access, returning competition")
                    return Competition.objects.filter(id=competition_id)
                else:
                    # User is not a member of this club
                    logger.info(f"User is not a member of the club, denying access")
                    return Competition.objects.none()
                    
            except Competition.DoesNotExist:
                logger.warning(f"Competition {self.kwargs.get('pk')} does not exist")
                return Competition.objects.none()
            except ValueError as e:
                logger.warning(f"Value error when processing competition ID: {str(e)}")
                return Competition.objects.none()
            except Exception as e:
                logger.error(f"Unexpected error in get_queryset: {str(e)}", exc_info=True)
                return Competition.objects.none()
        
        # For list action, show competitions from user's clubs
        # If a current club exists, filter competitions by that club
        if current_club:
            logger.info(f"Using current club: {current_club.club.id} - {current_club.club.name}")
            queryset = Competition.objects.filter(club=current_club.club)
        else:
            # Fallback: show competitions from all clubs the user is a member of
            logger.info("No current club, getting competitions from all user's clubs")
            user_clubs = ClubUser.objects.filter(user=self.request.user).values_list('club_id', flat=True)
            logger.info(f"User clubs: {list(user_clubs)}")
            queryset = Competition.objects.filter(club_id__in=user_clubs)
        
        # Filter by club_id if specified in query params (overrides current club)
        club_id = self.request.query_params.get('club_id')
        if club_id and club_id.isdigit():
            logger.info(f"Filtering by provided club_id: {club_id}")
            queryset = queryset.filter(club=int(club_id))
            
            # Check if user is a member of the specified club
            is_member = ClubUser.objects.filter(user=self.request.user, club_id=int(club_id)).exists()
            logger.info(f"User membership in specified club: {is_member}")
            
            if not is_member and not self.request.user.is_superuser:
                logger.warning(f"User is not a member of club {club_id}, returning empty queryset")
                return Competition.objects.none()
            
        # Log ALL competitions in the club before filtering by status
        club_id = self.request.query_params.get('club_id')
        if club_id and club_id.isdigit():
            all_club_competitions = Competition.objects.filter(club=int(club_id))
            logger.info(f"All competitions in club {club_id} (before status filtering): {[(c.id, c.name, c.status) for c in all_club_competitions]}")
        
        # Filter by status if specified
        status = self.request.query_params.get('status')
        if status:
            logger.info(f"Filtering by status: {status}")
            # Check for any issues with status values
            competitions_with_status = Competition.objects.filter(status=status)
            logger.info(f"Total competitions with status '{status}' across all clubs: {competitions_with_status.count()}")
            
            # Debug: Check for case sensitivity or whitespace issues
            all_statuses = Competition.objects.values_list('status', flat=True).distinct()
            logger.info(f"All unique status values in database: {list(all_statuses)}")
            
            # Apply the filter
            queryset = queryset.filter(status=status)
        
        logger.info(f"Final queryset count: {queryset.count()}")
        if queryset.count() > 0:
            logger.info(f"Competitions found: {[(c.id, c.name, c.status) for c in queryset]}")
        else:
            logger.info("No competitions found matching criteria")
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

    @action(detail=True, methods=['post'])
    def add_player(self, request, pk=None):
        competition = self.get_object()
        
        # Check if user belongs to the club
        if not ClubUser.objects.filter(user=request.user, club=competition.club).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'You must be a member of the club to add players'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if competition.status == 'scheduled':
            return Response(
                {"error": "Cannot add players to a scheduled competition"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if competition.is_full:
            return Response(
                {"error": "Competition is full"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        user_id = request.data.get('user_id')
        guest_name = request.data.get('guest_name')

        if not user_id and not guest_name:
            return Response(
                {"error": "Either user_id or guest_name must be provided"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if user_id:
                user = User.objects.get(id=user_id)
                competition_user = CompetitionUser.objects.create(
                    competition=competition,
                    user=user
                )
            else:
                competition_user = CompetitionUser.objects.create(
                    competition=competition,
                    guest_name=guest_name
                )
            
            # Update competition status
            competition.update_status()
            
            serializer = CompetitionUserSerializer(competition_user)
            return Response(serializer.data)
        
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['delete'])
    def remove_player(self, request, pk=None):
        competition = self.get_object()
        
        # Check if user belongs to the club
        if not ClubUser.objects.filter(user=request.user, club=competition.club).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'You must be a member of the club to remove players'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if competition.status == 'scheduled':
            return Response(
                {"error": "Cannot remove players from a scheduled competition"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        player_id = request.query_params.get('player_id')
        
        try:
            player = CompetitionUser.objects.get(
                id=player_id,
                competition=competition
            )
            player.delete()
            
            # Update competition status
            competition.update_status()
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except CompetitionUser.DoesNotExist:
            return Response(
                {"error": "Player not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        competition = self.get_object()
        
        # Check if user belongs to the club
        if not ClubUser.objects.filter(user=request.user, club=competition.club).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'You must be a member of the club to view schedule'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        schedules = CompetitionSchedule.objects.filter(competition=competition).order_by('round')
        serializer = CompetitionScheduleSerializer(schedules, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['delete'])
    def delete_schedule(self, request, pk=None):
        competition = self.get_object()
        
        # Check if user belongs to the club
        if not ClubUser.objects.filter(user=request.user, club=competition.club).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'You must be a member of the club to delete schedule'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        CompetitionSchedule.objects.filter(competition=competition).delete()
        competition.update_status()
        
        # Return success response
        return Response({'message': 'Schedule successfully deleted'}, status=status.HTTP_200_OK)
        
    @action(detail=True, methods=['post'])
    def start_competition(self, request, pk=None):
        competition = self.get_object()
        
        # Check if user belongs to the club
        if not ClubUser.objects.filter(user=request.user, club=competition.club).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'You must be a member of the club to start a competition'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if competition is scheduled
        if competition.status != 'scheduled':
            return Response(
                {'error': 'Only scheduled competitions can be started'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                # Create initial score records for all schedule entries
                schedules = CompetitionSchedule.objects.filter(competition=competition)
                
                # Check if any scores already exist
                existing_scores = GameScore.objects.filter(schedule__competition=competition).exists()
                if not existing_scores:
                    for schedule in schedules:
                        GameScore.objects.create(schedule=schedule)
                
                # Update competition status
                competition.status = 'in_progress'
                competition.save()
                
                return Response({
                    'message': 'Competition started successfully',
                    'status': competition.status
                })
                
        except Exception as e:
            logger.error(f"Error starting competition: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def create_schedule(self, request, pk=None):
        competition = self.get_object()
        
        # Check if user belongs to the club
        if not ClubUser.objects.filter(user=request.user, club=competition.club).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'You must be a member of the club to create schedule'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if competition is full
        if not competition.is_full:
            return Response(
                {'error': 'Cannot create schedule for competition that is not full'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all players in order
        players = list(competition.competition_users.all().order_by('order'))
        
        try:
            # Create schedule based on rule type
            create_dummy_schedule(competition, players)
            
            # Return the created schedule
            schedules = CompetitionSchedule.objects.filter(competition=competition)
            serializer = CompetitionScheduleSerializer(schedules, many=True)
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error creating schedule: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def replace_player(self, request, pk=None):
        competition = self.get_object()
        
        # Check if user belongs to the club
        if not ClubUser.objects.filter(user=request.user, club=competition.club).exists() and not request.user.is_superuser:
            return Response(
                {'error': 'You must be a member of the club to replace players'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        old_player_id = request.data.get('old_player_id')
        new_user_id = request.data.get('new_user_id')
        new_guest_name = request.data.get('new_guest_name')
        
        if not old_player_id:
            return Response(
                {"error": "old_player_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if not new_user_id and not new_guest_name:
            return Response(
                {"error": "Either new_user_id or new_guest_name must be provided"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            old_player = CompetitionUser.objects.get(
                id=old_player_id,
                competition=competition
            )
            
            # Create new player
            if new_user_id:
                user = User.objects.get(id=new_user_id)
                new_player = CompetitionUser.objects.create(
                    competition=competition,
                    user=user,
                    order=old_player.order
                )
            else:
                new_player = CompetitionUser.objects.create(
                    competition=competition,
                    guest_name=new_guest_name,
                    order=old_player.order
                )
            
            # Update all schedule entries that reference the old player
            for field in ['side_1_player_1', 'side_1_player_2', 'side_1_player_3', 'side_1_player_4',
                         'side_2_player_1', 'side_2_player_2', 'side_2_player_3', 'side_2_player_4']:
                CompetitionSchedule.objects.filter(**{field: old_player}).update(**{field: new_player})
            
            # Delete old player
            old_player.delete()
            
            serializer = CompetitionUserSerializer(new_player)
            return Response(serializer.data)
            
        except CompetitionUser.DoesNotExist:
            return Response(
                {"error": "Player not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

class CompetitionUserViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitionUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users can only see competition users from clubs they are members of
        user_clubs = ClubUser.objects.filter(user=self.request.user).values_list('club_id', flat=True)
        return CompetitionUser.objects.filter(competition__club_id__in=user_clubs)
        
class GameScoreViewSet(viewsets.ModelViewSet):
    serializer_class = GameScoreSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Users can only see game scores from clubs they are members of
        user_clubs = ClubUser.objects.filter(user=self.request.user).values_list('club_id', flat=True)
        queryset = GameScore.objects.filter(schedule__competition__club_id__in=user_clubs)
        
        # Filter by competition if specified
        competition_id = self.request.query_params.get('competition')
        if competition_id and competition_id.isdigit():
            queryset = queryset.filter(schedule__competition_id=int(competition_id))
            
        return queryset
    
    def perform_update(self, serializer):
        game_score = serializer.save()
        
        # Check if all games in the competition have been completed
        competition = game_score.schedule.competition
        all_completed = True
        
        # Check if all games are completed
        for schedule in CompetitionSchedule.objects.filter(competition=competition):
            try:
                score = schedule.scores.first()
                if not score or not score.completed:
                    all_completed = False
                    break
            except GameScore.DoesNotExist:
                all_completed = False
                break
        
        # If all games are completed, mark the competition as completed
        if all_completed and competition.status == 'in_progress':
            competition.status = 'completed'
            competition.save()

def create_dummy_schedule(competition, players, team_size=2):
    """
    Creates a round-robin schedule where teams compete against each other.
    Each player will get to play with and against different players across rounds.
    
    Args:
        competition: Competition object
        players: List of CompetitionUser objects
        team_size: Number of active players per team (1-4), defaults to 2
    """
    # Delete any existing schedule for this competition
    logger.info(f"Deleting existing schedule for competition {competition.id}")
    existing_count = CompetitionSchedule.objects.filter(competition=competition).count()
    logger.info(f"Found {existing_count} existing schedule entries")
    CompetitionSchedule.objects.filter(competition=competition).delete()
    after_count = CompetitionSchedule.objects.filter(competition=competition).count()
    logger.info(f"After deletion: {after_count} schedule entries remain")
    
    # Convert players to format needed by scheduler
    player_dicts = [{'id': player.id} for player in players]
    
    # Create a mapping of player IDs to CompetitionUser objects
    player_map = {player.id: player for player in players}
    
    # Generate schedule
    schedule_entries = create_round_robin_schedule(
        competition.id, 
        player_dicts, 
        team_size=team_size,
        parallel_matches=competition.parallel_matches,
        max_rounds=competition.max_rounds
    )
    
    logger.info(f"Generated {len(schedule_entries)} schedule entries")
    
    # Create CompetitionSchedule objects
    created_entries = []
    for entry in schedule_entries:
        # Replace competition ID with competition object
        entry['competition'] = competition
        # Replace player IDs with CompetitionUser objects
        for field in ['side_1_player_1', 'side_1_player_2', 'side_1_player_3', 'side_1_player_4',
                     'side_2_player_1', 'side_2_player_2', 'side_2_player_3', 'side_2_player_4']:
            if entry[field] is not None:
                entry[field] = player_map[entry[field]]
        created = CompetitionSchedule.objects.create(**entry)
        created_entries.append(created)
        logger.info(f"Created schedule entry for round {entry['round']}.{entry['sub_round']}")

    # Update competition status
    competition.status = 'scheduled'
    competition.save()
    
    logger.info(f"Successfully created {len(created_entries)} schedule entries")

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_schedule(request, competition_id):
    try:
        competition = Competition.objects.get(pk=competition_id)
        
        # Check if competition is full
        if not competition.is_full:
            return Response(
                {'error': 'Cannot create schedule for competition that is not full'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all players in order
        players = list(competition.competition_users.all().order_by('order'))
        
        # Create schedule based on rule type
        create_dummy_schedule(competition, players)
        
        # Return the created schedule
        schedules = CompetitionSchedule.objects.filter(competition=competition)
        serializer = CompetitionScheduleSerializer(schedules, many=True)
        return Response(serializer.data)
        
    except Competition.DoesNotExist:
        return Response(
            {'error': 'Competition not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error creating schedule: {str(e)}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        ) 