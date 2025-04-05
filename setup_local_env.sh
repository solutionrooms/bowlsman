#!/bin/bash

# Script to set up a local development environment for the Bowlsman project
# This version uses a locally installed PostgreSQL instance

echo "Setting up local development environment for Bowlsman..."

# Create Docker shared network if it doesn't exist (still needed for Docker mode)
if ! docker network inspect shared_network >/dev/null 2>&1; then
  echo "Creating shared_network in Docker..."
  docker network create shared_network
fi

# Check for PostgreSQL
if ! command -v psql &> /dev/null; then
  echo "PostgreSQL is required but not found. Please install PostgreSQL and try again."
  exit 1
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
  echo "Python 3 is required but not found. Please install Python 3 and try again."
  exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "Node.js is required but not found. Please install Node.js and try again."
  exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
  echo "npm is required but not found. Please install npm and try again."
  exit 1
fi

# Verify PostgreSQL is running
echo "Checking PostgreSQL connection..."
if ! pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
  echo "ERROR: Local PostgreSQL instance is not running or not accessible."
  echo "Please start your PostgreSQL service and try again."
  exit 1
fi

# Check if database exists, create if it doesn't
DB_NAME="bowlsman_local"
if ! psql -h localhost -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo "Creating database $DB_NAME..."
  psql -h localhost -U postgres -c "CREATE DATABASE $DB_NAME;" || {
    echo "Failed to create database. Please check your PostgreSQL installation."
    exit 1
  }
fi

echo "Setting up local Python environment..."


# Install Python dependencies
echo "Installing Python dependencies..."
python3 -m pip install -r requirements-local.txt

echo "Setting up environment files..."

# Create root .env file if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file in root directory"
fi

# Create .env.local for local development
cat > .env.local << EOL
DEPLOYMENT_MODE=local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8000/ws
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bowlsman
EOL
echo "Created .env.local file in root directory"

# Create .env.docker for Docker development
cat > .env.docker << EOL
DEPLOYMENT_MODE=docker
NEXT_PUBLIC_API_URL=http://localhost:8010
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8010/ws
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend
DATABASE_URL=postgres://postgres:postgres@db:5432/bowlsman
EOL
echo "Created .env.docker file in root directory"

# Remove old environment files
rm -f frontend/.env frontend/.env.local frontend/.env.docker backend/.env backend/.env.local backend/.env.docker 2>/dev/null

# Create symlinks for frontend and backend
ln -sf ../.env frontend/.env
ln -sf ../.env backend/.env

echo "Environment files setup complete"

# Navigate to frontend directory and install npm dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

#  initial database migrations
echo "Running initial database migrations..."
cd backend
python manage.py migrate
cd ..

echo "-----------------------------------"
echo "Local development environment setup complete!"
echo "-----------------------------------"
echo "To run the application in local mode:"
echo "1. ./run_local.sh"
echo ""
echo "To run the application in Docker mode:"
echo "2. ./run_docker.sh"
echo "-----------------------------------"
echo "If using a virtual environment, remember to activate it with:"
echo "source venv/bin/activate (Linux/macOS)"
echo "or"
echo "venv\\Scripts\\activate (Windows)"
echo "-----------------------------------"