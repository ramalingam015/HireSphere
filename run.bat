@echo off
echo =====================================================================
echo   CS455 Deliverable 1: HireSphere Recruitment & Interview Platform
echo =====================================================================
echo.

cd /d "%~dp0backend"

echo [1/3] Checking Python dependencies...
python -m pip install -r requirements.txt --quiet

echo [2/3] Initializing Database & Seed Data...
python -c "from app.seed import seed_database; seed_database()"

echo [3/3] Starting Server at http://localhost:8000 ...
echo.
echo =====================================================================
echo   System running at: http://localhost:8000
echo   API Documentation: http://localhost:8000/docs
echo.
echo   Demo Credentials:
echo     - Student:   student@university.edu / student123
echo     - Recruiter: recruiter@techcorp.com / recruiter123
echo     - Pending:   pending@startup.io / pending123
echo     - Admin:     admin@recruit.com / admin123
echo =====================================================================
echo.

start http://localhost:8000
python main.py

pause
