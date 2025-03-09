#!/bin/bash

# Wait for postgres with credentials
PGPASSWORD=postgres ./wait-for-it.sh bowlshub-postgres -t 60

# Run migrations
python manage.py migrate
python manage.py collectstatic --noinput

# Start server
gunicorn config.wsgi:application --bind 0.0.0.0:8000 