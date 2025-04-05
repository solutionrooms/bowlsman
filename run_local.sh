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

# Setup log directories
setup_logs() {
  # Create log directories if they don't exist
  mkdir -p "${SCRIPT_DIR}/backend"
  mkdir -p "${SCRIPT_DIR}/frontend"
  
  # Create or truncate log files with proper permissions
  touch "${SCRIPT_DIR}/backend/backend_local.log"
  touch "${SCRIPT_DIR}/frontend/frontend_local.log"
  
  # Set permissions (readable/writable by user and group)
  chmod 664 "${SCRIPT_DIR}/backend/backend_local.log"
  chmod 664 "${SCRIPT_DIR}/frontend/frontend_local.log"
}

# Kill existing tmux sessions and processes
cleanup_tmux() {
  echo "Cleaning up existing tmux sessions..."
  
  # Kill the main bowlsman session if it exists
  if tmux has-session -t bowlsman 2>/dev/null; then
    echo "Killing existing bowlsman tmux session..."
    tmux kill-session -t bowlsman
  fi
  
  # Kill any zombie frontend or backend processes
  echo "Checking for lingering processes..."
  
  # Kill any running Next.js dev servers
  pkill -f "next dev" || true
  
  # Kill any running Django dev servers
  pkill -f "python manage.py runserver" || true
  
  # Small delay to ensure processes are cleaned up
  sleep 1
}

# Create a new tmux session and run a command in it
run_in_tmux() {
  local window_name=$1
  shift
  local command="cd ${SCRIPT_DIR} && $*"
  
  # Always try to create a new session
  if ! tmux has-session -t bowlsman 2>/dev/null; then
    tmux new-session -d -s bowlsman -n "$window_name"
    tmux send-keys -t bowlsman:0 "$command" Enter
    tmux pipe-pane -t bowlsman:0 "cat >> frontend/frontend_local.log"
  else
    tmux new-window -t bowlsman -n "$window_name"
    tmux send-keys -t bowlsman:"$window_name" "$command" Enter
    tmux pipe-pane -t bowlsman:"$window_name" "cat >> frontend/frontend_local.log"
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
    # Setup logging for the pane
    tmux pipe-pane -t bowlsman:0 "cat >> backend/backend_local.log"
  else
    tmux new-window -t bowlsman -n "backend"
    tmux send-keys -t bowlsman:"backend" "$conda_cmd" Enter
    # Setup logging for the new pane
    tmux pipe-pane -t bowlsman:"backend" "cat >> backend/backend_local.log"
  fi
}

# Clean up any existing environment variables that might override .env
cleanup_env() {
  echo "Cleaning up environment variables..."
  unset NEXT_PUBLIC_API_URL
  unset NEXT_PUBLIC_WEBSOCKET_URL
  unset DEPLOYMENT_MODE
}

# Set up environment
echo "Setting up environment for local development..."
cleanup_env
cp -f .env.local .env
ln -sf ../.env frontend/.env
ln -sf ../.env backend/.env

# Check if PostgreSQL is running locally
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

# Clean up any existing tmux sessions BEFORE setting up logs
cleanup_tmux

# Setup log directories
setup_logs

# Start both services
echo "Starting backend and frontend services..."
run_backend
run_in_tmux "frontend" "cd frontend && npm run dev"

# Print useful information
echo ""
echo "Services have been started in tmux session 'bowlsman'"
echo ""
echo "Access your services at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:8000"
echo "  API Docs: http://localhost:8000/api/schema/swagger-ui/"
echo ""
echo "Useful tmux commands:"
echo "  tmux attach -t bowlsman     - Attach to the tmux session"
echo "  tmux ls                     - List running tmux sessions"
echo "  tmux kill-session -t bowlsman  - Kill all services when done"
echo ""
echo "Once attached, you can:"
echo "  Ctrl+B then N              - Switch to next window"
echo "  Ctrl+B then P              - Switch to previous window"
echo "  Ctrl+B then D              - Detach from tmux session"
echo ""
echo "View logs at:"
echo "  Backend: tail -f backend/backend_local.log"
echo "  Frontend: tail -f frontend/frontend_local.log"
echo ""