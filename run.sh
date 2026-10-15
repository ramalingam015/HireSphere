#!/usr/bin/env bash
set -e

echo "====================================================================="
echo "  CS455 Deliverable 1: HireSphere Recruitment & Interview Platform"
echo "====================================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

echo "[1/3] Checking dependencies..."
pip install -r requirements.txt --quiet

echo "[2/3] Initializing Database & Seed Data..."
python -c "from app.seed import seed_database; seed_database()"

echo "[3/3] Starting Server at http://localhost:8000 ..."
echo ""
echo "====================================================================="
echo "  System running at: http://localhost:8000"
echo "  API Documentation: http://localhost:8000/docs"
echo ""
echo "  Demo Credentials:"
echo "    - Student:   student@university.edu / student123"
echo "    - Recruiter: recruiter@techcorp.com / recruiter123"
echo "    - Pending:   pending@startup.io / pending123"
echo "    - Admin:     admin@recruit.com / admin123"
echo "====================================================================="
echo ""

python main.py
