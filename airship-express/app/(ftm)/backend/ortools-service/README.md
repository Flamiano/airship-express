# OR-Tools Optimizer Service

This folder contains a small FastAPI service that uses OR-Tools to compute the shortest route order for a depot and a set of stops.

## Install

```bash
cd backend/ortools-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Backend integration

The backend already proxies optimization requests to `http://localhost:8000/optimize` when `USE_ORTOOLS=true` or `ORTOOLS_SERVICE_URL` is set.

Set the following environment variables in `backend/.env` or your shell:

```bash
USE_ORTOOLS=true
ORTOOLS_SERVICE_URL=http://localhost:8000/optimize
```
