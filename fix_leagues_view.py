#!/usr/bin/env python
"""
Script to fix the league views error by improving error handling
and adding debug logging.
"""
import os
import sys
import fileinput
import re
from shutil import copyfile

BACKEND_DIR = os.path.join(os.path.dirname(__file__), 'backend')
VIEWS_PATH = os.path.join(BACKEND_DIR, 'leagues', 'views.py')
BACKUP_PATH = os.path.join(BACKEND_DIR, 'leagues', 'views.py.bak')

def add_debug_logging():
    """Add debug logging to the LeagueViewSet class to trace errors"""
    changes_made = False
    
    # Backup the original file
    copyfile(VIEWS_PATH, BACKUP_PATH)
    print(f"✅ Created backup of views.py at {BACKUP_PATH}")
    
    with fileinput.FileInput(VIEWS_PATH, inplace=True) as file:
        in_get_queryset = False
        for line in file:
            # Add the import if needed
            if line.strip() == 'from datetime import datetime':
                print(line, end='')
                print('import logging\n', end='')
                changes_made = True
                continue
                
            # Add logger declaration after imports
            if line.strip() == 'from messaging.models import Message':
                print(line, end='')
                print('\nlogger = logging.getLogger(__name__)\n', end='')
                changes_made = True
                continue
                
            # Detect the start of get_queryset method
            if line.strip() == 'def get_queryset(self):':
                in_get_queryset = True
                print(line, end='')
                print('        logger.debug("LeagueViewSet.get_queryset called by %s", self.request.user)', end='')
                changes_made = True
                continue
                
            # Add error handling to the club_id filter
            if in_get_queryset and 'if club_id:' in line:
                in_get_queryset = False  # Reset flag
                # Add error handling
                print(f"""        # Filter leagues by club if club_id is provided
        club_id = self.request.query_params.get('club_id')
        queryset = League.objects.all()
        
        if club_id:
            try:
                logger.debug("Filtering leagues by club_id=%s", club_id)
                club_id = int(club_id)
                # Check if club exists
                from users.models import Club
                if not Club.objects.filter(id=club_id).exists():
                    logger.warning("Club with id=%s does not exist", club_id)
                    return League.objects.none()
                queryset = queryset.filter(club_id=club_id)
            except (ValueError, TypeError) as e:
                logger.error("Invalid club_id: %s - %s", club_id, str(e))
                return League.objects.none()""", end='')
                changes_made = True
                continue
            
            # Normal line with no changes
            print(line, end='')
    
    if changes_made:
        print("✅ Updated leagues/views.py with improved error handling and logging")
    else:
        print("❌ No changes were made to leagues/views.py")
        # Restore backup
        copyfile(BACKUP_PATH, VIEWS_PATH)
        print("✅ Restored original file from backup")

if __name__ == "__main__":
    add_debug_logging()
    print("\nTo test the fix:")
    print("1. Restart the Django server")
    print("2. Navigate to http://localhost:3000/leagues in your browser")
    print("3. Check the Django server logs for any error messages")