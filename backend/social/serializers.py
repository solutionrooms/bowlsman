from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import SocialBowl, SocialBowlParticipant
from users.serializers import UserSerializer

User = get_user_model()

class SocialBowlParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        write_only=True, 
        source='user'
    )
    
    class Meta:
        model = SocialBowlParticipant
        fields = ['id', 'user', 'user_id', 'joined_at']
        read_only_fields = ['joined_at']


class SocialBowlSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    participants = SocialBowlParticipantSerializer(many=True, read_only=True)
    participant_count = serializers.SerializerMethodField()
    is_joined = serializers.SerializerMethodField()
    
    class Meta:
        model = SocialBowl
        fields = [
            'id', 'title', 'description', 'date', 'time', 'location',
            'club', 'created_by', 'created_at', 'updated_at', 
            'participants', 'participant_count', 'is_joined'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_participant_count(self, obj):
        return obj.participants.count()
    
    def get_is_joined(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.participants.filter(user=request.user).exists()
        return False
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)