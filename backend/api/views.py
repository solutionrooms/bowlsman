from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from users.serializers import UserSerializer
from users.models import ClubUser, Club
from django.contrib.auth.models import User

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        club_id = request.data.get('club_id')
        
        user = authenticate(username=username, password=password)
        
        if user is None:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_active:
            return Response({'error': 'User is inactive'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Get user's clubs
        user_clubs = ClubUser.objects.filter(user=user)
        
        # If user doesn't belong to any clubs, return error
        if not user_clubs.exists():
            return Response({'error': 'User does not belong to any clubs'}, status=status.HTTP_403_FORBIDDEN)
        
        # If club_id is provided, verify user belongs to that club
        current_club = None
        if club_id:
            try:
                club_user = user_clubs.get(club_id=club_id)
                current_club = club_user.club
                # Update last login time for this club
                club_user.last_login_at = timezone.now()
                club_user.save()
            except ClubUser.DoesNotExist:
                return Response({'error': 'User does not belong to the specified club'}, status=status.HTTP_403_FORBIDDEN)
        else:
            # If no club_id provided, use the first club or most recently logged in
            club_user = user_clubs.order_by('-last_login_at').first()
            current_club = club_user.club
            # Update last login time
            club_user.last_login_at = timezone.now()
            club_user.save()
        
        # Create token
        token, created = Token.objects.get_or_create(user=user)
        
        # Serialize user data
        user_data = UserSerializer(user).data
        
        # Add clubs data to user
        user_data['clubs'] = []
        for club_user in user_clubs:
            user_data['clubs'].append({
                'id': club_user.club.id,
                'name': club_user.club.name,
                'is_admin': club_user.is_admin,
                'last_login_at': club_user.last_login_at
            })
        
        # Serialize current club
        current_club_data = {
            'id': current_club.id,
            'name': current_club.name,
            'address': current_club.address
        }
        
        return Response({
            'token': token.key,
            'user': user_data,
            'current_club': current_club_data
        })

class ClubListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Get all clubs the user is a member of
        user_clubs = ClubUser.objects.filter(user=request.user).select_related('club')
        
        clubs = []
        for club_user in user_clubs:
            clubs.append({
                'id': club_user.club.id,
                'name': club_user.club.name,
                'address': club_user.club.address,
                'created_at': club_user.club.created_at,
                'is_admin': club_user.is_admin
            })
        
        # If user is staff, also get all clubs they're not a member of
        if request.user.is_staff:
            other_clubs = Club.objects.exclude(id__in=[cu.club.id for cu in user_clubs])
            for club in other_clubs:
                clubs.append({
                    'id': club.id,
                    'name': club.name,
                    'address': club.address,
                    'created_at': club.created_at,
                    'is_admin': False,
                    'is_member': False
                })
        
        return Response(clubs)

class ClubAdminStatusView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Get the club ID from query parameters
        club_id = request.query_params.get('club_id')
        
        if not club_id:
            return Response({"error": "club_id parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Check if user is admin for this club
            club_user = ClubUser.objects.get(user=request.user, club_id=club_id)
            
            # Return admin status
            return Response({
                "club_id": int(club_id),
                "is_admin": club_user.is_admin,
                "username": request.user.username
            })
            
        except ClubUser.DoesNotExist:
            return Response({
                "club_id": int(club_id),
                "is_admin": False,
                "error": "User is not a member of this club",
                "username": request.user.username
            }, status=status.HTTP_404_NOT_FOUND)
    
    def post(self, request):
        # This endpoint allows setting admin status
        # Only staff users can use this endpoint
        if not request.user.is_staff:
            return Response({"error": "Only staff users can set admin status"}, status=status.HTTP_403_FORBIDDEN)
        
        club_id = request.data.get('club_id')
        user_id = request.data.get('user_id')
        is_admin = request.data.get('is_admin', True)
        
        if not club_id or not user_id:
            return Response({"error": "club_id and user_id are required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get the club user
            club_user = ClubUser.objects.get(user_id=user_id, club_id=club_id)
            
            # Update admin status
            club_user.is_admin = is_admin
            club_user.save()
            
            return Response({
                "club_id": int(club_id),
                "user_id": int(user_id),
                "is_admin": club_user.is_admin,
                "username": club_user.user.username
            })
            
        except ClubUser.DoesNotExist:
            return Response({
                "error": "User is not a member of this club",
                "club_id": int(club_id),
                "user_id": int(user_id)
            }, status=status.HTTP_404_NOT_FOUND)

class ClubCreateView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Only staff users can create clubs
        if not request.user.is_staff:
            return Response({'error': 'Only administrators can create clubs'}, status=status.HTTP_403_FORBIDDEN)
        
        name = request.data.get('name')
        address = request.data.get('address', '')
        
        if not name:
            return Response({'error': 'Club name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the club
        club = Club.objects.create(
            name=name,
            address=address,
            created_at=timezone.now()
        )
        
        # Add the creator as an admin of the club
        ClubUser.objects.create(
            user=request.user,
            club=club,
            is_admin=True,
            last_login_at=timezone.now()
        )
        
        return Response({
            'id': club.id,
            'name': club.name,
            'address': club.address,
            'created_at': club.created_at
        }, status=status.HTTP_201_CREATED)

class ClubDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, club_id):
        try:
            # Check if user is a member of this club
            club_user = ClubUser.objects.get(user=request.user, club_id=club_id)
            club = club_user.club
            
            # Get club details
            club_data = {
                'id': club.id,
                'name': club.name,
                'address': club.address,
                'created_at': club.created_at,
                'is_admin': club_user.is_admin
            }
            
            return Response(club_data)
            
        except ClubUser.DoesNotExist:
            # If user is staff, they can view any club
            if request.user.is_staff:
                try:
                    club = Club.objects.get(id=club_id)
                    club_data = {
                        'id': club.id,
                        'name': club.name,
                        'address': club.address,
                        'created_at': club.created_at,
                        'is_admin': False,
                        'is_member': False
                    }
                    return Response(club_data)
                except Club.DoesNotExist:
                    return Response({'error': 'Club not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'User does not belong to this club'}, status=status.HTTP_403_FORBIDDEN)

class ClubMembersView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, club_id):
        try:
            # Check if user is a member of this club
            club_user = ClubUser.objects.get(user=request.user, club_id=club_id)
            
            # Get all members of the club
            members = ClubUser.objects.filter(club_id=club_id).select_related('user')
            
            members_data = []
            for member in members:
                members_data.append({
                    'id': member.id,
                    'user_id': member.user.id,
                    'username': member.user.username,
                    'email': member.user.email,
                    'first_name': member.user.first_name,
                    'last_name': member.user.last_name,
                    'is_admin': member.is_admin,
                    'last_login_at': member.last_login_at
                })
            
            return Response(members_data)
            
        except ClubUser.DoesNotExist:
            # If user is staff, they can view any club's members
            if request.user.is_staff:
                try:
                    # Check if club exists
                    Club.objects.get(id=club_id)
                    
                    # Get all members of the club
                    members = ClubUser.objects.filter(club_id=club_id).select_related('user')
                    
                    members_data = []
                    for member in members:
                        members_data.append({
                            'id': member.id,
                            'user_id': member.user.id,
                            'username': member.user.username,
                            'email': member.user.email,
                            'first_name': member.user.first_name,
                            'last_name': member.user.last_name,
                            'is_admin': member.is_admin,
                            'last_login_at': member.last_login_at
                        })
                    
                    return Response(members_data)
                except Club.DoesNotExist:
                    return Response({'error': 'Club not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'User does not belong to this club'}, status=status.HTTP_403_FORBIDDEN)

    def post(self, request, club_id):
        try:
            # Check if user is an admin of this club
            club_user = ClubUser.objects.get(user=request.user, club_id=club_id)
            
            if not club_user.is_admin and not request.user.is_staff:
                return Response({'error': 'Only club administrators can add members'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get user to add
            username = request.data.get('username')
            is_admin = request.data.get('is_admin', False)
            
            if not username:
                return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                user_to_add = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Check if user is already a member
            if ClubUser.objects.filter(user=user_to_add, club_id=club_id).exists():
                return Response({'error': 'User is already a member of this club'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Add user to club
            club_user = ClubUser.objects.create(
                user=user_to_add,
                club_id=club_id,
                is_admin=is_admin,
                last_login_at=None
            )
            
            return Response({
                'id': club_user.id,
                'user_id': user_to_add.id,
                'username': user_to_add.username,
                'email': user_to_add.email,
                'first_name': user_to_add.first_name,
                'last_name': user_to_add.last_name,
                'is_admin': club_user.is_admin,
                'last_login_at': club_user.last_login_at
            }, status=status.HTTP_201_CREATED)
            
        except ClubUser.DoesNotExist:
            # If user is staff, they can add members to any club
            if request.user.is_staff:
                try:
                    # Check if club exists
                    Club.objects.get(id=club_id)
                    
                    # Get user to add
                    username = request.data.get('username')
                    is_admin = request.data.get('is_admin', False)
                    
                    if not username:
                        return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    try:
                        user_to_add = User.objects.get(username=username)
                    except User.DoesNotExist:
                        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
                    
                    # Check if user is already a member
                    if ClubUser.objects.filter(user=user_to_add, club_id=club_id).exists():
                        return Response({'error': 'User is already a member of this club'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Add user to club
                    club_user = ClubUser.objects.create(
                        user=user_to_add,
                        club_id=club_id,
                        is_admin=is_admin,
                        last_login_at=None
                    )
                    
                    return Response({
                        'id': club_user.id,
                        'user_id': user_to_add.id,
                        'username': user_to_add.username,
                        'email': user_to_add.email,
                        'first_name': user_to_add.first_name,
                        'last_name': user_to_add.last_name,
                        'is_admin': club_user.is_admin,
                        'last_login_at': club_user.last_login_at
                    }, status=status.HTTP_201_CREATED)
                except Club.DoesNotExist:
                    return Response({'error': 'Club not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'User does not belong to this club'}, status=status.HTTP_403_FORBIDDEN)

class ClubMemberDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, club_id, member_id):
        try:
            # Check if user is an admin of this club
            club_user = ClubUser.objects.get(user=request.user, club_id=club_id)
            
            if not club_user.is_admin and not request.user.is_staff:
                return Response({'error': 'Only club administrators can remove members'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get member to remove
            try:
                member = ClubUser.objects.get(id=member_id, club_id=club_id)
            except ClubUser.DoesNotExist:
                return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Don't allow removing yourself
            if member.user == request.user:
                return Response({'error': 'Cannot remove yourself from the club'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Remove member
            member.delete()
            
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except ClubUser.DoesNotExist:
            # If user is staff, they can remove members from any club
            if request.user.is_staff:
                try:
                    # Check if club exists
                    Club.objects.get(id=club_id)
                    
                    # Get member to remove
                    try:
                        member = ClubUser.objects.get(id=member_id, club_id=club_id)
                    except ClubUser.DoesNotExist:
                        return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)
                    
                    # Don't allow removing yourself
                    if member.user == request.user:
                        return Response({'error': 'Cannot remove yourself from the club'}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Remove member
                    member.delete()
                    
                    return Response(status=status.HTTP_204_NO_CONTENT)
                except Club.DoesNotExist:
                    return Response({'error': 'Club not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'User does not belong to this club'}, status=status.HTTP_403_FORBIDDEN)
    
    def patch(self, request, club_id, member_id):
        try:
            # Check if user is an admin of this club
            club_user = ClubUser.objects.get(user=request.user, club_id=club_id)
            
            if not club_user.is_admin and not request.user.is_staff:
                return Response({'error': 'Only club administrators can update members'}, status=status.HTTP_403_FORBIDDEN)
            
            # Get member to update
            try:
                member = ClubUser.objects.get(id=member_id, club_id=club_id)
            except ClubUser.DoesNotExist:
                return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Update admin status
            is_admin = request.data.get('is_admin')
            if is_admin is not None:
                member.is_admin = is_admin
                member.save()
            
            return Response({
                'id': member.id,
                'user_id': member.user.id,
                'username': member.user.username,
                'email': member.user.email,
                'first_name': member.user.first_name,
                'last_name': member.user.last_name,
                'is_admin': member.is_admin,
                'last_login_at': member.last_login_at
            })
            
        except ClubUser.DoesNotExist:
            # If user is staff, they can update members of any club
            if request.user.is_staff:
                try:
                    # Check if club exists
                    Club.objects.get(id=club_id)
                    
                    # Get member to update
                    try:
                        member = ClubUser.objects.get(id=member_id, club_id=club_id)
                    except ClubUser.DoesNotExist:
                        return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)
                    
                    # Update admin status
                    is_admin = request.data.get('is_admin')
                    if is_admin is not None:
                        member.is_admin = is_admin
                        member.save()
                    
                    return Response({
                        'id': member.id,
                        'user_id': member.user.id,
                        'username': member.user.username,
                        'email': member.user.email,
                        'first_name': member.user.first_name,
                        'last_name': member.user.last_name,
                        'is_admin': member.is_admin,
                        'last_login_at': member.last_login_at
                    })
                except Club.DoesNotExist:
                    return Response({'error': 'Club not found'}, status=status.HTTP_404_NOT_FOUND)
            else:
                return Response({'error': 'User does not belong to this club'}, status=status.HTTP_403_FORBIDDEN)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Delete the user's token to logout
        if request.auth:
            request.auth.delete()
        return Response(status=status.HTTP_200_OK) 