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
    GameScoreSerializer, ClubApplicationSerializer, CompetitionTypeSerializer
)
from .models import Competition, CompetitionUser, CompetitionSchedule, Club, ClubUser, GameScore, UserProfile, PasswordResetToken, ClubApplication, CompetitionType
import logging
import random
from .scheduling import create_round_robin_schedule
from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse
from .utils import validate_password

logger = logging.getLogger(__name__)

class ClubViewSet(viewsets.ModelViewSet):
    serializer_class = ClubSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Check if this is a request from the dashboard (looking for all clubs)
        is_dashboard_request = self.request.query_params.get('for_dashboard', False)
        
        # For dashboard requests or superusers, return all clubs
        if is_dashboard_request or self.request.user.is_superuser:
            return Club.objects.all()
            
        # Regular users can only see clubs they are members of for other operations
        return Club.objects.filter(members__user=self.request.user)

    def perform_create(self, serializer):
        # Check if user is staff
        if not self.request.user.is_staff:
            raise ValidationError("Only staff members can create clubs")
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
        club_role = request.data.get('club_role', '')
        
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
                is_admin=is_admin,
                club_role=club_role
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

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """Apply to join a club"""
        try:
            club = Club.objects.get(id=pk)
        except Club.DoesNotExist:
            return Response(
                {'error': 'Club not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        message = request.data.get('message', '')
        
        # Check if user is already a member
        if ClubUser.objects.filter(user=user, club=club).exists():
            return Response(
                {'error': 'You are already a member of this club'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user already has a pending application
        if ClubApplication.objects.filter(user=user, club=club, status='pending').exists():
            return Response(
                {'error': 'You already have a pending application for this club'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create application
        application = ClubApplication.objects.create(
            user=user,
            club=club,
            message=message
        )
        
        # Find club secretary or admin to notify
        secretary = ClubUser.objects.filter(club=club, club_role='Secretary').first()
        if not secretary:
            # If no secretary, find any admin
            secretary = ClubUser.objects.filter(club=club, is_admin=True).first()
        
        if secretary:
            # Send email notification
            secretary_user = secretary.user
            subject = f'New Club Application: {user.username}'
            message = f"""
            Hello {secretary_user.first_name or secretary_user.username},
            
            A new application has been received for {club.name}.
            
            User: {user.username} ({user.first_name} {user.last_name})
            Email: {user.email}
            Message: {message}
            
            Please log in to review this application.
            """
            
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [secretary_user.email],
                    fail_silently=False,
                )
            except Exception as e:
                logger.error(f"Failed to send email notification: {e}")
        
        return Response(
            ClubApplicationSerializer(application).data,
            status=status.HTTP_201_CREATED
        )

class ClubUserViewSet(viewsets.ModelViewSet):
    serializer_class = ClubUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ClubUser.objects.all()
        
        # Filter by club_id or club if provided
        club_id = self.request.query_params.get('club_id')
        club = self.request.query_params.get('club')
        filter_club_id = club_id or club
        
        # Always filter by club if provided, regardless of user permissions
        if filter_club_id:
            queryset = queryset.filter(club_id=filter_club_id)
        
        # If not superuser or staff, restrict to clubs the user is a member of or administers
        if not (self.request.user.is_superuser or self.request.user.is_staff):
            admin_clubs = ClubUser.objects.filter(user=self.request.user, is_admin=True).values_list('club_id', flat=True)
            queryset = queryset.filter(
                models.Q(user=self.request.user) | models.Q(club_id__in=admin_clubs)
            )
            
        return queryset.select_related('user', 'club')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['include_full_user_data'] = True
        return context

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
        
        # Validate password
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return Response(
                {'error': message}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(new_password)
        user.save()
        return Response({'status': 'password reset'})

    @action(detail=False, methods=['get', 'put'])
    def me(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
            
        # Handle PUT request for updating user profile
        if request.method == 'PUT':
            try:
                user = request.user
                
                # Update basic user fields
                if 'first_name' in request.data:
                    user.first_name = request.data.get('first_name')
                if 'last_name' in request.data:
                    user.last_name = request.data.get('last_name')
                if 'email' in request.data:
                    user.email = request.data.get('email')
                
                user.save()
                
                # Get or create user profile
                profile, created = UserProfile.objects.get_or_create(user=user)
                
                # Update profile fields
                if 'phone_number' in request.data:
                    profile.phone_number = request.data.get('phone_number')
                if 'notes' in request.data:
                    profile.notes = request.data.get('notes')
                if 'postcode' in request.data:
                    profile.postcode = request.data.get('postcode')
                
                # Handle profile picture
                if 'profile_picture' in request.FILES:
                    profile.profile_picture = request.FILES.get('profile_picture')
                
                profile.save()
                
                # Return updated user data
                serializer = UserSerializer(user)
                return Response(serializer.data)
                
            except ValidationError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                logger.error(f"Error updating user profile: {str(e)}")
                return Response({'error': 'Failed to update profile'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Handle GET request
        serializer = UserSerializer(request.user)
        
        # Get the user's current or last club
        current_club = None
        club_users = ClubUser.objects.filter(user=request.user).order_by('-last_login_at')
        
        if club_users.exists():
            # Get the first club user (most recently logged in)
            club_user = club_users.first()
            
            # Create current_club with is_admin field included
            current_club = ClubSerializer(club_user.club).data
            current_club['is_admin'] = club_user.is_admin
            
            # Set current club in session if not already set
            if 'current_club_id' not in request.session:
                request.session['current_club_id'] = club_user.club.id
            
        # Get all clubs the user is a member of with is_admin field
        clubs = []
        for cu in club_users:
            club_data = ClubSerializer(cu.club).data
            club_data['is_admin'] = cu.is_admin
            clubs.append(club_data)
            
        return Response({
            'user': serializer.data,
            'current_club': current_club,
            'clubs': clubs
        })

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
        
        # Special case for development testing - allow any user with password "pass"
        if password == 'pass':
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response(
                    {'error': 'Invalid credentials'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
        else:
            # Normal login process
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
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        postcode = request.data.get('postcode', '')
        
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
        
        # Validate password
        is_valid, message = validate_password(password)
        if not is_valid:
            return Response(
                {'error': message}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        # Create or update user profile with postcode
        profile, created = UserProfile.objects.get_or_create(user=user)
        if postcode:
            profile.postcode = postcode
            profile.save()
        
        # Create token
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
            'message': 'Registration successful'
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def update_profile_picture(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)

        profile_picture = request.FILES.get('profile_picture')
        if not profile_picture:
            return Response({'error': 'No profile picture provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get or create user profile
            profile, created = UserProfile.objects.get_or_create(user=request.user)
            
            # Update profile picture
            profile.profile_picture = profile_picture
            profile.save()

            return Response({
                'profile_picture': profile.profile_picture.url,
                'message': 'Profile picture updated successfully'
            })
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def request_password_reset(self, request):
        """
        Request a password reset link to be sent to the user's email.
        """
        email = request.data.get('email')
        if not email:
            return Response(
                {'error': 'Email is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user by email
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Don't reveal that the user doesn't exist for security reasons
            return Response(
                {'message': 'If a user with this email exists, a password reset link has been sent.'},
                status=status.HTTP_200_OK
            )
        
        # Create a password reset token
        token = PasswordResetToken.objects.create(user=user)
        
        # Build the reset URL - use the path parameter format to match the frontend route
        frontend_url = settings.FRONTEND_URL
        reset_url = f"{frontend_url}/reset-password/{token.token}"
        
        # Log the reset URL for debugging
        logger.info(f"Password reset URL: {reset_url}")
        
        # Send email with reset link
        try:
            subject = 'Password Reset for BowlsHub'
            message = f"""
            Hello {user.first_name or user.username},
            
            You have requested to reset your password for your BowlsHub account.
            
            Please click the link below to reset your password:
            {reset_url}
            
            This link will expire in 24 hours.
            
            If you did not request this password reset, please ignore this email.
            
            The BowlsHub Team
            """
            
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            
            return Response({'message': 'Password reset email sent'})
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
            return Response(
                {'error': 'Failed to send password reset email'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def confirm_password_reset(self, request):
        """
        Confirm a password reset using the token from the email.
        """
        token_str = request.data.get('token')
        new_password = request.data.get('password')
        
        if not token_str or not new_password:
            return Response(
                {'error': 'Token and password are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate password
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return Response(
                {'error': message}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Find the token
            token = PasswordResetToken.objects.get(token=token_str)
            
            # Check if token is valid
            if not token.is_valid():
                return Response(
                    {'error': 'Invalid or expired token'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Reset the password
            user = token.user
            user.set_password(new_password)
            user.save()
            
            # Mark token as used
            token.used = True
            token.save()
            
            return Response({'message': 'Password has been reset successfully'})
            
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid token'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Password reset error: {str(e)}")
            return Response(
                {'error': 'An error occurred while resetting your password'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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

class ClubApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ClubApplicationSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Staff can see all applications
        if user.is_staff:
            return ClubApplication.objects.all()
            
        # Club admins can see applications for their clubs
        admin_clubs = ClubUser.objects.filter(user=user, is_admin=True).values_list('club_id', flat=True)
        
        # Users can see their own applications
        return ClubApplication.objects.filter(
            models.Q(user=user) | models.Q(club_id__in=admin_clubs)
        )
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user, status='pending')
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        application = self.get_object()
        
        # Check if user is admin of the club
        if not ClubUser.objects.filter(user=request.user, club=application.club, is_admin=True).exists() and not request.user.is_staff:
            return Response(
                {'error': 'Only club admins can approve applications'}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Check if application is pending
        if application.status != 'pending':
            return Response(
                {'error': f'Application is already {application.status}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check if user is already a member
        if ClubUser.objects.filter(user=application.user, club=application.club).exists():
            application.status = 'approved'
            application.save()
            return Response(
                {'message': 'User is already a member of this club'}, 
                status=status.HTTP_200_OK
            )
            
        # Add user to club
        with transaction.atomic():
            ClubUser.objects.create(
                user=application.user,
                club=application.club,
                is_admin=False
            )
            
            application.status = 'approved'
            application.save()
            
            # Send email notification to user
            subject = f'Club Application Approved: {application.club.name}'
            message = f"""
            Hello {application.user.first_name or application.user.username},
            
            Your application to join {application.club.name} has been approved!
            
            You can now log in and access the club.
            """
            
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [application.user.email],
                    fail_silently=False,
                )
            except Exception as e:
                logger.error(f"Failed to send email notification: {e}")
        
        return Response(
            ClubApplicationSerializer(application).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        application = self.get_object()
        
        # Check if user is admin of the club
        if not ClubUser.objects.filter(user=request.user, club=application.club, is_admin=True).exists() and not request.user.is_staff:
            return Response(
                {'error': 'Only club admins can reject applications'}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Check if application is pending
        if application.status != 'pending':
            return Response(
                {'error': f'Application is already {application.status}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Reject application
        application.status = 'rejected'
        application.save()
        
        # Send email notification to user
        subject = f'Club Application Status: {application.club.name}'
        message = f"""
        Hello {application.user.first_name or application.user.username},
        
        Your application to join {application.club.name} has been reviewed.
        
        Unfortunately, your application was not approved at this time.
        
        You may contact the club directly for more information.
        """
        
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [application.user.email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Failed to send email notification: {e}")
        
        return Response(
            ClubApplicationSerializer(application).data,
            status=status.HTTP_200_OK
        )

class CompetitionTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CompetitionType.objects.all()
    serializer_class = CompetitionTypeSerializer
    permission_classes = [permissions.AllowAny]  # Allow anyone to read competition types

    def get_queryset(self):
        return CompetitionType.objects.all() 