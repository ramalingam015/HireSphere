@echo off
setlocal
echo =====================================================================
echo   CS455 Deliverable 1: HireSphere Recruitment & Interview Platform
echo =====================================================================
echo.

:: Detect Python executable to avoid WindowsApps dummy alias
set "PY_CMD=python"
if exist "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python314\Scripts;%PATH%"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python313;%LOCALAPPDATA%\Programs\Python\Python313\Scripts;%PATH%"
)

cd /d "%~dp0backend"

echo [1/3] Checking Python dependencies...
%PY_CMD% -m pip install -r requirements.txt --quiet

echo [2/3] Initializing Database & Seed Data...
%PY_CMD% -c "from app.seed import seed_database; seed_database()"

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
%PY_CMD% main.py

pause
