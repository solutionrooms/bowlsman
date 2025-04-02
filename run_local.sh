#!/bin/bash

# Script to run the Bowlsman project in local development mode
# This version uses a locally installed PostgreSQL instance 

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to check if PostgreSQL is running locally
check_postgres() {
  echo "Checking PostgreSQL connection..."
  pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1
  return $?
}

# Function to check if tmux is installed
check_tmux() {
  if ! command -v tmux &> /dev/null; then
    echo "tmux is not installed. Please install it first:"
    echo "On macOS: brew install tmux"
    echo "On Ubuntu/Debian: sudo apt-get install tmux"
    exit 1
  fi
}

# Function to check if conda is available
check_conda() {
  # First try conda command
  if command -v conda &> /dev/null; then
    return 0
  fi

  # Check for common conda installation locations
  local conda_paths=(
    "$HOME/anaconda3/bin/conda"
    "$HOME/miniconda3/bin/conda"
    "/usr/local/anaconda3/bin/conda"
    "/usr/local/miniconda3/bin/conda"
  )

  for conda_path in "${conda_paths[@]}"; do
    if [[ -f "$conda_path" ]]; then
      echo "Found conda at $conda_path"
      eval "$("$conda_path" shell.bash hook)"
      return 0
    fi
  done

  echo "ERROR: conda not found. Please ensure conda is installed and in your PATH"
  exit 1
}

# Kill existing tmux session if it exists
cleanup_tmux() {
  tmux kill-session -t bowlsman 2>/dev/null
}

# Create a new tmux session and run a command in it
run_in_tmux() {
  local window_name=$1
  shift
  local command="cd ${SCRIPT_DIR} && $*"
  
  if ! tmux has-session -t bowlsman 2>/dev/null; then
    # Create the first window with a shell
    tmux new-session -d -s bowlsman -n "$window_name"
    tmux send-keys -t bowlsman:0 "$command" Enter
  else
    # Create additional windows
    tmux new-window -t bowlsman -n "$window_name"
    tmux send-keys -t bowlsman:"$window_name" "$command" Enter
  fi
}

# Run backend with conda environment
run_backend() {
  # Initialize conda
  check_conda
  
  # Construct the backend command with conda activation
  local conda_cmd="conda activate bowlshub && cd backend && python manage.py migrate && python manage.py runserver 0.0.0.0:8000"
  
  # Run in tmux
  if ! tmux has-session -t bowlsman 2>/dev/null; then
    tmux new-session -d -s bowlsman -n "backend"
    tmux send-keys -t bowlsman:0 "$conda_cmd" Enter
  else
    tmux new-window -t bowlsman -n "backend"
    tmux send-keys -t bowlsman:"backend" "$conda_cmd" Enter
  fi
}

# Verify PostgreSQL is running locally
if ! check_postgres; then
  echo "ERROR: Local PostgreSQL instance is not running."
  echo "Please start your PostgreSQL service and try again."
  exit 1
fi

# Check if tmux is installed
check_tmux

# Check if database exists, create if it doesn't
DB_NAME="bowlsman_local"
if ! psql -h localhost -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo "Creating database $DB_NAME..."
  psql -h localhost -U postgres -c "CREATE DATABASE $DB_NAME;" || {
    echo "Failed to create database. Please check your PostgreSQL installation."
    exit 1
  }
fi

# Ask user which components to start
echo "Which components would you like to start?"
echo "1. Frontend only"
echo "2. Backend only"
echo "3. Both frontend and backend"
read -p "Enter your choice (1-3): " choice

# Clean up any existing tmux session
cleanup_tmux

case $choice in
  1)
    echo "Starting frontend..."
    run_in_tmux "frontend" "cd frontend && npm run dev"
    ;;
  2)
    echo "Starting backend..."
    (cd backend && cp -n .env.local .env)
    run_backend
    ;;
  3)
    echo "Starting both frontend and backend..."
    (cd backend && cp -n .env.local .env)
    run_backend
    run_in_tmux "frontend" "cd frontend && npm run dev"
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

# Automatically attach to the tmux session
echo ""
echo "Attaching to tmux session 'bowlsman'"
echo "Use these commands to navigate:"
echo "  Ctrl+B then N              - Switch to next window"
echo "  Ctrl+B then P              - Switch to previous window"
echo "  Ctrl+B then D              - Detach from tmux session"
echo "  tmux kill-session -t bowlsman  - Kill all services when done"
echo ""
echo "Attaching to session in 3 seconds..."
sleep 3
exec tmux attach -t bowlsman