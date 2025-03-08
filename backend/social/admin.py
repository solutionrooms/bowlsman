from django.contrib import admin
from .models import SocialBowl, SocialBowlParticipant

class SocialBowlParticipantInline(admin.TabularInline):
    model = SocialBowlParticipant
    extra = 0
    readonly_fields = ['joined_at']

@admin.register(SocialBowl)
class SocialBowlAdmin(admin.ModelAdmin):
    list_display = ('title', 'notice_type', 'club', 'created_by', 'created_at')
    list_filter = ('notice_type', 'club', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [SocialBowlParticipantInline]

@admin.register(SocialBowlParticipant)
class SocialBowlParticipantAdmin(admin.ModelAdmin):
    list_display = ('user', 'social_bowl', 'joined_at')
    list_filter = ('social_bowl__notice_type', 'joined_at')
    search_fields = ('user__username', 'social_bowl__title')
