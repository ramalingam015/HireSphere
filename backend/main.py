import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.config import UPLOAD_DIR
from app.migrations import run_auto_migrations
from app.seed import seed_database
from app.routes import (
    auth_routes, jobs_routes, applications_routes,
    interviews_routes, networking_routes, admin_routes
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables created and initial demo seed runs
    Base.metadata.create_all(bind=engine)
    run_auto_migrations()
    try:
        seed_database()
    except Exception as e:
        print(f"Seed note: {e}")
    yield

app = FastAPI(
    title="Recruitment & Interview Management Platform",
    description="CS455 Deliverable 1 - Group 10. Role-based hiring platform with ATS scoring and interview slot booking.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware for frontend React access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploaded resume files
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR.parent)), name="uploads")

# Include Routers
app.include_router(auth_routes.router)
app.include_router(jobs_routes.router)
app.include_router(applications_routes.router)
app.include_router(interviews_routes.router)
app.include_router(networking_routes.router)
app.include_router(admin_routes.router)

from pathlib import Path
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Recruitment & ATS Interview Platform API is operational",
        "docs_url": "/docs",
        "roles": ["candidate", "recruiter", "admin"]
    }

if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {
            "message": "Recruitment & ATS Platform Backend is running. Run `npm run dev` in frontend for UI.",
            "docs_url": "/docs"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
