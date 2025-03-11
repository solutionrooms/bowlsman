from django.db import models
from django.contrib.auth import get_user_model
from users.models import Club

User = get_user_model()

class SocialBowl(models.Model):
    """A notice that club members can post on the noticeboard."""
    NOTICE_TYPES = [
        ('social_bowl', 'Social Bowling'),
        ('general', 'General Notice'),
        ('for_sale', 'For Sale'),
    ]
    
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    notice_type = models.CharField(max_length=20, choices=NOTICE_TYPES, default='social_bowl')
    date = models.DateField(null=True, blank=True)  # Optional for general notices
    time = models.TimeField(null=True, blank=True)  # Optional for general notices
    location = models.CharField(max_length=255, blank=True)  # Optional for general notices
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # For 'for_sale' notices
    image = models.ImageField(upload_to='notices/images/', null=True, blank=True)  # For notice images
    pdf_file = models.FileField(upload_to='notices/pdfs/', null=True, blank=True)  # For notice PDF attachments
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='social_bowls')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_social_bowls')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notice'
        verbose_name_plural = 'Notices'

    def __str__(self):
        return f"{self.title} - {self.get_notice_type_display()}"


class SocialBowlParticipant(models.Model):
    """Users who have joined a social bowling session."""
    social_bowl = models.ForeignKey(SocialBowl, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_bowl_participations')
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['social_bowl', 'user']
        verbose_name = 'Notice Participant'
        verbose_name_plural = 'Notice Participants'
        
    def __str__(self):
        return f"{self.user.username} - {self.social_bowl.title}"
