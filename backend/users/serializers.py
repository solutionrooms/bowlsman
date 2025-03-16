from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Competition, CompetitionUser, CompetitionSchedule, Club, ClubUser, GameScore, UserProfile, ClubApplication, CompetitionType

class ClubSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Club
        fields = ['id', 'name', 'address', 'created_at', 'member_count']
        read_only_fields = ['created_at', 'member_count']

    def get_member_count(self, obj):
        return obj.members.count()

class ClubUserSerializer(serializers.ModelSerializer):
    user_details = serializers.SerializerMethodField()
    club_name = serializers.CharField(source='club.name', read_only=True)
    user = serializers.SerializerMethodField()

    class Meta:
        model = ClubUser
        fields = ['id', 'user', 'club', 'club_name', 'is_admin', 'club_role', 'created_at', 'last_login_at', 'user_details']
        read_only_fields = ['created_at', 'last_login_at']

    def get_user_details(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'display_name': f"{obj.user.first_name} {obj.user.last_name}" if obj.user.first_name or obj.user.last_name else obj.user.username
        }
        
    def get_user(self, obj):
        # Check if we should include full user data
        include_full = self.context.get('include_full_user_data', False)
        
        if include_full:
            # Return full user data with display_name and search_name
            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'email': obj.user.email,
                'first_name': obj.user.first_name,
                'last_name': obj.user.last_name,
                'display_name': f"{obj.user.first_name} {obj.user.last_name} ({obj.user.username})" if obj.user.first_name or obj.user.last_name else obj.user.username,
                'search_name': f"{obj.user.first_name} {obj.user.last_name} {obj.user.username}".lower()
            }
        else:
            # Just return the user ID for reference
            return obj.user.id

class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    search_name = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False)
    clubs = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()
    postcode = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_active', 'is_staff', 'password', 'first_name', 'last_name', 'display_name', 'search_name', 'clubs', 'profile_picture', 'postcode']
        extra_kwargs = {
            'password': {'write_only': True},
            'username': {'required': True},
            'email': {'required': True}
        }

    def get_display_name(self, obj):
        if obj.first_name or obj.last_name:
            return f"{obj.first_name} {obj.last_name} ({obj.username})"
        return obj.username

    def get_search_name(self, obj):
        return f"{obj.first_name} {obj.last_name} {obj.username}".lower()
    
    def get_clubs(self, obj):
        club_users = ClubUser.objects.filter(user=obj)
        return [
            {
                'id': club_user.club.id,
                'name': club_user.club.name,
                'is_admin': club_user.is_admin,
                'club_role': club_user.club_role,
                'last_login_at': club_user.last_login_at
            }
            for club_user in club_users
        ]

    def get_profile_picture(self, obj):
        try:
            profile = obj.profile
            if profile.profile_picture:
                return profile.profile_picture.url
            # Return postcode from profile if available
            return profile.profile_picture.url if profile.profile_picture else None
        except UserProfile.DoesNotExist:
            pass
        return None
        
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Add postcode from profile if it exists
        try:
            profile = instance.profile
            ret['postcode'] = profile.postcode
        except UserProfile.DoesNotExist:
            ret['postcode'] = None
        return ret

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        postcode = validated_data.pop('postcode', None)
        
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
            
        # Create or update user profile with postcode
        profile, created = UserProfile.objects.get_or_create(user=user)
        if postcode:
            profile.postcode = postcode
            profile.save()
            
        return user
        
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        postcode = validated_data.pop('postcode', None)
        
        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if password:
            instance.set_password(password)
        
        instance.save()
        
        # Update profile with postcode if provided
        if postcode is not None:
            profile, created = UserProfile.objects.get_or_create(user=instance)
            profile.postcode = postcode
            profile.save()
            
        return instance

class CompetitionUserSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()

    class Meta:
        model = CompetitionUser
        fields = ['id', 'competition', 'user', 'guest_name', 'username', 'created_at', 'order']
        read_only_fields = ['created_at']

    def get_username(self, obj):
        if obj.user:
            if obj.user.first_name or obj.user.last_name:
                return f"{obj.user.first_name} {obj.user.last_name} ({obj.user.username})"
            return obj.user.username
        return f"{obj.guest_name} (Guest)" if obj.guest_name else None

    def validate(self, data):
        if not data.get('user') and not data.get('guest_name'):
            raise serializers.ValidationError("Either user or guest_name must be provided")
        if data.get('user') and data.get('guest_name'):
            raise serializers.ValidationError("Cannot have both user and guest_name")
        return data

class CompetitionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionType
        fields = ['id', 'name', 'description']

class CompetitionSerializer(serializers.ModelSerializer):
    creator_name = serializers.CharField(source='creator.username', read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    players = CompetitionUserSerializer(source='competition_users', many=True, read_only=True)
    available_slots = serializers.SerializerMethodField()
    club_name = serializers.CharField(source='club.name', read_only=True)
    competition_type_name = serializers.CharField(source='competition_type.name', read_only=True)

    class Meta:
        model = Competition
        fields = ['id', 'name', 'created_at', 'num_players', 'creator', 'creator_name', 
                 'competition_type', 'competition_type_name', 'is_full', 'players', 'available_slots', 'status', 
                 'parallel_matches', 'max_rounds', 'club', 'club_name']
        read_only_fields = ['creator', 'created_at', 'status']

    def get_available_slots(self, obj):
        return obj.num_players - obj.competition_users.count()
        
    def validate(self, attrs):
        # We don't need to validate creator field - it will be set in perform_create
        return attrs

class CompetitionScheduleSerializer(serializers.ModelSerializer):
    score = serializers.SerializerMethodField()
    
    class Meta:
        model = CompetitionSchedule
        fields = [
            'id', 'competition', 'round', 'sub_round', 'created_at',
            'side_1_player_1', 'side_1_player_2', 'side_1_player_3', 'side_1_player_4',
            'side_2_player_1', 'side_2_player_2', 'side_2_player_3', 'side_2_player_4',
            'score'
        ]
        read_only_fields = ['created_at']
    
    def get_score(self, obj):
        try:
            score = obj.scores.first()
            if score:
                return {
                    'id': score.id,
                    'side_1_score': score.side_1_score,
                    'side_2_score': score.side_2_score,
                    'completed': score.completed
                }
            return None
        except GameScore.DoesNotExist:
            return None

class GameScoreSerializer(serializers.ModelSerializer):
    round = serializers.IntegerField(source='schedule.round', read_only=True)
    sub_round = serializers.IntegerField(source='schedule.sub_round', read_only=True)
    
    class Meta:
        model = GameScore
        fields = ['id', 'schedule', 'side_1_score', 'side_2_score', 'created_at', 'updated_at', 'completed', 'round', 'sub_round']
        read_only_fields = ['created_at', 'updated_at']

class ClubApplicationSerializer(serializers.ModelSerializer):
    user_details = serializers.SerializerMethodField()
    club_name = serializers.CharField(source='club.name', read_only=True)
    
    class Meta:
        model = ClubApplication
        fields = ['id', 'user', 'club', 'club_name', 'status', 'message', 'created_at', 'updated_at', 'user_details']
        read_only_fields = ['created_at', 'updated_at', 'status']
        
    def get_user_details(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'display_name': f"{obj.user.first_name} {obj.user.last_name}" if obj.user.first_name or obj.user.last_name else obj.user.username
        } 