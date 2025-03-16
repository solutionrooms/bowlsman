from django.db import models
from django.contrib.auth.models import User
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
import uuid
from django.utils import timezone
import datetime

def validate_image_size(value):
    filesize = value.size
    if filesize > 5 * 1024 * 1024:  # 5MB
        raise ValidationError("Maximum file size is 5MB")

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    profile_picture = models.ImageField(
        upload_to='profile_pictures/',
        null=True,
        blank=True,
        validators=[
            FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png']),
            validate_image_size
        ]
    )
    postcode = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username}'s profile"

class Club(models.Model):
    name = models.CharField(max_length=100, unique=True)
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class ClubUser(models.Model):
    ROLE_CHOICES = [
        ('', 'No Role'),
        ('President', 'President'),
        ('Vice-President', 'Vice-President'),
        ('Treasurer', 'Treasurer'),
        ('Secretary', 'Secretary'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='club_memberships')
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='members')
    is_admin = models.BooleanField(default=False)
    club_role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['user', 'club']
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user.username} at {self.club.name}"

class CompetitionType(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return self.name

class Competition(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('full', 'Full'),
        ('scheduled', 'Scheduled'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]

    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    num_players = models.IntegerField()
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='competitions')
    competition_type = models.ForeignKey(CompetitionType, on_delete=models.CASCADE, related_name='competitions')
    parallel_matches = models.IntegerField(default=1)  # Number of matches that can be played simultaneously
    max_rounds = models.IntegerField(default=5)  # Maximum number of rounds to generate
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='competitions')

    class Meta:
        ordering = ['-created_at']
        unique_together = ['name', 'club']

    def __str__(self):
        return f"{self.name} - {self.club.name}"
    
    @property
    def is_full(self):
        return self.competition_users.count() >= self.num_players

    def update_status(self):
        if self.schedules.exists():
            self.status = 'scheduled'
        elif self.is_full:
            self.status = 'full'
        else:
            self.status = 'open'
        self.save()

class CompetitionSchedule(models.Model):
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='schedules')
    round = models.IntegerField()
    sub_round = models.IntegerField(default=1)  # For parallel matches within a round
    side_1_player_1 = models.ForeignKey('CompetitionUser', on_delete=models.CASCADE, related_name='side_1_player_1_games', null=True, blank=True)
    side_1_player_2 = models.ForeignKey('CompetitionUser', on_delete=models.CASCADE, related_name='side_1_player_2_games', null=True, blank=True)
    side_1_player_3 = models.ForeignKey('CompetitionUser', on_delete=models.CASCADE, related_name='side_1_player_3_games', null=True, blank=True)
    side_1_player_4 = models.ForeignKey('CompetitionUser', on_delete=models.CASCADE, related_name='side_1_player_4_games', null=True, blank=True)
    side_2_player_1 = models.ForeignKey('CompetitionUser', on_delete=models.CASCADE, related_name='side_2_player_1_games', null=True, blank=True)
    side_2_player_2 = models.ForeignKey('CompetitionUser', on_delete=models.CASCADE, related_name='side_2_player_2_games', null=True, blank=True)
    side_2_player_3 = models.ForeignKey('CompetitionUser', on_delete=models.CASCADE, related_name='side_2_player_3_games', null=True, blank=True)
    side_2_player_4 = models.ForeignKey('CompetitionUser', on_delete=models.CASCADE, related_name='side_2_player_4_games', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['round', 'sub_round', 'created_at']
        unique_together = ['competition', 'round', 'sub_round']

    def __str__(self):
        return f"{self.competition.name} - Round {self.round}.{self.sub_round}"

class CompetitionUser(models.Model):
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='competition_users')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='competition_participations')
    guest_name = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    order = models.PositiveIntegerField()

    class Meta:
        unique_together = [['competition', 'user'], ['competition', 'guest_name']]
        ordering = ['order']

    def __str__(self):
        if self.user:
            return f"{self.user.username} in {self.competition}"
        return f"{self.guest_name} in {self.competition}"

    def clean(self):
        if not self.user and not self.guest_name:
            raise models.ValidationError("Either user or guest_name must be provided")
        if self.user and self.guest_name:
            raise models.ValidationError("Cannot have both user and guest_name")

    def save(self, *args, **kwargs):
        if not self.order:
            max_order = CompetitionUser.objects.filter(competition=self.competition).aggregate(models.Max('order'))['order__max']
            self.order = (max_order or 0) + 1
        super().save(*args, **kwargs) 

class GameScore(models.Model):
    schedule = models.ForeignKey(CompetitionSchedule, on_delete=models.CASCADE, related_name='scores')
    side_1_score = models.IntegerField(default=0)
    side_2_score = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-updated_at']
        unique_together = ['schedule']
        
    def __str__(self):
        return f"{self.schedule} - {self.side_1_score} vs {self.side_2_score}"

class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            # Token expires after 24 hours
            self.expires_at = timezone.now() + datetime.timedelta(hours=24)
        super().save(*args, **kwargs)

    def is_valid(self):
        return not self.used and self.expires_at > timezone.now()

    def __str__(self):
        return f"Password reset token for {self.user.username}"

class ClubApplication(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='club_applications')
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='applications')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'club']
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.user.username}'s application to {self.club.name}"