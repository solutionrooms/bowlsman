from rest_framework import serializers
from .models import Message
from django.contrib.auth.models import User
from .models import Chat, ChatMember, ChatMessage
from users.models import Club, Competition

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name']
    
    def get_full_name(self, obj):
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        return obj.username

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.ReadOnlyField(source='sender.username')
    sender_full_name = serializers.SerializerMethodField()
    recipient_name = serializers.ReadOnlyField(source='recipient.username', default=None)
    recipient_full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = ['id', 'sender', 'recipient', 'club', 'subject', 'content', 'is_read', 
                  'is_club_wide', 'created_at', 'updated_at', 'sender_name', 
                  'sender_full_name', 'recipient_name', 'recipient_full_name']
        read_only_fields = ['sender_name', 'sender_full_name', 'recipient_name', 'recipient_full_name']
    
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

class ChatSerializer(serializers.ModelSerializer):
    created_by_username = serializers.ReadOnlyField(source='created_by.username')
    member_count = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Chat
        fields = ['id', 'name', 'chat_type', 'created_by', 'created_by_username', 
                  'club', 'competition', 'created_at', 'updated_at', 
                  'member_count', 'unread_count', 'last_message', 'display_name']
        read_only_fields = ['created_by_username', 'member_count', 'unread_count', 'last_message', 'display_name']
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_unread_count(self, obj):
        user = self.context.get('request').user
        try:
            member = obj.members.get(user=user)
            if not member.last_read_at:
                return obj.messages.count()
            return obj.messages.filter(created_at__gt=member.last_read_at).count()
        except ChatMember.DoesNotExist:
            return 0
    
    def get_last_message(self, obj):
        last_message = obj.messages.order_by('-created_at').first()
        if last_message:
            return {
                'id': last_message.id,
                'content': last_message.content[:50] + '...' if len(last_message.content) > 50 else last_message.content,
                'sender': last_message.sender.username,
                'created_at': last_message.created_at
            }
        return None
        
    def get_display_name(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.get_display_name(request.user)
        return obj.get_display_name()

class ChatMemberSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = ChatMember
        fields = ['id', 'chat', 'user', 'user_details', 'is_admin', 'joined_at', 'last_read_at']
        read_only_fields = ['user_details']

class ChatMessageSerializer(serializers.ModelSerializer):
    sender_details = UserSerializer(source='sender', read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = ChatMessage
        fields = ['id', 'chat', 'sender', 'sender_details', 'content', 'image', 'image_url', 'created_at', 'updated_at']
        read_only_fields = ['sender_details', 'image_url']
    
    def get_image_url(self, obj):
        if obj.image:
            return obj.image.url
        return None

class ChatDetailSerializer(ChatSerializer):
    members = ChatMemberSerializer(source='members.all', many=True, read_only=True)
    messages = serializers.SerializerMethodField()
    
    class Meta(ChatSerializer.Meta):
        fields = ChatSerializer.Meta.fields + ['members', 'messages']
    
    def get_messages(self, obj):
        # Get the last 50 messages by default
        messages = obj.messages.order_by('-created_at')[:50]
        return ChatMessageSerializer(messages, many=True).data