from rest_framework import serializers
from .models import Message
from django.contrib.auth.models import User
from .models import Chat, ChatMember, ChatMessage
from users.models import Club, Competition

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    club_role = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'club_role', 'is_admin']
    
    def get_full_name(self, obj):
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}"
        return obj.username
    
    def get_club_role(self, obj):
        # Get the club_id from the context if available
        request = self.context.get('request')
        if request:
            club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
            if club_id:
                # Try to find the club membership for the current club
                from users.models import ClubUser
                try:
                    club_user = ClubUser.objects.get(user=obj, club_id=club_id)
                    return club_user.club_role
                except ClubUser.DoesNotExist:
                    pass
        return ""
    
    def get_is_admin(self, obj):
        # Get the club_id from the context if available
        request = self.context.get('request')
        if request:
            club_id = request.query_params.get('club_id') or request.session.get('current_club_id')
            if club_id:
                # Try to find the club membership for the current club
                from users.models import ClubUser
                try:
                    club_user = ClubUser.objects.get(user=obj, club_id=club_id)
                    return club_user.is_admin
                except ClubUser.DoesNotExist:
                    pass
        return False

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
    members = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    can_archive = serializers.SerializerMethodField()
    
    class Meta:
        model = Chat
        fields = ['id', 'name', 'chat_type', 'created_by', 'created_by_username', 
                  'club', 'competition', 'notice', 'created_at', 'updated_at', 
                  'member_count', 'unread_count', 'last_message', 'display_name', 
                  'members', 'can_delete', 'can_archive']
        read_only_fields = ['created_by_username', 'member_count', 'unread_count', 
                           'last_message', 'display_name', 'members',
                           'can_delete', 'can_archive']
    
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
        
    def get_members(self, obj):
        # Only include member information for direct chats for efficiency
        if obj.chat_type == 'direct' and obj.members.count() == 2:
            members = []
            for member in obj.members.all():
                # Only include minimal user details
                user_details = {
                    'id': member.user.id,
                    'username': member.user.username,
                    'full_name': member.user.get_full_name() or member.user.username,
                    'club_role': '',
                    'is_admin': member.is_admin
                }
                
                # Get club_role if available
                club_id = obj.club_id
                if club_id:
                    try:
                        from users.models import ClubUser
                        club_user = ClubUser.objects.get(user=member.user, club_id=club_id)
                        user_details['club_role'] = club_user.club_role
                    except ClubUser.DoesNotExist:
                        pass
                
                members.append({
                    'id': member.id,
                    'user_details': user_details
                })
            return members
        return []
    
    def get_can_delete(self, obj):
        """Determine if the current user can fully delete the chat"""
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return False
            
        user = request.user
        
        # Check if user is club admin or the chat creator
        is_club_admin = False
        try:
            from users.models import ClubUser
            is_club_admin = ClubUser.objects.filter(
                user=user, 
                club=obj.club, 
                is_admin=True
            ).exists()
        except Exception as e:
            print(f"Error checking if {user.username} is admin: {str(e)}")
            pass
            
        is_chat_creator = obj.created_by == user
        
        # Log serializer permission calculation
        can_delete = is_club_admin or is_chat_creator
        print(f"SERIALIZER can_delete - User: {user.username}, Admin: {is_club_admin}, Creator: {is_chat_creator}, Result: {can_delete}, Chat ID: {obj.id}")
        
        return can_delete
    
    def get_can_archive(self, obj):
        """Everyone can hide/archive a chat from their own view"""
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return False
            
        # Check if user is a member of the chat
        user = request.user
        return obj.members.filter(user=user).exists()

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