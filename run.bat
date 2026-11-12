@echo off
REM Starts the local backend stack (API + PostgreSQL + S3 storage) with Docker Compose.
cd /d "%~dp0"
echo Starting API + PostgreSQL + S3 storage...
set ENVARG=
if exist backend\.env set ENVARG=--env-file backend/.env
docker compose %ENVARG% up -d --build
if errorlevel 1 exit /b 1
echo.
echo   API:            http://localhost:8000   (Swagger: /docs)
echo   PostgreSQL:     localhost:5432          (postgres / postgrespassword)
echo.
echo   Frontend:       cd frontend ^&^& set VITE_API_BASE=http://localhost:8000 ^&^& npm run dev
echo   Stop:           docker compose down   (add -v to also wipe data)
echo.
echo   Demo accounts: student@university.edu / student123
echo                  recruiter@techcorp.com / recruiter123
echo                  admin@recruit.com / admin123
