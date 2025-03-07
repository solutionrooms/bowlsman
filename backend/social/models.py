from django.db import models
from django.contrib.auth import get_user_model
from users.models import Club

User = get_user_model()

class SocialBowl(models.Model):
    """A social bowling session that club members can arrange and join."""
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    date = models.DateField()
    time = models.TimeField()
    location = models.CharField(max_length=255)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='social_bowls')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_social_bowls')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'time']
        verbose_name = 'Social Bowl'
        verbose_name_plural = 'Social Bowls'

    def __str__(self):
        return f"{self.title} - {self.date} at {self.time}"


class SocialBowlParticipant(models.Model):
    """Users who have joined a social bowling session."""
    social_bowl = models.ForeignKey(SocialBowl, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_bowl_participations')
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['social_bowl', 'user']
        verbose_name = 'Social Bowl Participant'
        verbose_name_plural = 'Social Bowl Participants'
        
    def __str__(self):
        return f"{self.user.username} - {self.social_bowl.title}"
