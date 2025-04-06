#!/bin/bash

# Script to run the Bowlsman project in Docker mode

# Set up environment
echo "Setting up environment for Docker development..."
cp -f .env.docker .env
ln -sf ../.env frontend/.env
ln -sf ../.env backend/.env

# Set environment variables for Docker
export DEPLOYMENT_MODE=docker
export POSTGRES_DB=webapp2
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_HOST=bowlshub-postgres
export NEXT_PUBLIC_API_URL=http://localhost:8010

# Ensure Docker network exists
if ! docker network inspect shared_network >/dev/null 2>&1; then
  echo "Creating shared_network in Docker..."
  docker network create shared_network
fi

# Kill any running containers from this project
echo "Stopping any existing containers..."
docker compose down

# Clean up any old volumes if needed
echo "Do you want to clean up old database data? (y/N)"
read -r clean_volumes
if [[ "$clean_volumes" =~ ^[Yy]$ ]]; then
    echo "Removing old volumes..."
    docker volume rm bowlsman_postgres_data bowlsman_media_data 2>/dev/null || true
fi

# Build and start the containers
echo "Building and starting Docker containers..."
docker compose up --build

# Note: Use Ctrl+C to stop all containers