# Multi-stage Dockerfile for HireSphere Platform
# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend + Static Frontend
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (including libpq for PostgreSQL support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt \
    && pip install --no-cache-dir "psycopg[binary]" psycopg2-binary

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend assets from stage 1 into frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure upload directory exists
RUN mkdir -p /app/backend/uploads/resumes

# Default environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV DATABASE_URL=""

EXPOSE 8000

# Working directory inside backend
WORKDIR /app/backend

# Entrypoint: seeds database if empty, then starts Uvicorn
CMD ["sh", "-c", "python -c 'from app.seed import seed_database; seed_database()' && uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
