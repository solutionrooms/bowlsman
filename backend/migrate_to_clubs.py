#!/usr/bin/env python
import os
import sys
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from users.models import Club, ClubUser, Competition

User = get_user_model()

def migrate_to_clubs():
    """
    Migrate all existing data to a new club named 'The Westlands'.
    This script should be run after the Club and ClubUser models have been created
    and before any new clubs are added.
    """
    print("Starting migration to club-based structure...")
    
    try:
        with transaction.atomic():
            # Get or create the default club
            default_club, created = Club.objects.get_or_create(
                name="The Westlands",
                defaults={
                    "address": "123 Main St, Anytown, USA",
                    "created_at": timezone.now()
                }
            )
            
            if created:
                print(f"Created default club: {default_club.name}")
            else:
                print(f"Using existing club: {default_club.name}")
            
            # Get all existing users who are not yet club members
            existing_club_user_ids = ClubUser.objects.filter(club=default_club).values_list('user_id', flat=True)
            users_to_add = User.objects.exclude(id__in=existing_club_user_ids)
            print(f"Found {users_to_add.count()} users to add to club")
            
            # Create club memberships for users not already in the club
            if users_to_add.exists():
                club_users = []
                for user in users_to_add:
                    club_user = ClubUser(
                        user=user,
                        club=default_club,
                        is_admin=user.is_staff,  # Make staff users admins of the club
                        last_login_at=user.last_login
                    )
                    club_users.append(club_user)
                
                # Bulk create club users
                ClubUser.objects.bulk_create(club_users)
                print(f"Created {len(club_users)} club memberships")
            
            # Update competitions without a club
            competitions_updated = Competition.objects.filter(club__isnull=True).update(club=default_club)
            print(f"Updated {competitions_updated} competitions")
            
            print("Migration completed successfully!")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = migrate_to_clubs()
    sys.exit(0 if success else 1) 