import queue
import datetime
import threading
import requests
from typing import Dict, List, Optional
from pydantic import BaseModel
from config import settings

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
    engine_version: str = "Hunyuan3D-v1"
    texture_resolution_actual: Optional[str] = None
    vertices: Optional[int] = None
    faces: Optional[int] = None

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, Job] = {}
        self.task_queue = queue.Queue(maxsize=settings.MAX_QUEUE_SIZE)
        self.lock = threading.Lock()

    def get_job(self, product_id: str) -> Optional[Job]:
        with self.lock:
            return self.jobs.get(product_id)

    def add_job(self, product_id: str, image_urls: List[str], quality: str, texture_resolution: str, force: bool = False) -> Job:
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
                status="queued"
            )
            self.jobs[product_id] = job
            
        self.notify_backend(product_id, {
            "status": "processing",
            "estimatedTime": 30.0,
            "error": None
        })

        try:
            self.task_queue.put(product_id, block=False)
        except queue.Full:
            with self.lock:
                job.status = "failed"
                job.error = "AI generation queue is full."
            self.notify_backend(product_id, {
                "status": "failed",
                "error": "AI Service queue is full."
            })
            
        return job

    def update_job(self, product_id: str, **kwargs):
        with self.lock:
            job = self.jobs.get(product_id)
            if not job:
                return
            for key, val in kwargs.items():
                if hasattr(job, key):
                    setattr(job, key, val)
        
        payload = {}
        if "status" in kwargs:
            payload["status"] = kwargs["status"]
        if "error" in kwargs:
            payload["error"] = kwargs["error"]
        if "progress" in kwargs:
            payload["estimatedTime"] = max(0.0, 30.0 * (1.0 - kwargs["progress"] / 100.0))
            
        if kwargs.get("status") == "completed" and job:
            payload.update({
                "status": "ready",
                "engine": "Hunyuan3D-v1",
                "version": "1.0.0",
                "modelUrl": f"/api/v1/products/{product_id}/3d/download",
                "previewImage": f"/api/v1/products/{product_id}/3d/preview",
                "thumbnailUrl": f"/api/v1/products/{product_id}/3d/preview",
                "generatedAt": datetime.datetime.now().isoformat(),
                "generationTime": job.generation_time,
                "fileSize": job.file_size,
                "gpuUsed": job.gpu_used,
                "vramUsage": job.vram_usage,
                "textureResolution": job.texture_resolution_actual,
                "meshStats": {
                    "vertices": job.vertices or 0,
                    "faces": job.faces or 0
                } if job.vertices else None
            })
        elif kwargs.get("status") == "failed" and job:
            payload.update({
                "status": "failed",
                "error": job.error or "Unknown generation failure"
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

    def notify_backend(self, product_id: str, payload: dict):
        url = f"{settings.BACKEND_URL}/api/v1/products/{product_id}/3d"
        headers = {
            "Content-Type": "application/json",
            "x-ai-secret": settings.INTERNAL_SECRET
        }
        try:
            res = requests.put(url, headers=headers, json=payload, timeout=5)
            if res.status_code != 200:
                print(f"[AI-SERVICE] Failed to update backend webhook for product {product_id}. Code: {res.status_code}, Body: {res.text}")
        except Exception as e:
            print(f"[AI-SERVICE] Webhook network error communicating with backend: {e}")

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
