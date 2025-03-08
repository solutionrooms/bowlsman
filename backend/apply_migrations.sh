#!/bin/bash

# Activate the virtual environment if needed
# source venv/bin/activate

# Apply migrations
echo "Applying migrations..."
python manage.py migrate

echo "Migrations applied successfully!" 