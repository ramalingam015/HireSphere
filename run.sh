#!/usr/bin/env bash
# Starts the local backend stack (API + PostgreSQL + S3 storage) with Docker Compose.
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "Starting API + PostgreSQL + S3 storage..."
ENV_FILE=(); [ -f backend/.env ] && ENV_FILE=(--env-file backend/.env)
docker compose "${ENV_FILE[@]}" up -d --build

echo "Waiting for the API..."
for i in $(seq 1 40); do
  curl -sf http://localhost:8000/api/health >/dev/null && break
  sleep 3
done

cat <<'MSG'

  API:            http://localhost:8000   (Swagger: /docs)
  PostgreSQL:     localhost:5432          (postgres / postgrespassword)

  Frontend:       cd frontend && VITE_API_BASE=http://localhost:8000 npm run dev
  Stop:           docker compose down      (add -v to also wipe data)

  Demo accounts: student@university.edu / student123, recruiter@techcorp.com / recruiter123,
                 admin@recruit.com / admin123
MSG
