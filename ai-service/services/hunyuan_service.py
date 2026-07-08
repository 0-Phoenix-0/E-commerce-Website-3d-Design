import time
import requests
import io
import os
import sys
import gc
import shutil
import threading
from pathlib import Path
from PIL import Image
import torch

# Import local modules first to avoid collision with Hunyuan3D's utils directory
from config import settings
from utils.gpu_monitor import get_gpu_info
from services.mesh_optimizer import mesh_optimizer

# Add Hunyuan3D-2.1 paths to sys.path
HUNYUAN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Hunyuan3D-2.1"))
if HUNYUAN_DIR not in sys.path:
    sys.path.append(HUNYUAN_DIR)
if os.path.join(HUNYUAN_DIR, "hy3dshape") not in sys.path:
    sys.path.append(os.path.join(HUNYUAN_DIR, "hy3dshape"))
if os.path.join(HUNYUAN_DIR, "hy3dpaint") not in sys.path:
    sys.path.append(os.path.join(HUNYUAN_DIR, "hy3dpaint"))

# Apply torchvision compatibility fix if available
try:
    from torchvision_fix import apply_fix
    apply_fix()
except ImportError:
    pass
except Exception as e:
    print(f"Warning: Failed to apply torchvision fix: {e}")


class HunyuanGenerator:
    def __init__(self):
        self.lock = threading.Lock()

    def download_realesrgan_if_missing(self):
        """Downloads the RealESRGAN checkpoint required by the Paint pipeline."""
        ckpt_path = Path(HUNYUAN_DIR) / "hy3dpaint" / "ckpt" / "RealESRGAN_x4plus.pth"
        if not ckpt_path.exists():
            ckpt_path.parent.mkdir(parents=True, exist_ok=True)
            print("[AI-SERVICE] RealESRGAN checkpoint is missing. Downloading...")
            import urllib.request
            url = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
            urllib.request.urlretrieve(url, str(ckpt_path))
            print("[AI-SERVICE] RealESRGAN checkpoint downloaded successfully.")

    def download_weights_if_missing(self):
        """Downloads the official pretrained checkpoints for Hunyuan3D-2.1 from Hugging Face Hub."""
        weights_dir = Path(settings.BASE_DIR / "weights" / "Hunyuan3D-2.1")
        dit_dir = weights_dir / "hunyuan3d-dit-v2-1"

        if not dit_dir.exists():
            print("[AI-SERVICE] Pretrained weights for 2.1 are missing. Downloading from Hugging Face Hub (tencent/Hunyuan3D-2.1)...")
            from huggingface_hub import snapshot_download
            snapshot_download(
                repo_id="tencent/Hunyuan3D-2.1",
                local_dir=str(weights_dir),
                ignore_patterns=["*.gif", "*.mp4", "*.png", "*.jpg", "assets/*", "demos/*"]
            )
            print("[AI-SERVICE] Weights download complete.")
        else:
            print("[AI-SERVICE] Pretrained weights already exist in the configurable directory. Reusing.")

        # Ensure RealESRGAN weight is present for Paint pipeline
        self.download_realesrgan_if_missing()

    def run_generation(self, product_id: str, job_manager) -> dict:
        """Runs the full Hunyuan3D-2.1 pipeline on the CUDA GPU."""
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA (NVIDIA GPU) is not available. Real Hunyuan3D 2.1 inference requires a GPU.")

        start_time = time.time()
        gpu_info = get_gpu_info()
        
        output_glb = settings.STORAGE_DIR / f"{product_id}.glb"
        output_preview = settings.STORAGE_DIR / f"{product_id}_preview.png"
        
        job = job_manager.get_job(product_id)
        if not job or not job.image_urls:
            raise ValueError("No product images found in generation request.")
            
        print(f"[AI-SERVICE] Stage 0: Collecting and cleaning product images from {len(job.image_urls)} URLs...")
        
        # ── STAGE 0: Collect, filter, and validate images ────────────────────
        valid_images = []
        for url in job.image_urls:
            # Skip duplicates
            if url in [x.get("url") for x in valid_images]:
                continue
            try:
                res = requests.get(url, timeout=15)
                # Verify PIL parser works
                img = Image.open(io.BytesIO(res.content)).convert("RGBA")
                valid_images.append({"url": url, "image": img})
            except Exception as e:
                print(f"[AI-SERVICE] Skipping broken product image: {url}. Error: {e}")

        if not valid_images:
            raise ValueError("No valid product images found after filtering.")

        pil_images = [x["image"] for x in valid_images]
        print(f"[AI-SERVICE] Collected {len(pil_images)} unique product images.")

        # Ensure weights are present
        self.download_weights_if_missing()

        # Create temporary workspace folder for OBJ and texture maps
        temp_dir = os.path.join(settings.STORAGE_DIR, f"temp_{product_id}")
        os.makedirs(temp_dir, exist_ok=True)

        # Free VRAM before starting
        gc.collect()
        torch.cuda.empty_cache()

        try:
            # ── STAGE 1: Background Removal for all images ────────────────────
            print(f"[AI-SERVICE] Stage 1: Removing background for {len(pil_images)} images...")
            job_manager.update_job(product_id, progress=15.0)
            
            from hy3dshape.rembg import BackgroundRemover
            rembg = BackgroundRemover()
            
            nobg_images = []
            for idx, img in enumerate(pil_images):
                img_nobg = rembg(img)
                nobg_images.append(img_nobg)
                
            # Unload Rembg model
            del rembg
            gc.collect()
            torch.cuda.empty_cache()

            # ── STAGE 2: Shape Generation (Hunyuan3DDiTFlowMatchingPipeline) ──
            print("[AI-SERVICE] Stage 2: Reconstructing shape geometry...")
            job_manager.update_job(product_id, progress=45.0)
            
            from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline
            weights_dir = Path(settings.BASE_DIR / "weights" / "Hunyuan3D-2.1")
            
            # Load shape pipeline from our local weights directory
            pipeline_shapegen = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
                str(weights_dir),
                subfolder="hunyuan3d-dit-v2-1"
            )
            
            steps = settings.QUALITY_PRESETS.get(job.quality, settings.QUALITY_PRESETS["standard"])["dit_steps"]
            # Generate mesh using the primary input image (first cleaned image)
            mesh = pipeline_shapegen(
                image=nobg_images[0],
                num_inference_steps=steps,
                octree_resolution=384
            )[0]
            
            # Save untextured initial GLB
            initial_glb_path = os.path.join(temp_dir, "initial.glb")
            mesh.export(initial_glb_path)
            
            # Unload Shape model
            del pipeline_shapegen
            gc.collect()
            torch.cuda.empty_cache()

            # ── STAGE 3: Texture Generation (Hunyuan3DPaintPipeline) ────────
            print("[AI-SERVICE] Stage 3: Synthesizing PBR texture maps...")
            job_manager.update_job(product_id, progress=75.0)
            
            from textureGenPipeline import Hunyuan3DPaintPipeline, Hunyuan3DPaintConfig
            from hy3dpaint.convert_utils import create_glb_with_pbr_materials
            
            conf = Hunyuan3DPaintConfig(max_num_view=6, resolution=512)
            conf.multiview_pretrained_path = str(weights_dir)
            conf.realesrgan_ckpt_path = os.path.join(HUNYUAN_DIR, "hy3dpaint", "ckpt", "RealESRGAN_x4plus.pth")
            conf.multiview_cfg_path = os.path.join(HUNYUAN_DIR, "hy3dpaint", "cfgs", "hunyuan-paint-pbr.yaml")
            conf.custom_pipeline = os.path.join(HUNYUAN_DIR, "hy3dpaint", "hunyuanpaintpbr")
            
            paint_pipeline = Hunyuan3DPaintPipeline(conf)
            
            output_obj_path = os.path.join(temp_dir, "textured.obj")
            
            # Run texture synthesis on the shape using all background-removed product images
            textured_path_obj = paint_pipeline(
                mesh_path=initial_glb_path,
                image_path=nobg_images,
                output_mesh_path=output_obj_path,
                save_glb=False
            )
            
            # Unload Paint model
            del paint_pipeline
            gc.collect()
            torch.cuda.empty_cache()

            # ── STAGE 4: Convert OBJ to PBR GLB & Optimize ────────────────────
            print("[AI-SERVICE] Stage 4: Compiling PBR textures into final GLB...")
            job_manager.update_job(product_id, progress=90.0)
            
            if not os.path.exists(textured_path_obj):
                raise FileNotFoundError("PBR Texturing pipeline failed to output OBJ file.")
                
            textures = {
                'albedo': textured_path_obj.replace('.obj', '.jpg'),
                'metallic': textured_path_obj.replace('.obj', '_metallic.jpg'),
                'roughness': textured_path_obj.replace('.obj', '_roughness.jpg')
            }
            create_glb_with_pbr_materials(textured_path_obj, textures, str(output_glb))
            
            # Optimize triangles count and validate vertices
            opt_result = mesh_optimizer.optimize_and_validate(
                str(output_glb), str(output_preview), job.quality
            )

            # Generate beautiful centered PNG preview card from the primary nobg image
            nobg_img = nobg_images[0]
            nobg_img.thumbnail((400, 300))
            canvas = Image.new("RGBA", (400, 300), color=(249, 250, 251, 255))
            w, h = nobg_img.size
            canvas.paste(nobg_img, ((400 - w) // 2, (300 - h) // 2), mask=nobg_img)
            canvas.convert("RGB").save(str(output_preview), "PNG")

            end_time = time.time()
            gpu_info_end = get_gpu_info()
            
            return {
                "success": True,
                "generation_time": round(end_time - start_time, 2),
                "file_size": output_glb.stat().st_size,
                "gpu_used": gpu_info["gpu_used"],
                "vram_usage": max(gpu_info["vram_usage"], gpu_info_end["vram_usage"]),
                "texture_resolution": settings.QUALITY_PRESETS.get(job.quality, settings.QUALITY_PRESETS["standard"])["texture_resolution"],
                "vertices": opt_result.get("vertices", 0),
                "faces": opt_result.get("faces", 0)
            }
            
        finally:
            # Clean up temporary folders
            shutil.rmtree(temp_dir, ignore_errors=True)
            gc.collect()
            torch.cuda.empty_cache()

hunyuan_generator = HunyuanGenerator()
