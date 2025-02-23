from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from .serializers import UserSerializer, CompetitionSerializer, CompetitionUserSerializer, CompetitionScheduleSerializer
from .models import Competition, CompetitionUser, CompetitionSchedule
import logging
import random

logger = logging.getLogger(__name__)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]
    authentication_classes = [TokenAuthentication]

    def get_permissions(self):
        logger.info(f'Checking permissions for action: {self.action}')
        if self.action in ['create', 'login', 'me']:
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        return User.objects.all().order_by('-is_active', 'username')

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
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        logger.info(f'User {request.user.username} accessed their profile')
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    def perform_create(self, serializer):
        logger.info(f'Creating new user with data: {serializer.validated_data}')
        user = serializer.save()
        user.set_password(serializer.validated_data['password'])
        user.save()
        logger.info(f'User created successfully: {user.username}')

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def login(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        logger.info(f'Login attempt for user: {username}')
        
        user = authenticate(username=username, password=password)
        logger.info(f'Authentication result for {username}: {"success" if user else "failed"}')
        
        if user:
            token, _ = Token.objects.get_or_create(user=user)
            logger.info(f'Token generated for user {username}')
            return Response({
                'token': token.key,
                'user_id': user.id,
                'is_staff': user.is_staff
            })
        logger.warning(f'Login failed for user: {username}')
        return Response(
            {'error': 'Invalid credentials'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )

class CompetitionViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitionSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Competition.objects.filter(creator=self.request.user)

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

    @action(detail=True, methods=['post'])
    def add_player(self, request, pk=None):
        competition = self.get_object()
        
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
        """Get the schedule for a competition"""
        competition = self.get_object()
        schedules = CompetitionSchedule.objects.filter(competition=competition).order_by('round')
        serializer = CompetitionScheduleSerializer(schedules, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['delete'])
    def delete_schedule(self, request, pk=None):
        """Delete the entire schedule for a competition"""
        competition = self.get_object()
        CompetitionSchedule.objects.filter(competition=competition).delete()
        competition.update_status()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def create_schedule(self, request, pk=None):
        """Create a schedule for a competition"""
        competition = self.get_object()
        
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
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CompetitionUserViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitionUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CompetitionUser.objects.filter(competition__creator=self.request.user)

def create_dummy_schedule(competition, players):
    """
    Creates a basic schedule where each player gets to play at least one game.
    This is a temporary implementation that will be replaced with proper scheduling logic.
    """
    # Delete any existing schedule for this competition
    CompetitionSchedule.objects.filter(competition=competition).delete()
    
    # Shuffle players to randomize teams
    shuffled_players = list(players)
    random.shuffle(shuffled_players)
    
    # Create rounds until each player has played at least once
    round_num = 1
    remaining_players = set(players)
    
    while remaining_players:
        # Take 8 players for this round (or all remaining if less than 8)
        round_players = shuffled_players[:8]
        if len(round_players) < 8:
            # If we don't have enough players, reuse some from the start
            round_players.extend(shuffled_players[:(8 - len(round_players))])
        
        # Create the schedule for this round
        CompetitionSchedule.objects.create(
            competition=competition,
            round=round_num,
            side_1_player_1=round_players[0],
            side_1_player_2=round_players[1],
            side_1_player_3=round_players[2],
            side_1_player_4=round_players[3],
            side_2_player_1=round_players[4],
            side_2_player_2=round_players[5],
            side_2_player_3=round_players[6],
            side_2_player_4=round_players[7]
        )
        
        # Remove these players from remaining_players
        remaining_players -= set(round_players[:8])
        
        # Rotate the players list for next round
        shuffled_players = shuffled_players[8:] + shuffled_players[:8]
        round_num += 1

    # Update competition status
    competition.status = 'scheduled'
    competition.save()

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
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        ) 