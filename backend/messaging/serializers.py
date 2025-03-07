from rest_framework import serializers
from .models import Message
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    sender_full_name = serializers.SerializerMethodField(read_only=True)
    recipient_name = serializers.CharField(source='recipient.username', read_only=True)
    recipient_full_name = serializers.SerializerMethodField(read_only=True)
    club_name = serializers.CharField(source='club.name', read_only=True)
    
    def get_sender_full_name(self, obj):
        if obj.sender.first_name and obj.sender.last_name:
            return f"{obj.sender.first_name} {obj.sender.last_name}"
        return obj.sender.username
        
    def get_recipient_full_name(self, obj):
        if obj.recipient and obj.recipient.first_name and obj.recipient.last_name:
            return f"{obj.recipient.first_name} {obj.recipient.last_name}"
        elif obj.recipient:
            return obj.recipient.username
        return None
    
    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_name', 'sender_full_name', 
                  'recipient', 'recipient_name', 'recipient_full_name',
                  'club', 'club_name', 'subject', 'content', 'is_read', 
                  'is_club_wide', 'created_at', 'updated_at']
        read_only_fields = ['sender', 'created_at', 'updated_at']
        
    def create(self, validated_data):
        # Set the sender to the current user
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)
        
    def update(self, instance, validated_data):
        # If we're updating is_read, verify permissions
        if 'is_read' in validated_data and validated_data['is_read']:
            user = self.context['request'].user
            # Check if user is recipient or club member for club-wide messages
            is_recipient = instance.recipient == user
            is_club_member = False
            
            if instance.is_club_wide and hasattr(user, 'club_memberships'):
                is_club_member = user.club_memberships.filter(club=instance.club).exists()
                
            if not (is_recipient or is_club_member):
                raise serializers.ValidationError("You don't have permission to mark this message as read")
                
        return super().update(instance, validated_data)