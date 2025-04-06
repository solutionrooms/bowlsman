from rest_framework import serializers
from .models import League, LeagueMember, PlayerNameMapping, Fixture, PlayerAvailability, PlayerSelection, DefaultAvailability
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

class FixtureSerializer(serializers.ModelSerializer):
    is_upcoming = serializers.BooleanField(read_only=True)
    is_completed = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Fixture
        fields = [
            'id', 'league', 'opponent', 'venue', 'fixture_date',
            'for_score', 'against_score', 'created_at', 'updated_at',
            'is_upcoming', 'is_completed'
        ]
        read_only_fields = ['created_at', 'updated_at']


class FixtureDetailSerializer(FixtureSerializer):
    player_availabilities = serializers.SerializerMethodField()
    player_selections = serializers.SerializerMethodField()
    
    class Meta(FixtureSerializer.Meta):
        fields = FixtureSerializer.Meta.fields + ['player_availabilities', 'player_selections']
    
    def get_player_availabilities(self, obj):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user') or not request.user.is_authenticated:
            return None
            
        # Check if user is captain/deputy of the league or club admin
        is_team_manager = False
        league = obj.league
        if league.captain == request.user or league.deputy == request.user:
            is_team_manager = True
        else:
            # Check if user is club admin
            user_club_role = request.user.club_memberships.filter(club=league.club).first()
            if user_club_role and user_club_role.is_admin:
                is_team_manager = True
        
        if is_team_manager:
            # Return all availabilities for captain/deputy
            availabilities = obj.player_availabilities.all()
            return PlayerAvailabilitySerializer(availabilities, many=True).data
        else:
            # Return only current user's availability
            availability = obj.player_availabilities.filter(player=request.user).first()
            if availability:
                return [PlayerAvailabilitySerializer(availability).data]
            return []
            
    def get_player_selections(self, obj):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user') or not request.user.is_authenticated:
            return None
            
        # Check if user is captain/deputy of the league or club admin
        is_team_manager = False
        league = obj.league
        if league.captain == request.user or league.deputy == request.user:
            is_team_manager = True
        else:
            # Check if user is club admin
            user_club_role = request.user.club_memberships.filter(club=league.club).first()
            if user_club_role and user_club_role.is_admin:
                is_team_manager = True
        
        if is_team_manager:
            # Return all selections for captain/deputy
            selections = obj.player_selections.all()
            return PlayerSelectionSerializer(selections, many=True).data
        return None

class LeagueSerializer(serializers.ModelSerializer):
    club = ClubSerializer(read_only=True)
    club_id = serializers.IntegerField(write_only=True)
    captain = UserSerializer(read_only=True)
    captain_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    deputy = UserSerializer(read_only=True)
    deputy_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    members_count = serializers.SerializerMethodField()
    upcoming_fixtures_count = serializers.SerializerMethodField()
    
    class Meta:
        model = League
        fields = [
            'id', 'name', 'club', 'club_id', 'season', 
            'captain', 'captain_id', 'deputy', 'deputy_id',
            'league_table_link', 'team_link',
            'created_at', 'updated_at', 'members_count', 'upcoming_fixtures_count'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_members_count(self, obj):
        return obj.members.count()
    
    def get_upcoming_fixtures_count(self, obj):
        from datetime import date
        return obj.fixtures.filter(fixture_date__gte=date.today()).count()

class LeagueDetailSerializer(LeagueSerializer):
    members = serializers.SerializerMethodField()
    name_mappings = serializers.SerializerMethodField()
    upcoming_fixtures = serializers.SerializerMethodField()
    
    class Meta(LeagueSerializer.Meta):
        fields = LeagueSerializer.Meta.fields + ['members', 'name_mappings', 'upcoming_fixtures']
    
    def get_members(self, obj):
        members = obj.members.all()
        return LeagueMemberSerializer(members, many=True).data
    
    def get_name_mappings(self, obj):
        mappings = obj.name_mappings.all()
        return PlayerNameMappingSerializer(mappings, many=True).data
    
    def get_upcoming_fixtures(self, obj):
        from datetime import date
        fixtures = obj.fixtures.filter(fixture_date__gte=date.today()).order_by('fixture_date')
        
        # Use the FixtureDetailSerializer for more information
        request = self.context.get('request')
        context = {'request': request} if request else {}
        return FixtureDetailSerializer(fixtures, many=True, context=context).data

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


class PlayerAvailabilitySerializer(serializers.ModelSerializer):
    player = UserSerializer(read_only=True)
    player_id = serializers.IntegerField(write_only=True)
    availability_display = serializers.CharField(source='get_availability_display', read_only=True)
    
    class Meta:
        model = PlayerAvailability
        fields = [
            'id', 'fixture', 'player', 'player_id', 'availability', 
            'availability_display', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class PlayerSelectionSerializer(serializers.ModelSerializer):
    player = UserSerializer(read_only=True)
    player_id = serializers.IntegerField(write_only=True)
    player_name = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = PlayerSelection
        fields = [
            'id', 'fixture', 'player', 'player_id', 'player_name',
            'is_selected', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        
    def get_player_name(self, obj):
        if obj.player:
            return f"{obj.player.first_name} {obj.player.last_name}"
        return ""


class DefaultAvailabilitySerializer(serializers.ModelSerializer):
    player = UserSerializer(read_only=True)
    player_id = serializers.IntegerField(write_only=True)
    availability_display = serializers.CharField(source='get_availability_display', read_only=True)
    
    class Meta:
        model = DefaultAvailability
        fields = [
            'id', 'league', 'player', 'player_id', 'availability', 
            'availability_display', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at'] 