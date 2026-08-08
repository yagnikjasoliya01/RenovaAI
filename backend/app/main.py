from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.routes import projects, materials

MATERIALS_STATIC = Path(__file__).parent / "materials"

app = FastAPI(title=settings.app_name)

# CORS configuration - automatically uses environment settings
# Development: allows all localhost origins
# Production: set FRONTEND_URL in .env to your domain
if settings.environment == "production":
    # Production: use specific origins from env
    allowed_origins = [url.strip() for url in settings.frontend_url.split(",")]
    allow_credentials = True
else:
    # Development: allow all origins for easier testing
    allowed_origins = ["*"]
    allow_credentials = False  # Can't use credentials with wildcard origin

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount uploads directory only in development (production uses Supabase Storage)
if settings.environment == "development":
    app.mount("/uploads", StaticFiles(directory=settings.upload_path), name="uploads")
app.mount(
    "/materials/thumbs",
    StaticFiles(directory=MATERIALS_STATIC / "thumbs"),
    name="material-thumbs",
)
app.mount(
    "/materials/textures",
    StaticFiles(directory=MATERIALS_STATIC / "textures"),
    name="material-textures",
)
app.include_router(projects.router, prefix="/api")
app.include_router(materials.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
