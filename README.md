# Next.js + FastAPI + SQLite Stack

A full-stack application with:
- Next.js frontend
- FastAPI backend
- SQLite database
- Docker Compose setup

## Setup

1. Install Docker and Docker Compose

2. Build and run the containers:
```bash
docker compose up --build
```

3. Access the applications:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Development

- Frontend code is in the `frontend/` directory
- Backend code is in the `backend/` directory
- SQLite database file is stored in `data/db.sqlite`

## Project Structure

```
.
├── frontend/               # Next.js frontend
│   ├── app/               # Next.js app directory
│   ├── Dockerfile         # Frontend container setup
│   └── package.json       # Frontend dependencies
├── backend/               # FastAPI backend
│   ├── main.py           # Main API file
│   ├── Dockerfile        # Backend container setup
│   └── requirements.txt  # Python dependencies
├── data/                 # Persistent data directory
│   └── db.sqlite        # SQLite database file
└── docker-compose.yml    # Container orchestration
``` 