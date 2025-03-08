from django.db import models
from django.conf import settings
from users.models import Club

class League(models.Model):
    """
    Represents a league within a club for a specific season.
    """
    name = models.CharField(max_length=100)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='leagues')
    season = models.CharField(max_length=20, help_text="Season year, e.g., '2023'")
    captain = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='captained_leagues'
    )
    deputy = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='deputy_leagues'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('club', 'name', 'season')
        ordering = ['-season', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.season}) - {self.club.name}"

class LeagueMember(models.Model):
    """
    Represents a player in a league.
    """
    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='league_memberships')
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('league', 'user')
        ordering = ['user__first_name', 'user__last_name']
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.league.name}" 