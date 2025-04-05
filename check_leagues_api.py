#!/usr/bin/env python
"""
Diagnostic script to check the leagues API endpoint issue.
This script will help identify why the leagues API is returning a 500 error.
"""
import os
import sys
import django
import json

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
django.setup()

# Now import models
from django.contrib.auth.models import User
from users.models import Club, ClubUser
from leagues.models import League
from leagues.views import LeagueViewSet
from rest_framework.test import APIRequestFactory

def check_club(club_id):
    """Check if the club exists"""
    try:
        club = Club.objects.get(id=club_id)
        print(f"✅ Club {club_id} exists: {club.name}")
        return club
    except Club.DoesNotExist:
        print(f"❌ Club {club_id} does not exist!")
        return None

def check_users_for_club(club_id):
    """Check which users are members of the club"""
    club_users = ClubUser.objects.filter(club_id=club_id)
    if club_users.exists():
        print(f"✅ Club {club_id} has {club_users.count()} members:")
        for cu in club_users:
            print(f"  - {cu.user.username} (admin: {cu.is_admin})")
        return club_users
    else:
        print(f"❌ Club {club_id} has no members!")
        return []
    
def check_leagues_for_club(club_id):
    """Check which leagues exist for the club"""
    leagues = League.objects.filter(club_id=club_id)
    if leagues.exists():
        print(f"✅ Club {club_id} has {leagues.count()} leagues:")
        for league in leagues:
            print(f"  - {league.name} (captain: {league.captain})")
        return leagues
    else:
        print(f"❌ Club {club_id} has no leagues!")
        return []

def simulate_api_request(club_id):
    """Simulate a request to the leagues API endpoint"""
    print(f"\n🔍 Simulating API request for club_id={club_id}...")
    factory = APIRequestFactory()
    request = factory.get(f'/api/leagues/?club_id={club_id}')
    
    # Create a user and fake authenticate
    try:
        # Try to get any user who is a member of this club
        club_user = ClubUser.objects.filter(club_id=club_id).first()
        if club_user:
            request.user = club_user.user
        else:
            # Fallback to any user
            request.user = User.objects.first()
        
        print(f"Using user: {request.user.username}")
        
        # Simulate the view
        view = LeagueViewSet.as_view({'get': 'list'})
        response = view(request)
        
        print(f"✅ API Response Status: {response.status_code}")
        try:
            print(f"Response data: {json.dumps(response.data, indent=2)}")
        except:
            print(f"Response data: {response.data}")
            
    except Exception as e:
        print(f"❌ Error simulating API request: {str(e)}")
        import traceback
        traceback.print_exc()
    
def run_diagnostics():
    """Run diagnostics for the leagues API"""
    print("🔍 Starting Leagues API Diagnostics...\n")
    
    # Check club with ID 2
    club_id = 2
    club = check_club(club_id)
    if club:
        check_users_for_club(club_id)
        check_leagues_for_club(club_id)
        simulate_api_request(club_id)
    
    # Check all clubs
    print("\n🔍 Listing all Clubs in the system:")
    clubs = Club.objects.all()
    if clubs.exists():
        for club in clubs:
            print(f"  - ID {club.id}: {club.name}")
    else:
        print("  No clubs found in the system!")
    
    # Check all users  
    print("\n🔍 Listing users with their club memberships:")
    users = User.objects.all()
    if users.exists():
        for user in users:
            club_users = ClubUser.objects.filter(user=user)
            clubs_str = ", ".join([f"{cu.club.name} (admin: {cu.is_admin})" for cu in club_users])
            print(f"  - {user.username}: {clubs_str if clubs_str else 'No club memberships'}")
    else:
        print("  No users found in the system!")
            
if __name__ == "__main__":
    run_diagnostics()