from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.config import CORS_ORIGINS
from app import storage
from app.migrations import run_auto_migrations
from app.seed import seed_database
from app.routes import (
    auth_routes, jobs_routes, applications_routes,
    interviews_routes, networking_routes, admin_routes, files_routes,
    complaints_routes
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables created and initial demo seed runs
    Base.metadata.create_all(bind=engine)
    run_auto_migrations()
    storage.ensure_bucket()  # fail fast if the S3 storage is unreachable
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
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-AI-Search-Notice"],
)

# GZip compression to speed up payload delivery
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include Routers
app.include_router(auth_routes.router)
app.include_router(jobs_routes.router)
app.include_router(applications_routes.router)
app.include_router(interviews_routes.router)
app.include_router(networking_routes.router)
app.include_router(admin_routes.router)
app.include_router(files_routes.router)
app.include_router(complaints_routes.router)


# Static files for production React frontend (when bundled in Docker or built locally)
STATIC_DIR = Path(__file__).resolve().parent / "static"
if not STATIC_DIR.exists():
    STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if STATIC_DIR.exists() and (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Recruitment & ATS Interview Platform API is operational",
        "docs_url": "/docs",
        "roles": ["candidate", "recruiter", "admin"]
    }

@app.get("/")
def root():
    if STATIC_DIR.exists():
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    return {
        "message": "HireSphere API is running. The React frontend is hosted separately (Firebase Hosting).",
        "docs_url": "/docs"
    }

if STATIC_DIR.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    def catch_all(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not found")
        target_file = STATIC_DIR / full_path
        if target_file.exists() and target_file.is_file():
            return FileResponse(target_file)
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
