from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import SocialBowl, SocialBowlParticipant, NoticeImage
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


class NoticeImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoticeImage
        fields = ['id', 'image', 'order']


class SocialBowlSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    participant_count = serializers.SerializerMethodField()
    is_participant = serializers.SerializerMethodField()
    participants = SocialBowlParticipantSerializer(many=True, read_only=True)
    additional_images = NoticeImageSerializer(many=True, read_only=True)
    
    # Explicitly define the field to include the new broadcast type
    notice_type = serializers.ChoiceField(choices=[
        ('social_bowl', 'Social Bowling'),
        ('general', 'General Notice'),
        ('for_sale', 'For Sale'),
        ('broadcast', 'Broadcast Notice'),
    ])
    
    class Meta:
        model = SocialBowl
        fields = [
            'id', 'title', 'description', 'notice_type', 'date', 'time', 
            'location', 'price', 'image', 'pdf_file', 'club', 'created_by', 'created_at', 
            'updated_at', 'participant_count', 'is_participant', 'participants', 'additional_images',
            'is_broadcast', 'weather_forecast', 'weather_updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'weather_forecast', 'weather_updated_at']
    
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
        
        # Auto-set is_broadcast flag for broadcast notices
        if validated_data.get('notice_type') == 'broadcast':
            validated_data['is_broadcast'] = True
            
        return super().create(validated_data)
        
    def update(self, instance, validated_data):
        # Auto-set is_broadcast flag for broadcast notices
        if validated_data.get('notice_type') == 'broadcast':
            validated_data['is_broadcast'] = True
        
        return super().update(instance, validated_data)