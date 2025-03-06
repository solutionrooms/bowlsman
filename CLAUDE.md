# CLAUDE.md - Bowlsman Project Guide

## Build/Lint/Test Commands

### Frontend
- run all commands inside frontend container
- Build: `npm run build` or `npx next build`
- Dev server: `npm run dev` or `npx next dev`
- Start prod: `npm run start` or `npx next start`
- Lint: `npm run lint` or `npx next lint`

### Backend
- Run Django server inside container: `docker-compose up backend`
- Run tests: `docker-compose exec backend python manage.py test`
- Run single test: `docker-compose exec backend python manage.py test users.tests.test_scheduling.TestRoundRobinSchedule.test_8_players`

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
- Run all Django commands inside containers - never locally
- Follow RESTful API conventions for endpoints
- Proper error handling with specific HTTP status codes
- Use Django test framework for testing

### General
- Follow portable container principles - code should run anywhere
- Leverage maintenance scripts (fix_*.sh) to maintain code consistency

### Postgres
- use the postgres MCP server 
