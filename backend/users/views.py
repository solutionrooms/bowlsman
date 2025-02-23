from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from .serializers import UserSerializer, CompetitionSerializer, CompetitionUserSerializer
from .models import Competition, CompetitionUser
import logging

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
                # If guest_name not provided, generate one
                if not guest_name:
                    guest_count = CompetitionUser.objects.filter(
                        competition=competition,
                        guest_name__startswith="Guest "
                    ).count()
                    guest_name = f"Guest {guest_count + 1}"
                
                competition_user = CompetitionUser.objects.create(
                    competition=competition,
                    guest_name=guest_name
                )
            
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
        player_id = request.query_params.get('player_id')
        
        try:
            player = CompetitionUser.objects.get(
                id=player_id,
                competition=competition
            )
            player.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except CompetitionUser.DoesNotExist:
            return Response(
                {"error": "Player not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def reorder_players(self, request, pk=None):
        competition = self.get_object()
        player_orders = request.data.get('player_orders', [])
        
        try:
            for order_data in player_orders:
                player_id = order_data.get('id')
                new_order = order_data.get('order')
                
                if player_id is None or new_order is None:
                    continue
                    
                try:
                    player = CompetitionUser.objects.get(
                        id=player_id,
                        competition=competition
                    )
                    player.order = new_order
                    player.save()
                except CompetitionUser.DoesNotExist:
                    continue
            
            # Refresh the competition to get updated player order
            competition = self.get_object()
            serializer = self.get_serializer(competition)
            return Response(serializer.data)
            
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
        return CompetitionUser.objects.filter(competition__creator=self.request.user) 