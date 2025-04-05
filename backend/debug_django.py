#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
from pathlib import Path

# Print the current working directory and sys.path
print(f"Current working directory: {os.getcwd()}")
print(f"Python path: {sys.path}")

# Print environment variables
print("\nEnvironment variables:")
print(f"DEPLOYMENT_MODE: {os.environ.get('DEPLOYMENT_MODE')}")
print(f"POSTGRES_DB: {os.environ.get('POSTGRES_DB')}")
print(f"POSTGRES_USER: {os.environ.get('POSTGRES_USER')}")
print(f"POSTGRES_HOST: {os.environ.get('POSTGRES_HOST')}")
print(f"POSTGRES_PORT: {os.environ.get('POSTGRES_PORT')}")

# Check for .env files
base_dir = Path(__file__).resolve().parent
env_local = base_dir / '.env.local'
env_file = base_dir / '.env'

print("\nEnvironment files:")
print(f".env.local exists: {env_local.exists()}")
print(f".env exists: {env_file.exists()}")

def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed?"
        ) from exc
    
    # Try to load Django settings to check database configuration
    try:
        from config.settings import DATABASES, DEPLOYMENT_MODE
        
        print("\nDjango settings after initialization:")
        print(f"DEPLOYMENT_MODE: {DEPLOYMENT_MODE}")
        print(f"Database name: {DATABASES['default']['NAME']}")
        print(f"Database user: {DATABASES['default']['USER']}")
        print(f"Database host: {DATABASES['default']['HOST']}")
        print(f"Database port: {DATABASES['default']['PORT']}")
    except Exception as e:
        print(f"Error loading Django settings: {e}")
    
    # Now try database connection directly
    try:
        import psycopg2
        conn_params = {
            'dbname': DATABASES['default']['NAME'],
            'user': DATABASES['default']['USER'],
            'password': DATABASES['default']['PASSWORD'],
            'host': DATABASES['default']['HOST'],
            'port': DATABASES['default']['PORT'],
        }
        print(f"\nTrying to connect with: {conn_params}")
        conn = psycopg2.connect(**conn_params)
        print("Connection successful!")
        conn.close()
    except Exception as e:
        print(f"Database connection error: {e}")

if __name__ == '__main__':
    main()