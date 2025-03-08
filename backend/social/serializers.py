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
    participant_count = serializers.SerializerMethodField()
    is_participant = serializers.SerializerMethodField()
    participants = SocialBowlParticipantSerializer(many=True, read_only=True)
    
    class Meta:
        model = SocialBowl
        fields = [
            'id', 'title', 'description', 'notice_type', 'date', 'time', 
            'location', 'price', 'club', 'created_by', 'created_at', 
            'updated_at', 'participant_count', 'is_participant', 'participants'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']
    
    def get_participant_count(self, obj):
        return obj.participants.count()
    
    def get_is_participant(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.participants.filter(user=request.user).exists()
        return False
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['created_by'] = request.user
        return super().create(validated_data)