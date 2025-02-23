from django.db import models
from django.contrib.auth.models import User

class Competition(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    num_players = models.IntegerField()
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='competitions')
    rule_set_id = models.IntegerField()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
    
    @property
    def is_full(self):
        return self.competition_users.count() >= self.num_players

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