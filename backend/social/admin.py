from django.contrib import admin
from .models import SocialBowl, SocialBowlParticipant, NoticeImage

class SocialBowlParticipantInline(admin.TabularInline):
    model = SocialBowlParticipant
    extra = 0
    readonly_fields = ['joined_at']

class NoticeImageInline(admin.TabularInline):
    model = NoticeImage
    extra = 1
    fields = ['image', 'order']

@admin.register(SocialBowl)
class SocialBowlAdmin(admin.ModelAdmin):
    list_display = ('title', 'notice_type', 'club', 'created_by', 'created_at')
    list_filter = ('notice_type', 'club', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [NoticeImageInline, SocialBowlParticipantInline]

@admin.register(SocialBowlParticipant)
class SocialBowlParticipantAdmin(admin.ModelAdmin):
    list_display = ('user', 'social_bowl', 'joined_at')
    list_filter = ('social_bowl__notice_type', 'joined_at')
    search_fields = ('user__username', 'social_bowl__title')

@admin.register(NoticeImage)
class NoticeImageAdmin(admin.ModelAdmin):
    list_display = ('notice', 'order', 'created_at')
    list_filter = ('notice__club', 'created_at')
    search_fields = ('notice__title',)
    ordering = ('notice', 'order', 'created_at')
