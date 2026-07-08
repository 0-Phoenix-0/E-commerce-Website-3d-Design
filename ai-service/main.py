from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api.routes import router as api_router
from workers.queue_worker import start_workers, stop_workers

app = FastAPI(
    title="Hunyuan3D AI Generation Service",
    description="FastAPI service hosting Hunyuan3D-DiT and Hunyuan3D-Paint mesh and texture generation pipelines.",
    version="1.0.0"
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

@app.on_event("startup")
def startup_event():
    print("[AI-SERVICE] Starting background queue workers...")
    start_workers()

@app.on_event("shutdown")
def shutdown_event():
    print("[AI-SERVICE] Shutting down background queue workers...")
    stop_workers()

@app.get("/")
def read_root():
    return {
        "status": "running",
        "device": settings.DEVICE,
        "cuda": settings.CUDA_AVAILABLE,
        "gpu_name": settings.GPU_NAME,
        "storage_path": str(settings.STORAGE_DIR)
    }
