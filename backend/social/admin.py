from django.contrib import admin
from .models import SocialBowl, SocialBowlParticipant

class SocialBowlParticipantInline(admin.TabularInline):
    model = SocialBowlParticipant
    extra = 0
    readonly_fields = ['joined_at']

@admin.register(SocialBowl)
class SocialBowlAdmin(admin.ModelAdmin):
    list_display = ['title', 'date', 'time', 'club', 'created_by', 'participant_count']
    list_filter = ['date', 'club']
    search_fields = ['title', 'description', 'location']
    date_hierarchy = 'date'
    inlines = [SocialBowlParticipantInline]
    
    def participant_count(self, obj):
        return obj.participants.count()
    participant_count.short_description = 'Participants'

@admin.register(SocialBowlParticipant)
class SocialBowlParticipantAdmin(admin.ModelAdmin):
    list_display = ['user', 'social_bowl', 'joined_at']
    list_filter = ['joined_at', 'social_bowl__club']
    search_fields = ['user__username', 'user__email', 'social_bowl__title']
    raw_id_fields = ['user', 'social_bowl']
