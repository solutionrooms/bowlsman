#!/bin/bash

# Wait for postgres with credentials
PGPASSWORD=postgres ./wait-for-it.sh bowlsman-postgres -t 60

# Run migrations
python manage.py migrate

# Start server
python manage.py runserver 0.0.0.0:8000 