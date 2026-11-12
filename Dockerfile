# Stage 1: Build React Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend with Static Frontend
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-builder /app/frontend/dist ./static

ENV PYTHONUNBUFFERED=1 PORT=8000
EXPOSE 8000

# Seed first (creates tables once) so the 2 uvicorn workers do not race on a fresh database.
CMD ["sh", "-c", "python -c 'from app.seed import seed_database; seed_database()' && uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 2"]
