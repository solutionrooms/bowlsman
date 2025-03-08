from rest_framework import serializers
from .models import League, LeagueMember
from users.serializers import UserSerializer, ClubSerializer

class LeagueMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = LeagueMember
        fields = ['id', 'user', 'user_id', 'league', 'joined_at']
        read_only_fields = ['joined_at']
        extra_kwargs = {
            'league': {'write_only': True}
        }

class LeagueSerializer(serializers.ModelSerializer):
    club = ClubSerializer(read_only=True)
    club_id = serializers.IntegerField(write_only=True)
    captain = UserSerializer(read_only=True)
    captain_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    deputy = UserSerializer(read_only=True)
    deputy_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    members_count = serializers.SerializerMethodField()
    
    class Meta:
        model = League
        fields = [
            'id', 'name', 'club', 'club_id', 'season', 
            'captain', 'captain_id', 'deputy', 'deputy_id',
            'created_at', 'updated_at', 'members_count'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_members_count(self, obj):
        return obj.members.count()

class LeagueDetailSerializer(LeagueSerializer):
    members = serializers.SerializerMethodField()
    
    class Meta(LeagueSerializer.Meta):
        fields = LeagueSerializer.Meta.fields + ['members']
    
    def get_members(self, obj):
        members = obj.members.all()
        return LeagueMemberSerializer(members, many=True).data 