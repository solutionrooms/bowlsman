from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Competition, CompetitionUser, CompetitionSchedule

class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    search_name = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_active', 'is_staff', 'password', 'first_name', 'last_name', 'display_name', 'search_name']
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

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
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

class CompetitionSerializer(serializers.ModelSerializer):
    creator_name = serializers.CharField(source='creator.username', read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    players = CompetitionUserSerializer(source='competition_users', many=True, read_only=True)
    available_slots = serializers.SerializerMethodField()

    class Meta:
        model = Competition
        fields = ['id', 'name', 'created_at', 'num_players', 'creator', 'creator_name', 
                 'rule_set_id', 'is_full', 'players', 'available_slots', 'status', 'parallel_matches', 'max_rounds']
        read_only_fields = ['creator', 'created_at', 'status']

    def get_available_slots(self, obj):
        return obj.num_players - obj.competition_users.count()

class CompetitionScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitionSchedule
        fields = [
            'id', 'competition', 'round', 'sub_round', 'created_at',
            'side_1_player_1', 'side_1_player_2', 'side_1_player_3', 'side_1_player_4',
            'side_2_player_1', 'side_2_player_2', 'side_2_player_3', 'side_2_player_4'
        ]
        read_only_fields = ['created_at'] 