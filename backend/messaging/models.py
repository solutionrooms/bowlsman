from django.db import models
from django.contrib.auth.models import User

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