# Bowlsman - Bowling League Management System

A full-stack application with:
- Next.js frontend
- Django backend
- PostgreSQL database

## Setup

### Prerequisites
1. Install Docker and Docker Compose (for Docker mode)
2. Install PostgreSQL locally (for local development)
3. Install Node.js and npm (for local development)
4. Install Python 3.x (for local development)
5. Create Docker shared network (for Docker mode):
```bash
docker network create shared_network
```

## Initial Setup

For the easiest setup, run:

```bash
./setup_local_env.sh
```

This script will:
1. Check all prerequisites
2. Create a local PostgreSQL database 
3. Set up a Python virtual environment (optional)
4. Install all required dependencies
5. Create necessary environment files
6. Run initial database migrations

## Running the Application

### Option 1: Docker Mode (Containerized)
Run everything in Docker containers (recommended for consistent environments):

```bash
./run_docker.sh
```

Access the applications:
- Frontend: http://localhost:3010
- Backend API: http://localhost:8010
- API Docs: http://localhost:8010/api/schema/swagger-ui/

### Option 2: Local Development Mode
For faster development, you can run components directly on your host machine:

```bash
./run_local.sh
```

This script will:
1. Verify your local PostgreSQL installation
2. Let you choose to run:
   - Frontend only (Next.js)
   - Backend only (Django)
   - Both frontend and backend

#### Manual Local Setup

Alternatively, you can manually start the components:

1. Ensure your local PostgreSQL server is running:
```bash
# Start PostgreSQL (macOS)
brew services start postgresql
# OR on Ubuntu/Debian
sudo service postgresql start
```

2. Run the backend (in backend directory):
```bash
cd backend
# Make sure environment is set up
cp -n .env.local .env
# Activate virtual environment (if created)
source ../venv/bin/activate  # On Linux/macOS
# Run migrations if needed
python manage.py migrate
# Start server
python manage.py runserver 0.0.0.0:8000
```

3. Run the frontend (in frontend directory):
```bash
cd frontend
cp -n .env.local .env
npm run dev
```

Access the applications in local mode:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/schema/swagger-ui/

## Development

- Frontend code is in the `frontend/` directory
- Backend code is in the `backend/` directory

### Environment Switching

The project uses a `DEPLOYMENT_MODE` environment variable to determine how to configure services:
- `local`: For local development outside of Docker
- `docker`: For containerized development

This setting affects:
- Database connection details
- Frontend API endpoint URLs
- Email backend configuration