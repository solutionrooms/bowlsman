from rest_framework import serializers
from .models import League, LeagueMember, PlayerNameMapping
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
            'league_table_link', 'team_link',
            'created_at', 'updated_at', 'members_count'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_members_count(self, obj):
        return obj.members.count()

class LeagueDetailSerializer(LeagueSerializer):
    members = serializers.SerializerMethodField()
    name_mappings = serializers.SerializerMethodField()
    
    class Meta(LeagueSerializer.Meta):
        fields = LeagueSerializer.Meta.fields + ['members', 'name_mappings']
    
    def get_members(self, obj):
        members = obj.members.all()
        return LeagueMemberSerializer(members, many=True).data
    
    def get_name_mappings(self, obj):
        mappings = obj.name_mappings.all()
        return PlayerNameMappingSerializer(mappings, many=True).data

class PlayerNameMappingSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = PlayerNameMapping
        fields = ['id', 'league', 'roster_first_name', 'roster_last_name', 'roster_full_name', 'user', 'user_id', 'created_at']
        read_only_fields = ['created_at']
        extra_kwargs = {
            'league': {'write_only': True}
        } 