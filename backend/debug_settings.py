import os
import sys
from pathlib import Path

# This script will print details about the database configuration

# Setup to load the Django settings
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Print environment variables
print("Environment variables:")
print(f"DEPLOYMENT_MODE: {os.environ.get('DEPLOYMENT_MODE')}")
print(f"POSTGRES_DB: {os.environ.get('POSTGRES_DB')}")
print(f"POSTGRES_USER: {os.environ.get('POSTGRES_USER')}")
print(f"POSTGRES_HOST: {os.environ.get('POSTGRES_HOST')}")
print(f"POSTGRES_PORT: {os.environ.get('POSTGRES_PORT')}")

# Try to load the Django settings
try:
    from config.settings import DATABASES, DEPLOYMENT_MODE
    
    print("\nDjango settings:")
    print(f"DEPLOYMENT_MODE: {DEPLOYMENT_MODE}")
    print(f"Database name: {DATABASES['default']['NAME']}")
    print(f"Database user: {DATABASES['default']['USER']}")
    print(f"Database host: {DATABASES['default']['HOST']}")
    print(f"Database port: {DATABASES['default']['PORT']}")
except Exception as e:
    print(f"Error loading Django settings: {e}")