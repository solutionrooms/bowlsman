from django.contrib import admin
from .models import Message

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'subject', 'sender', 'recipient', 'is_club_wide', 'is_read', 'created_at')
    list_filter = ('is_read', 'is_club_wide', 'club')
    search_fields = ('subject', 'content', 'sender__username', 'recipient__username')
    ordering = ('-created_at',)