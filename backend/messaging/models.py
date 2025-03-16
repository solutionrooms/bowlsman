from django.db import models
from django.contrib.auth.models import User
from users.models import Club, Competition
from django.core.validators import FileExtensionValidator
from users.models import validate_image_size

class Chat(models.Model):
    CHAT_TYPES = [
        ('direct', 'Direct Chat'),
        ('group', 'Group Chat'),
        ('team', 'Team Chat'),
        ('competition', 'Competition Chat'),
    ]
    
    name = models.CharField(max_length=255, blank=True, null=True)
    chat_type = models.CharField(max_length=20, choices=CHAT_TYPES, default='direct')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_chats')
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='club_chats')
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='competition_chats', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        if self.name:
            return f"{self.name} ({self.get_chat_type_display()})"
        elif self.chat_type == 'direct' and self.members.count() == 2:
            members = self.members.all()
            return f"Chat between {members[0].user.username} and {members[1].user.username}"
        else:
            return f"{self.get_chat_type_display()} created by {self.created_by.username}"
    
    def get_display_name(self, user=None):
        """Return the appropriate display name based on chat type"""
        if self.name:
            return self.name
        
        if self.chat_type == 'direct' and self.members.count() == 2:
            # For direct chats, show the other person's name
            if user:
                other_member = self.members.exclude(user=user).first()
                if other_member and other_member.user:
                    if other_member.user.first_name and other_member.user.last_name:
                        return f"{other_member.user.first_name} {other_member.user.last_name}"
                    return other_member.user.username
            
            # Fallback if user not provided or other member not found
            members = self.members.all()
            if len(members) == 2:
                member = members[1] if members[0].user == self.created_by else members[0]
                if member.user.first_name and member.user.last_name:
                    return f"{member.user.first_name} {member.user.last_name}"
                return member.user.username
        
        elif self.chat_type == 'group':
            return "Group Chat"
        
        elif self.chat_type == 'team':
            return f"Team: {self.club.name}"
        
        elif self.chat_type == 'competition' and self.competition:
            return f"{self.competition.name}"
        
        # Default fallback
        return f"{self.get_chat_type_display()}"

class ChatMember(models.Model):
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_memberships')
    is_admin = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    is_archived = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['chat', 'user']
        ordering = ['joined_at']
    
    def __str__(self):
        return f"{self.user.username} in {self.chat}"

class ChatMessage(models.Model):
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_chat_messages')
    content = models.TextField()
    image = models.ImageField(
        upload_to='chat_images/',
        null=True,
        blank=True,
        validators=[
            FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif']),
            validate_image_size
        ]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['created_at']
    
    def __str__(self):
        return f"Message from {self.sender.username} in {self.chat}"

# Keep the old Message model for backward compatibility
class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages', null=True, blank=True)
    club = models.ForeignKey('users.Club', on_delete=models.CASCADE, related_name='club_messages')
    subject = models.CharField(max_length=255)
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    is_club_wide = models.BooleanField(default=False)  # True for messages sent to all club members
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        if self.is_club_wide:
            return f"{self.sender.username} to all {self.club.name} members: {self.subject}"
        return f"{self.sender.username} to {self.recipient.username}: {self.subject}"