import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api.routes import router as api_router
from workers.queue_worker import start_workers, stop_workers

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: start workers on startup, stop on shutdown."""
    try:
        print("[AI-SERVICE] Starting background queue workers...")
        start_workers()
        print("[AI-SERVICE] Background workers started successfully.")
    except Exception as e:
        logger.error("[AI-SERVICE] CRITICAL: Failed to start background workers: %s", e, exc_info=True)
        # Do NOT raise — let the service start so /health can report the error

    yield  # Server is running

    print("[AI-SERVICE] Shutting down background queue workers...")
    stop_workers()


app = FastAPI(
    title="Hunyuan3D AI Generation Service",
    description=(
        "FastAPI service hosting Hunyuan3D-DiT and Hunyuan3D-Paint "
        "mesh and texture generation pipelines for real-time 3D product generation."
    ),
    version="2.1.0",
    lifespan=lifespan,
)

# CORS Policy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Status"])
def read_root():
    """Root health probe for Docker healthcheck."""
    return {
        "service": "Hunyuan3D AI Generation Service",
        "version": "2.1.0",
        "status": "running",
        "device": settings.DEVICE,
        "cuda": settings.CUDA_AVAILABLE,
        "gpu_name": settings.GPU_NAME,
        "storage_path": str(settings.STORAGE_DIR),
    }

