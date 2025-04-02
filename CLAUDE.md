# CLAUDE.md - Bowlsman Project Guide

## Deployment Modes

The project supports two deployment modes:
- `local`: Run components directly on host machine (faster for development)
- `docker`: Run everything in Docker containers (consistent environment)

You can switch between modes using the provided scripts:
- `./run_local.sh`: Run in local mode
- `./run_docker.sh`: Run in Docker mode

## Environment Configuration

The application uses .env files to manage environment-specific settings:
- `backend/.env.local`: Local development settings for Django
- `backend/.env.docker`: Docker development settings for Django
- `frontend/.env.local`: Local development settings for Next.js
- `frontend/.env.docker`: Docker development settings for Next.js

When running in either mode, the appropriate .env file is copied to .env in each directory.

## Build/Lint/Test Commands

### Frontend

#### Docker Mode
- Run all commands inside frontend container
- Build: `docker-compose exec frontend npm run build` 
- Lint: `docker-compose exec frontend npm run lint`

#### Local Mode
- Build: `cd frontend && npm run build` or `npx next build`
- Dev server: `cd frontend && npm run dev` or `npx next dev`
- Start prod: `cd frontend && npm run start` or `npx next start`
- Lint: `cd frontend && npm run lint` or `npx next lint`

### Backend

#### Docker Mode
- Run Django server: `docker-compose up backend`
- Run tests: `docker-compose exec backend python manage.py test`
- Run single test: `docker-compose exec backend python manage.py test users.tests.test_scheduling.TestRoundRobinSchedule.test_8_players`

#### Local Mode
- Run Django server: `cd backend && python manage.py runserver`
- Run tests: `cd backend && python manage.py test`
- Run single test: `cd backend && python manage.py test users.tests.test_scheduling.TestRoundRobinSchedule.test_8_players`

## Code Style Guidelines

### Frontend
- Use TypeScript for all code; prefer interfaces over types for object shapes
- React components use PascalCase, functions and variables use camelCase
- Guard localStorage with mounted state check to prevent SSR errors
- Use standardized axios instance from `src/lib/axios.ts`
- Import order: React/Next imports, third-party libraries, local components/utils
- Wrap API calls in try/catch with user-friendly error messages and console.error logging
- Follow Navigation component standards per FRONTEND_STANDARDS.md

### Backend
- Django models use PascalCase, views use snake_case
- Follow RESTful API conventions for endpoints
- Proper error handling with specific HTTP status codes
- Use Django test framework for testing

### General
- Follow portable container principles - code should run anywhere
- Leverage maintenance scripts (fix_*.sh) to maintain code consistency
- Use DEPLOYMENT_MODE environment variable to handle environment-specific configurations

### Postgres
- In local mode: Use locally installed PostgreSQL (requires PostgreSQL installation)
- In docker mode: PostgreSQL runs in a Docker container