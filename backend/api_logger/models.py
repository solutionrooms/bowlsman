from django.db import models
from django.contrib.auth.models import User
from django.utils.timezone import now

class ApiLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(default=now)
    method = models.CharField(max_length=10)  # GET, POST, PUT, etc.
    path = models.CharField(max_length=255)
    query_params = models.JSONField(null=True, blank=True)
    request_body = models.JSONField(null=True, blank=True)
    status_code = models.IntegerField()
    response_time = models.FloatField(help_text="Response time in seconds")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['path']),
            models.Index(fields=['method']),
            models.Index(fields=['status_code']),
        ]
    
    def __str__(self):
# Create your models here.
