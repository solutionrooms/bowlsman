from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q
import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime
import logging
import calendar
import logging

from .models import League, LeagueMember, PlayerNameMapping, Fixture
from .serializers import (
    LeagueSerializer, LeagueDetailSerializer, LeagueMemberSerializer, 
    PlayerNameMappingSerializer, FixtureSerializer
)
from users.models import Club, ClubUser
from messaging.models import Message

logger = logging.getLogger(__name__)

# Configure logger
logger = logging.getLogger(__name__)

class IsClubAdminOrLeagueCaptainOrDeputy(permissions.BasePermission):
    """
    Permission to allow only club admins or league captains/deputies to perform actions.
    """
    def has_object_permission(self, request, view, obj):
        # Get the user
        user = request.user
        
        # If it's a League object
        if isinstance(obj, League):
            # Check if user is club admin
            is_club_admin = ClubUser.objects.filter(
                user=user, club=obj.club, is_admin=True
            ).exists()
            
            # Check if user is captain or deputy
            is_captain_or_deputy = (obj.captain == user or obj.deputy == user)
            
            return is_club_admin or is_captain_or_deputy
        
        # If it's a LeagueMember object
        elif isinstance(obj, LeagueMember):
            league = obj.league
            
            # Check if user is club admin
            is_club_admin = ClubUser.objects.filter(
                user=user, club=league.club, is_admin=True
            ).exists()
            
            # Check if user is captain or deputy
            is_captain_or_deputy = (league.captain == user or league.deputy == user)
            
            return is_club_admin or is_captain_or_deputy
        
        return False

class LeagueViewSet(viewsets.ModelViewSet):
    """
    API endpoint for leagues.
    """
    serializer_class = LeagueSerializer
    
    def get_queryset(self):
        logger.debug("LeagueViewSet.get_queryset called by %s", self.request.user)
        user = self.request.user
        
        # Filter leagues by club if club_id is provided
        club_id = self.request.query_params.get('club_id')
        queryset = League.objects.all()
        
        if club_id:
            try:
                logger.debug("Filtering leagues by club_id=%s", club_id)
                club_id = int(club_id)
                
                # Check if club exists and user has access
                club = Club.objects.filter(id=club_id).first()
                if not club:
                    logger.warning("Club with id=%s does not exist", club_id)
                    return League.objects.none()
                
                # Check if user has access to this club
                if not user.is_staff and not ClubUser.objects.filter(user=user, club=club).exists():
                    logger.warning("User %s does not have access to club %s", user.username, club_id)
                    return League.objects.none()
                
                queryset = queryset.filter(club_id=club_id)
                
            except (ValueError, TypeError) as e:
                logger.error("Invalid club_id: %s - %s", club_id, str(e))
                return League.objects.none()
            except Exception as e:
                logger.error("Unexpected error filtering leagues: %s", str(e))
                return League.objects.none()
        
        # If user is not staff, only show leagues from clubs they belong to
        if not user.is_staff:
            user_clubs = ClubUser.objects.filter(user=user).values_list('club_id', flat=True)
            logger.debug("User %s belongs to clubs: %s", user.username, list(user_clubs))
            queryset = queryset.filter(club_id__in=user_clubs)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return LeagueDetailSerializer
        return LeagueSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Only club admins can create/update/delete leagues
            return [permissions.IsAuthenticated(), IsClubAdminOrLeagueCaptainOrDeputy()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        # Ensure user has admin rights for the club
        club_id = serializer.validated_data.get('club_id')
        user = self.request.user
        
        # Check if user is admin of the club
        is_admin = ClubUser.objects.filter(
            user=user, club_id=club_id, is_admin=True
        ).exists()
        
        if not is_admin and not user.is_staff:
            raise permissions.PermissionDenied("You must be a club admin to create a league.")
        
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def update_deputy(self, request, pk=None):
        league = self.get_object()
        user = request.user
        
        # Only captain can update deputy
        if league.captain != user:
            return Response(
                {"detail": "Only the league captain can update the deputy."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        deputy_id = request.data.get('deputy_id')
        
        # Validate deputy is a member of the club
        if deputy_id:
            is_club_member = ClubUser.objects.filter(
                user_id=deputy_id, club=league.club
            ).exists()
            
            if not is_club_member:
                return Response(
                    {"detail": "Deputy must be a member of the club."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Update deputy
        league.deputy_id = deputy_id
        league.save()
        
        serializer = self.get_serializer(league)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def message_members(self, request, pk=None):
        league = self.get_object()
        user = request.user
        
        # Check if user is captain or deputy
        if league.captain != user and league.deputy != user:
            return Response(
                {"detail": "Only the league captain or deputy can message members."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get message content
        content = request.data.get('content')
        if not content:
            return Response(
                {"detail": "Message content is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all league members
        members = LeagueMember.objects.filter(league=league).select_related('user')
        
        # Send message to all members
        messages_sent = 0
        for member in members:
            if member.user != user:  # Don't send message to self
                Message.objects.create(
                    sender=user,
                    recipient=member.user,
                    content=content,
                    club=league.club
                )
                messages_sent += 1
        
        return Response({
            "detail": f"Message sent to {messages_sent} league members.",
            "messages_sent": messages_sent
        })

    @action(detail=True, methods=['get'])
    def fetch_team_members(self, request, pk=None):
        """
        Fetch team members from the team website.
        """
        league = self.get_object()
        
        # Check if team_link is provided
        if not league.team_link:
            return Response(
                {"error": "No team link provided for this league."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Fetch the team website
            response = requests.get(league.team_link)
            response.raise_for_status()
            
            # Parse the HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract player information
            # This is specific to the format of the team website
            # Example: https://www.cgleague.co.uk/archives/team.php?L=NSI&T=Westlands+A
            players = []
            
            # Find the table with player information
            # The table typically has a header with "Registered players"
            player_table = None
            for header in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5']):
                if 'registered players' in header.text.lower():
                    # Find the next table after this header
                    player_table = header.find_next('table')
                    break
            
            if not player_table:
                # Try to find any table that might contain player information
                tables = soup.find_all('table')
                for table in tables:
                    if 'name' in table.text.lower() and ('date' in table.text.lower() or 'registration' in table.text.lower()):
                        player_table = table
                        break
            
            if not player_table:
                return Response(
                    {"error": "Could not find player information on the team website."},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Extract player names from the table
            rows = player_table.find_all('tr')
            for row in rows[1:]:  # Skip header row
                cells = row.find_all('td')
                if cells and len(cells) > 0:
                    # First cell typically contains the player name
                    player_name = cells[0].text.strip()
                    if player_name and not player_name.isdigit() and player_name.lower() != "customise this table":
                        # Split name into first and last name
                        name_parts = player_name.split()
                        if len(name_parts) >= 2:
                            first_name = name_parts[0]
                            last_name = ' '.join(name_parts[1:])
                            players.append({
                                'first_name': first_name,
                                'last_name': last_name,
                                'full_name': player_name
                            })
            
            # Check for existing name mappings
            mappings = PlayerNameMapping.objects.filter(league=league)
            for player in players:
                # Check if there's a mapping for this player
                mapping = mappings.filter(
                    roster_first_name=player['first_name'],
                    roster_last_name=player['last_name']
                ).first()
                
                if mapping:
                    player['mapped_user_id'] = mapping.user.id
                    player['mapped_user_name'] = f"{mapping.user.first_name} {mapping.user.last_name}"
            
            return Response(players, status=status.HTTP_200_OK)
            
        except requests.RequestException as e:
            return Response(
                {"error": f"Failed to fetch team website: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            return Response(
                {"error": f"An error occurred while processing team data: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def create_name_mapping(self, request, pk=None):
        """
        Create a mapping between a roster name and a club member.
        """
        league = self.get_object()
        
        # Validate input
        roster_first_name = request.data.get('roster_first_name')
        roster_last_name = request.data.get('roster_last_name')
        roster_full_name = request.data.get('roster_full_name')
        user_id = request.data.get('user_id')
        
        if not all([roster_first_name, roster_last_name, roster_full_name, user_id]):
            return Response(
                {"error": "Missing required fields."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Check if mapping already exists
            existing_mapping = PlayerNameMapping.objects.filter(
                league=league,
                roster_first_name=roster_first_name,
                roster_last_name=roster_last_name
            ).first()
            
            if existing_mapping:
                # Update existing mapping
                existing_mapping.user_id = user_id
                existing_mapping.save()
                serializer = PlayerNameMappingSerializer(existing_mapping)
                return Response(serializer.data, status=status.HTTP_200_OK)
            
            # Create new mapping
            mapping = PlayerNameMapping.objects.create(
                league=league,
                roster_first_name=roster_first_name,
                roster_last_name=roster_last_name,
                roster_full_name=roster_full_name,
                user_id=user_id
            )
            
            serializer = PlayerNameMappingSerializer(mapping)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {"error": f"Failed to create name mapping: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['delete'])
    def delete_name_mapping(self, request, pk=None):
        """
        Delete a name mapping.
        """
        league = self.get_object()
        mapping_id = request.data.get('mapping_id')
        
        if not mapping_id:
            return Response(
                {"error": "Mapping ID is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            mapping = PlayerNameMapping.objects.get(id=mapping_id, league=league)
            mapping.delete()
            
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except PlayerNameMapping.DoesNotExist:
            return Response(
                {"error": "Mapping not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to delete name mapping: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['delete'])
    def remove_roster_player(self, request, pk=None):
        """
        Remove a player from the roster (by creating a mapping with null user).
        This is used to hide specific players from the roster.
        """
        league = self.get_object()
        
        # Validate input
        roster_first_name = request.data.get('roster_first_name')
        roster_last_name = request.data.get('roster_last_name')
        roster_full_name = request.data.get('roster_full_name')
        
        if not all([roster_first_name, roster_last_name, roster_full_name]):
            return Response(
                {"error": "Missing required fields."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Create a special mapping with user_id=-1 to indicate a player to be hidden
            mapping, created = PlayerNameMapping.objects.update_or_create(
                league=league,
                roster_first_name=roster_first_name,
                roster_last_name=roster_last_name,
                defaults={
                    'roster_full_name': roster_full_name,
                    'user_id': -1  # Special value to indicate a player to be hidden
                }
            )
            
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except Exception as e:
            return Response(
                {"error": f"Failed to remove player from roster: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    @action(detail=True, methods=['get'])
    def fetch_fixtures(self, request, pk=None):
        """
        Fetch fixtures from the team website.
        """
        league = self.get_object()
        
        # Check if team_link is provided
        if not league.team_link:
            return Response(
                {"error": "No team link provided for this league."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Fetch the team website
            response = requests.get(league.team_link)
            response.raise_for_status()
            
            # Parse the HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract fixture information
            fixtures = []
            
            # Find the fixture table section - common patterns include:
            # - Table with header containing "fixtures"
            # - Div with class or id containing "fixture"
            # - Header with text containing "fixture"
            
            fixture_table = None
            
            # Look for headers containing "fixtures"
            for header in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5']):
                if 'fixture' in header.text.lower():
                    # Find the next table after this header
                    fixture_table = header.find_next('table')
                    break
            
            if not fixture_table:
                # Try to find a table with fixture-related content
                for table in soup.find_all('table'):
                    if (table.text and (
                        'fixture' in table.text.lower() or 
                        'match' in table.text.lower() or
                        'opponent' in table.text.lower() or
                        'venue' in table.text.lower()
                    )):
                        fixture_table = table
                        break
            
            # Parse fixtures based on the table structure
            if fixture_table:
                rows = fixture_table.find_all('tr')
                
                for row in rows[1:]:  # Skip header row
                    cells = row.find_all('td')
                    if len(cells) < 3:  # Need at least opponent, venue, date
                        continue
                    
                    # Extract fixture information from cells
                    try:
                        # Common patterns: Opponent, Venue, Date, Time, etc.
                        # This will need to be adjusted based on the actual website structure
                        
                        # Example parsing - adjust based on actual structure
                        opponent = cells[0].text.strip()
                        venue_text = cells[1].text.strip().lower()
                        fixture_date_text = cells[2].text.strip()
                        
                        # Only proceed if we have valid data
                        if not opponent or not venue_text or not fixture_date_text:
                            continue
                            
                        # Skip header rows or empty rows
                        if any(keyword in opponent.lower() for keyword in ['opponent', 'team', 'against', 'name']):
                            continue
                            
                        # Map venue text to our choices
                        venue = 'home' if venue_text.lower() == 'home' else 'away'
                        
                        # Parse date string (adjust based on actual format)
                        # Example: "Mon 7 Apr" or "Monday 7th April 2023"
                        
                        # Try to extract date components from the string
                        date_match = re.search(r'(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*(\d+)(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', fixture_date_text, re.IGNORECASE)
                        
                        if date_match:
                            day = int(date_match.group(1))
                            month_name = date_match.group(2).capitalize()
                            month = list(calendar.month_abbr).index(month_name[:3])
                            
                            # Determine year (assume current year or next year if month already passed)
                            current_date = datetime.now()
                            year = current_date.year
                            if month < current_date.month:
                                year += 1
                                
                            fixture_date = datetime(year, month, day).date()
                            
                            fixtures.append({
                                'opponent': opponent,
                                'venue': venue,
                                'fixture_date': fixture_date.isoformat(),
                            })
                    except Exception as e:
                        print(f"Error parsing fixture row: {e}")
                        continue
            
            # If no fixtures found, try an alternative approach
            if not fixtures:
                # Look for content with fixture-like data
                fixture_text = ''
                for p in soup.find_all('p'):
                    if 'fixture' in p.text.lower() or 'match' in p.text.lower():
                        fixture_text += p.text + '\n'
                
                # Try to parse fixture data from text using regex
                if fixture_text:
                    fixture_pattern = re.compile(
                        r'([\w\s]+)\s+(?:vs\.?|v\.?)\s+([\w\s]+)\s+(?:on|at|date:?)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))',
                        re.IGNORECASE
                    )
                    
                    for match in fixture_pattern.finditer(fixture_text):
                        team1 = match.group(1).strip()
                        team2 = match.group(2).strip()
                        date_str = match.group(3).strip()
                        
                        # Determine if home or away based on team names
                        if league.name.lower() in team1.lower():
                            opponent = team2
                            venue = 'home'
                        else:
                            opponent = team1
                            venue = 'away'
                        
                        # Parse date
                        try:
                            date_match = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', date_str, re.IGNORECASE)
                            if date_match:
                                day = int(date_match.group(1))
                                month_name = date_match.group(2).capitalize()
                                month = list(calendar.month_abbr).index(month_name[:3])
                                
                                # Determine year
                                current_date = datetime.now()
                                year = current_date.year
                                if month < current_date.month:
                                    year += 1
                                    
                                fixture_date = datetime(year, month, day).date()
                                
                                fixtures.append({
                                    'opponent': opponent,
                                    'venue': venue,
                                    'fixture_date': fixture_date.isoformat(),
                                })
                        except Exception as e:
                            print(f"Error parsing fixture date: {e}")
                            continue
            
            # If still no fixtures found, try directly parsing the image provided (parse HTML as shown in image)
            if not fixtures and request.query_params.get('manual_import'):
                # This is a fallback for manually importing fixtures from the image provided
                fixture_data = request.data.get('fixture_data', [])
                for fixture in fixture_data:
                    opponent = fixture.get('opponent')
                    venue = fixture.get('venue', '').lower()
                    date_str = fixture.get('date')
                    
                    if not opponent or not venue or not date_str:
                        continue
                    
                    venue = 'home' if venue == 'home' else 'away'
                    
                    try:
                        # Parse date in format like "Mon 7 Apr"
                        date_parts = date_str.split()
                        if len(date_parts) >= 3:
                            day = int(date_parts[1])
                            month_name = date_parts[2]
                            month = list(calendar.month_abbr).index(month_name[:3])
                            
                            # Determine year
                            current_date = datetime.now()
                            year = current_date.year
                            if month < current_date.month:
                                year += 1
                                
                            fixture_date = datetime(year, month, day).date()
                            
                            fixtures.append({
                                'opponent': opponent,
                                'venue': venue,
                                'fixture_date': fixture_date.isoformat(),
                            })
                    except Exception as e:
                        print(f"Error parsing manual fixture: {e}")
                        continue
            
            return Response(fixtures, status=status.HTTP_200_OK)
            
        except requests.RequestException as e:
            return Response(
                {"error": f"Failed to fetch team website: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            return Response(
                {"error": f"An error occurred while processing fixtures: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    @action(detail=True, methods=['post'])
    def import_fixtures(self, request, pk=None):
        """
        Import fixtures from provided data.
        """
        league = self.get_object()
        fixtures_data = request.data.get('fixtures', [])
        
        if not fixtures_data:
            return Response(
                {"error": "No fixture data provided."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        created_count = 0
        updated_count = 0
        error_count = 0
        results = []
        
        for fixture_data in fixtures_data:
            try:
                # Required fields
                opponent = fixture_data.get('opponent')
                venue = fixture_data.get('venue', '').lower()
                fixture_date = fixture_data.get('fixture_date')
                
                # Optional fields
                for_score = fixture_data.get('for_score')
                against_score = fixture_data.get('against_score')
                
                if not all([opponent, venue, fixture_date]):
                    results.append({
                        'status': 'error',
                        'fixture': fixture_data,
                        'message': 'Missing required fields'
                    })
                    error_count += 1
                    continue
                
                # Standardize venue value
                venue = 'home' if venue == 'home' else 'away'
                
                # Convert date string to date object if needed
                if isinstance(fixture_date, str):
                    try:
                        fixture_date = datetime.fromisoformat(fixture_date).date()
                    except ValueError:
                        results.append({
                            'status': 'error',
                            'fixture': fixture_data,
                            'message': f'Invalid date format: {fixture_date}'
                        })
                        error_count += 1
                        continue
                
                # Try to update existing fixture or create new one
                fixture, created = Fixture.objects.update_or_create(
                    league=league,
                    opponent=opponent,
                    fixture_date=fixture_date,
                    defaults={
                        'venue': venue,
                        'for_score': for_score,
                        'against_score': against_score
                    }
                )
                
                if created:
                    created_count += 1
                    results.append({
                        'status': 'created',
                        'fixture': FixtureSerializer(fixture).data
                    })
                else:
                    updated_count += 1
                    results.append({
                        'status': 'updated',
                        'fixture': FixtureSerializer(fixture).data
                    })
                    
            except Exception as e:
                results.append({
                    'status': 'error',
                    'fixture': fixture_data,
                    'message': str(e)
                })
                error_count += 1
                
        return Response({
            'created': created_count,
            'updated': updated_count,
            'errors': error_count,
            'results': results
        }, status=status.HTTP_200_OK)

class FixtureViewSet(viewsets.ModelViewSet):
    """
    API endpoint for league fixtures.
    """
    serializer_class = FixtureSerializer
    
    def get_queryset(self):
        logger.debug("LeagueViewSet.get_queryset called by %s", self.request.user)        # Filter by league if league_id is provided
        league_id = self.request.query_params.get('league_id')
        upcoming_only = self.request.query_params.get('upcoming_only') == 'true'
        queryset = Fixture.objects.all()
        
        if league_id:
            queryset = queryset.filter(league_id=league_id)
        
        # If user is not staff, only show fixtures from leagues in clubs they belong to
        user = self.request.user
        if not user.is_staff:
            user_clubs = ClubUser.objects.filter(user=user).values_list('club_id', flat=True)
            queryset = queryset.filter(league__club_id__in=user_clubs)
        
        # Filter for upcoming fixtures if requested
        if upcoming_only:
            from datetime import date
            today = date.today()
            queryset = queryset.filter(fixture_date__gte=today)
        
        return queryset.order_by('fixture_date')
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Only club admins or league captains/deputies can manage fixtures
            return [permissions.IsAuthenticated(), IsClubAdminOrLeagueCaptainOrDeputy()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        league_id = serializer.validated_data.get('league').id
        
        # Get the league
        league = get_object_or_404(League, id=league_id)
        
        # Check permissions
        request_user = self.request.user
        
        # Check if user is club admin
        is_club_admin = ClubUser.objects.filter(
            user=request_user, club=league.club, is_admin=True
        ).exists()
        
        # Check if user is captain or deputy
        is_captain_or_deputy = (league.captain == request_user or league.deputy == request_user)
        
        if not (is_club_admin or is_captain_or_deputy):
            raise permissions.PermissionDenied(
                "Only club admins or league captains/deputies can add fixtures."
            )
        
        serializer.save()

class LeagueMemberViewSet(viewsets.ModelViewSet):
    """
    API endpoint for league members.
    """
    serializer_class = LeagueMemberSerializer
    
    def get_queryset(self):
        logger.debug("LeagueViewSet.get_queryset called by %s", self.request.user)        # Filter by league if league_id is provided
        league_id = self.request.query_params.get('league_id')
        queryset = LeagueMember.objects.all()
        
        if league_id:
            queryset = queryset.filter(league_id=league_id)
        
        # If user is not staff, only show members from leagues in clubs they belong to
        user = self.request.user
        if not user.is_staff:
            user_clubs = ClubUser.objects.filter(user=user).values_list('club_id', flat=True)
            queryset = queryset.filter(league__club_id__in=user_clubs)
        
        return queryset
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Only club admins or league captains/deputies can manage members
            return [permissions.IsAuthenticated(), IsClubAdminOrLeagueCaptainOrDeputy()]
        return [permissions.IsAuthenticated()]
    
    def perform_create(self, serializer):
        league_id = serializer.validated_data.get('league').id
        user_id = serializer.validated_data.get('user_id')
        
        # Get the league
        league = get_object_or_404(League, id=league_id)
        
        # Check permissions
        request_user = self.request.user
        
        # Check if user is club admin
        is_club_admin = ClubUser.objects.filter(
            user=request_user, club=league.club, is_admin=True
        ).exists()
        
        # Check if user is captain or deputy
        is_captain_or_deputy = (league.captain == request_user or league.deputy == request_user)
        
        if not (is_club_admin or is_captain_or_deputy):
            raise permissions.PermissionDenied(
                "Only club admins or league captains/deputies can add members."
            )
        
        # Check if the user to be added is a member of the club
        is_club_member = ClubUser.objects.filter(
            user_id=user_id, club=league.club
        ).exists()
        
        if not is_club_member:
            raise serializers.ValidationError(
                {"user_id": "User must be a member of the club."}
            )
        
        serializer.save() 