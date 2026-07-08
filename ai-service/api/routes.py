from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from config import settings
from jobs.job_manager import job_manager

router = APIRouter()

class GenerateRequest(BaseModel):
    product_id: str
    image_urls: List[str]
    quality: str = "standard"
    texture_resolution: str = "1024x1024"
    force: bool = False

def verify_secret(x_ai_secret: Optional[str] = Header(None)):
    if x_ai_secret != settings.INTERNAL_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal authorization secret token"
        )

@router.post("/generate")
async def generate_model(req: GenerateRequest, x_ai_secret: Optional[str] = Header(None)):
    verify_secret(x_ai_secret)
    if not req.image_urls:
        raise HTTPException(status_code=400, detail="Images required for generation")
        
    job = job_manager.add_job(
        product_id=req.product_id,
        image_urls=req.image_urls,
        quality=req.quality,
        texture_resolution=req.texture_resolution,
        force=req.force
    )
    return {
        "success": True,
        "message": "3D generation job registered.",
        "job": job
    }

@router.get("/status/{product_id}")
async def get_status(product_id: str):
    job = job_manager.get_job(product_id)
    if not job:
        glb_path = settings.STORAGE_DIR / f"{product_id}.glb"
        if glb_path.exists():
            return {
                "success": True,
                "status": "ready",
                "product_id": product_id,
                "progress": 100.0,
                "message": "Model exists in storage"
            }
        return {
            "success": False,
            "status": "none",
            "message": "No generation job found for this product"
        }
    return {
        "success": True,
        "job": job
    }

@router.delete("/delete/{product_id}")
async def delete_model(product_id: str, x_ai_secret: Optional[str] = Header(None)):
    verify_secret(x_ai_secret)
    success = job_manager.delete_assets(product_id)
    return {
        "success": success,
        "message": f"Assets cleanup completed for product {product_id}."
    }

@router.get("/download/{product_id}")
async def download_glb(product_id: str):
    glb_path = settings.STORAGE_DIR / f"{product_id}.glb"
    if not glb_path.exists():
        raise HTTPException(status_code=404, detail="GLB model not found in storage")
    return FileResponse(
        path=str(glb_path),
        media_type="model/gltf-binary",
        filename=f"{product_id}.glb"
    )

@router.get("/preview/{product_id}")
async def get_preview(product_id: str):
    preview_path = settings.STORAGE_DIR / f"{product_id}_preview.png"
    if not preview_path.exists():
        fallback = settings.BASE_DIR / "static" / "default_preview.png"
        # Ensure the default static folder exists and contains placeholder
        if fallback.exists():
            return FileResponse(path=str(fallback), media_type="image/png")
        raise HTTPException(status_code=404, detail="Preview image not found in storage")
    return FileResponse(path=str(preview_path), media_type="image/png")

@router.post("/regenerate")
async def regenerate_model(req: GenerateRequest, x_ai_secret: Optional[str] = Header(None)):
    verify_secret(x_ai_secret)
    req.force = True
    return await generate_model(req, x_ai_secret)

@router.get("/queue")
async def get_queue():
    return job_manager.get_queue_status()
