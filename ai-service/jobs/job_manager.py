import queue
import datetime
import threading
import time
import requests
from typing import Dict, List, Optional, Set
from pydantic import BaseModel
from config import settings

# ── Backend webhook configuration check ──────────────────────────────────────
# If BACKEND_URL is not set to a real external URL, skip webhook calls entirely.
# The Render backend URL must be configured in .env / docker-compose environment.
# Placeholder prefixes that indicate the backend is NOT a real external endpoint:
_BACKEND_PLACEHOLDER_PREFIXES = (
    "http://localhost",
    "http://127.0.0.1",
    "http://backend",   # Docker Compose internal hostname
    "http://0.0.0.0",
)
_raw_url = settings.BACKEND_URL.strip().rstrip("/")
_BACKEND_CONFIGURED: bool = bool(_raw_url) and not any(
    _raw_url.startswith(p) for p in _BACKEND_PLACEHOLDER_PREFIXES
)
if not _BACKEND_CONFIGURED:
    if not _raw_url:
        print(
            "[AI-SERVICE] WARNING: BACKEND_URL is not set. "
            "Webhook callbacks to the backend are DISABLED. "
            "Set BACKEND_URL to your Render backend URL in .env to enable them."
        )
    else:
        print(
            f"[AI-SERVICE] WARNING: BACKEND_URL='{settings.BACKEND_URL}' looks like a local/internal address. "
            "Webhook callbacks to the backend are DISABLED. "
            "Set BACKEND_URL to your Render backend URL in .env to enable them."
        )
else:
    print(f"[AI-SERVICE] Backend webhook configured: {settings.BACKEND_URL}")


# ── Progress → Stage Label mapping ───────────────────────────────────────────
def progress_to_stage_label(progress: float) -> str:
    """Maps a progress percentage (0-100) to a human-readable stage label."""
    if progress < 10:
        return "Queued"
    elif progress < 15:
        return "Preparing Images"
    elif progress < 30:
        return "Removing Background"
    elif progress < 55:
        return "Generating Shape"
    elif progress < 82:
        return "Generating Texture"
    elif progress < 95:
        return "Assembling Model"
    elif progress < 98:
        return "Finalizing Preview"
    elif progress < 100:
        return "Uploading to Cloudinary"
    else:
        return "Completed"


class Job(BaseModel):
    product_id: str
    image_urls: List[str]
    quality: str
    texture_resolution: str
    status: str  # "queued", "running", "completed", "failed", "cancelled"
    progress: float = 0.0
    estimated_time: float = 30.0
    generation_time: Optional[float] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    error: Optional[str] = None
    file_size: Optional[int] = None
    gpu_used: Optional[str] = None
    vram_usage: Optional[float] = None
    engine_version: str = "Hunyuan3D-v2.1"
    texture_resolution_actual: Optional[str] = None
    vertices: Optional[int] = None
    faces: Optional[int] = None
    # Cloudinary URLs — set after successful upload
    model_url: Optional[str] = None
    preview_url: Optional[str] = None
    # Human-readable stage label for the frontend
    stage_label: str = "Queued"

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, Job] = {}
        self.task_queue = queue.Queue(maxsize=settings.MAX_QUEUE_SIZE)
        self.lock = threading.Lock()
        # Tracks which product_ids have already had a webhook failure logged.
        # After the first failure, subsequent errors for the same product are
        # suppressed to prevent log spam during a generation run.
        self._webhook_warned: Set[str] = set()

    def get_job(self, product_id: str) -> Optional[Job]:
        with self.lock:
            return self.jobs.get(product_id)

    def add_job(self, product_id: str, image_urls: List[str], quality: str, texture_resolution: str, force: bool = False) -> Job:
        # Validate quality value before accepting the job
        from config import settings as _settings
        if quality not in _settings.QUALITY_VALID_VALUES:
            valid = ", ".join(sorted(_settings.QUALITY_VALID_VALUES))
            raise ValueError(
                f"Invalid quality value '{quality}'. Must be one of: {valid}"
            )

        with self.lock:
            existing_job = self.jobs.get(product_id)
            if existing_job:
                if existing_job.status in ["queued", "running"]:
                    return existing_job
                if not force and existing_job.status == "completed":
                    return existing_job

            job = Job(
                product_id=product_id,
                image_urls=image_urls,
                quality=quality,
                texture_resolution=texture_resolution,
                status="queued",
                stage_label="Queued",
            )
            self.jobs[product_id] = job

        self.notify_backend(product_id, {
            "status": "processing",
            "estimatedTime": 30.0,
            "stageLabel": "Queued",
            "error": None
        })

        try:
            self.task_queue.put(product_id, block=False)
        except queue.Full:
            with self.lock:
                job = self.jobs.get(product_id)
                if job:
                    job.status = "failed"
                    job.error = "AI generation queue is full. Try again later."
                    job.ended_at = datetime.datetime.now().isoformat()
            self.notify_backend(product_id, {
                "status": "failed",
                "stageLabel": "Failed",
                "error": "AI Service queue is full. Try again later."
            })

        return job

    def update_job(self, product_id: str, **kwargs):
        # Snapshot the fields we need for notify_backend while holding the lock
        snap = {}
        with self.lock:
            job = self.jobs.get(product_id)
            if not job:
                return

            # Set started_at when transitioning to running
            if kwargs.get("status") == "running" and job.started_at is None:
                kwargs.setdefault("started_at", datetime.datetime.now().isoformat())

            # Set ended_at when transitioning to terminal states
            if kwargs.get("status") in ("completed", "failed") and job.ended_at is None:
                kwargs.setdefault("ended_at", datetime.datetime.now().isoformat())

            # Auto-compute stage_label from progress if not explicitly provided
            if "progress" in kwargs and "stage_label" not in kwargs:
                kwargs["stage_label"] = progress_to_stage_label(kwargs["progress"])

            for key, val in kwargs.items():
                if hasattr(job, key):
                    setattr(job, key, val)

            # Snapshot fields needed for the webhook payload (read under lock)
            snap = {
                "status": job.status,
                "error": job.error,
                "generation_time": job.generation_time,
                "file_size": job.file_size,
                "gpu_used": job.gpu_used,
                "vram_usage": job.vram_usage,
                "texture_resolution_actual": job.texture_resolution_actual,
                "vertices": job.vertices,
                "faces": job.faces,
                "ended_at": job.ended_at,
                "model_url": job.model_url,
                "preview_url": job.preview_url,
                "stage_label": job.stage_label,
                "quality": job.quality,
            }

        # Build webhook payload outside the lock using the snapshot
        payload = {}
        if "status" in kwargs:
            payload["status"] = kwargs["status"]
        if "error" in kwargs:
            payload["error"] = kwargs["error"]
        if "progress" in kwargs:
            payload["estimatedTime"] = max(0.0, 30.0 * (1.0 - kwargs["progress"] / 100.0))
        if snap.get("stage_label"):
            payload["stageLabel"] = snap["stage_label"]

        if kwargs.get("status") == "completed":
            # Use Cloudinary URLs — these must have been set before calling update_job(completed)
            model_url = snap["model_url"]
            preview_url = snap["preview_url"]

            if not model_url or not preview_url:
                # Safety guard: should not happen if queue_worker uploads first
                print(
                    f"[AI-SERVICE] WARNING: update_job(completed) called for {product_id} "
                    f"without model_url/preview_url set. Cloudinary upload may have been skipped."
                )

            payload.update({
                "status": "ready",
                "enabled": True,
                "engine": "Hunyuan3D-v2.1",
                "version": "1.0.0",
                "modelUrl": model_url or "",
                "previewImage": preview_url or "",
                "thumbnailUrl": preview_url or "",
                "generatedAt": snap["ended_at"] or datetime.datetime.now().isoformat(),
                "generationTime": snap["generation_time"],
                "fileSize": snap["file_size"],
                "gpuUsed": snap["gpu_used"],
                "vramUsage": snap["vram_usage"],
                "textureResolution": snap["texture_resolution_actual"],
                "stageLabel": "Completed",
                "generationSettings": {
                    "quality": snap["quality"],
                    "textureResolution": snap["texture_resolution_actual"] or snap["quality"],
                },
                "meshStats": {
                    "vertices": snap["vertices"] or 0,
                    "faces": snap["faces"] or 0,
                } if snap["vertices"] else None,
            })
        elif kwargs.get("status") == "failed":
            payload.update({
                "status": "failed",
                "stageLabel": "Failed",
                "error": snap["error"] or "Unknown generation failure",
            })

        if payload:
            self.notify_backend(product_id, payload)

    def delete_assets(self, product_id: str) -> bool:
        deleted = False
        glb_path = settings.STORAGE_DIR / f"{product_id}.glb"
        preview_path = settings.STORAGE_DIR / f"{product_id}_preview.png"
        
        if glb_path.exists():
            glb_path.unlink()
            deleted = True
        if preview_path.exists():
            preview_path.unlink()
            deleted = True
            
        with self.lock:
            if product_id in self.jobs:
                del self.jobs[product_id]
                deleted = True
        return deleted

    def notify_backend(self, product_id: str, payload: dict, max_retries: int = 3):
        """
        Send a PUT webhook to the backend to update the product's 3D metadata.
        Retries up to max_retries times with exponential backoff on failure.
        Suppresses repeated error logs for the same product.
        """
        # If the backend URL is not configured (localhost / empty / Docker-internal),
        # skip the webhook call silently.
        if not _BACKEND_CONFIGURED:
            return

        url = f"{settings.BACKEND_URL}/api/v1/products/{product_id}/3d"
        headers = {
            "Content-Type": "application/json",
            "x-ai-secret": settings.INTERNAL_SECRET
        }

        for attempt in range(1, max_retries + 1):
            try:
                res = requests.put(url, headers=headers, json=payload, timeout=10)
                if res.status_code == 200:
                    # Clear warning state on success
                    self._webhook_warned.discard(product_id)
                    return
                else:
                    print(
                        f"[AI-SERVICE] Webhook: backend returned {res.status_code} for "
                        f"product {product_id} (attempt {attempt}/{max_retries}). Body: {res.text[:200]}"
                    )
            except Exception as e:
                if product_id not in self._webhook_warned:
                    self._webhook_warned.add(product_id)
                    print(
                        f"[AI-SERVICE] Webhook error for product {product_id} "
                        f"(attempt {attempt}/{max_retries}, further errors suppressed): {e}"
                    )

            # Exponential backoff before retry (skip sleep on last attempt)
            if attempt < max_retries:
                time.sleep(2 ** (attempt - 1))  # 1s, 2s

    def get_queue_status(self) -> dict:
        with self.lock:
            all_jobs = list(self.jobs.values())
            
        waiting = [j for j in all_jobs if j.status == "queued"]
        running = [j for j in all_jobs if j.status == "running"]
        completed = [j for j in all_jobs if j.status == "completed"]
        failed = [j for j in all_jobs if j.status == "failed"]
        
        return {
            "active_workers": settings.WORKER_COUNT,
            "queue_size": self.task_queue.qsize(),
            "max_queue_size": settings.MAX_QUEUE_SIZE,
            "jobs_summary": {
                "queued": len(waiting),
                "running": len(running),
                "completed": len(completed),
                "failed": len(failed)
            },
            "queued_product_ids": [j.product_id for j in waiting],
            "running_product_ids": [j.product_id for j in running]
        }

job_manager = JobManager()
