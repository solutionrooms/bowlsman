from django.db import models
from django.conf import settings
from users.models import Club
from datetime import date

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
    league_table_link = models.URLField(max_length=500, null=True, blank=True, help_text="URL to the league's standings/table")
    team_link = models.URLField(max_length=500, null=True, blank=True, help_text="URL to the team's website or page")
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

class PlayerNameMapping(models.Model):
    """
    Stores mappings between roster names and club members for consistent importing.
    """
    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name='name_mappings')
    roster_first_name = models.CharField(max_length=100)
    roster_last_name = models.CharField(max_length=100)
    roster_full_name = models.CharField(max_length=200)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='roster_mappings')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('league', 'roster_first_name', 'roster_last_name')
        ordering = ['roster_full_name']
    
    def __str__(self):
        return f"Mapping: {self.roster_full_name} -> {self.user.get_full_name()} in {self.league.name}"

class Fixture(models.Model):
    """
    Represents a match fixture for a league.
    """
    VENUE_CHOICES = [
        ('home', 'Home'),
        ('away', 'Away'),
    ]

    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name='fixtures')
    opponent = models.CharField(max_length=100)
    venue = models.CharField(max_length=10, choices=VENUE_CHOICES)
    fixture_date = models.DateField()
    for_score = models.IntegerField(null=True, blank=True)
    against_score = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['fixture_date']
        unique_together = ('league', 'opponent', 'fixture_date')
    
    @property
    def is_upcoming(self):
        """Check if fixture is upcoming (today or in the future)"""
        return self.fixture_date >= date.today()
    
    @property
    def is_completed(self):
        """Check if fixture has been completed (has scores)"""
        return self.for_score is not None and self.against_score is not None
    
    def __str__(self):
        return f"{self.opponent} - {self.venue} - {self.fixture_date.strftime('%d %b %Y')}"


class PlayerAvailability(models.Model):
    """
    Tracks a player's availability for a specific fixture.
    """
    AVAILABILITY_CHOICES = [
        ('available', 'Available'),
        ('not_available', 'Not Available'),
        ('prefer_not', 'Prefer Not')
    ]
    
    fixture = models.ForeignKey(Fixture, on_delete=models.CASCADE, related_name='player_availabilities')
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='fixture_availabilities')
    availability = models.CharField(max_length=15, choices=AVAILABILITY_CHOICES, default='available')
    notes = models.TextField(blank=True, null=True, max_length=500, help_text="Optional notes about availability")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('fixture', 'player')
        verbose_name_plural = 'Player availabilities'
        
    def __str__(self):
        return f"{self.player.get_full_name()} - {self.get_availability_display()} for {self.fixture}" 