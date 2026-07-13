"""
Hunyuan3D-2.1 Generation Service
=================================
Runs the official Hunyuan3D-2.1 pipeline:
  Stage 0: Collect and validate product images
  Stage 1: Background removal (rembg / BackgroundRemover)
  Stage 2: Shape generation (Hunyuan3DDiTFlowMatchingPipeline)
  Stage 3: Texture generation (Hunyuan3DPaintPipeline — PBR multiview)
  Stage 4: GLB assembly with PBR materials + mesh optimization
  Stage 5: Preview image generation
"""

import time
import requests
import io
import os
import sys
import gc
import shutil
import threading
import datetime
from pathlib import Path
from PIL import Image
import torch

# ── Import local modules first (must happen before any sys.path manipulation) ──
from config import settings
from utils.gpu_monitor import get_gpu_info

# ── Hunyuan3D paths ───────────────────────────────────────────────────────────
HUNYUAN_DIR = str(settings.HUNYUAN_DIR)   # /app/Hunyuan3D-2.1
WEIGHTS_DIR = str(settings.WEIGHTS_DIR)   # /app/weights

# The official repo structure is:
#   Hunyuan3D-2.1/hy3dshape/   (shape package root)
#   Hunyuan3D-2.1/hy3dpaint/   (paint package root)
#   Hunyuan3D-2.1/             (contains torchvision_fix.py)
#
# We append (not insert) to avoid shadowing system packages.
for _path in [
    HUNYUAN_DIR,
    os.path.join(HUNYUAN_DIR, "hy3dshape"),
    os.path.join(HUNYUAN_DIR, "hy3dpaint"),
]:
    if _path not in sys.path:
        sys.path.append(_path)

# ── Torchvision compatibility fix ─────────────────────────────────────────────
try:
    from torchvision_fix import apply_fix
    apply_fix()
except ImportError:
    pass
except Exception as e:
    print(f"[AI-SERVICE] Warning: Failed to apply torchvision fix: {e}")


# ── Required checkpoint files for validation ──────────────────────────────────
# smart_load_model() looks inside:  $HY3DGEN_MODELS/<repo_name>/<subfolder>/
# HY3DGEN_MODELS is set to /app/weights (via Dockerfile ENV and docker-compose)
# repo_name is "Hunyuan3D-2.1"
_REPO_DIR = Path(WEIGHTS_DIR) / "Hunyuan3D-2.1"
_REQUIRED_CHECKPOINTS = {
    "Shape model config":    _REPO_DIR / "hunyuan3d-dit-v2-1" / "config.yaml",
    "Shape model weights":   _REPO_DIR / "hunyuan3d-dit-v2-1" / "model.fp16.ckpt",
    "Paint model index":     _REPO_DIR / "hunyuan3d-paintpbr-v2-1" / "model_index.json",
    "Paint model UNet":      _REPO_DIR / "hunyuan3d-paintpbr-v2-1" / "unet",
}
_REALESRGAN_PATH = Path(HUNYUAN_DIR) / "hy3dpaint" / "ckpt" / "RealESRGAN_x4plus.pth"
_PAINT_CFG_PATH  = Path(HUNYUAN_DIR) / "hy3dpaint" / "cfgs" / "hunyuan-paint-pbr.yaml"


def _validate_checkpoints() -> None:
    """Verify all required checkpoint files exist. Raise FileNotFoundError with
    actionable message if any are missing."""
    missing = []
    for label, path in _REQUIRED_CHECKPOINTS.items():
        if not Path(path).exists():
            missing.append(f"  - {label}: {path}")
    if missing:
        raise FileNotFoundError(
            "[AI-SERVICE] Missing required Hunyuan3D-2.1 checkpoint files.\n"
            "Run download_weights_if_missing() or mount pre-downloaded weights at:\n"
            f"  {_REPO_DIR}\n"
            "Missing files:\n" + "\n".join(missing)
        )


class HunyuanGenerator:
    def __init__(self):
        self.lock = threading.Lock()

    # ── Weight Management ────────────────────────────────────────────────────

    def download_realesrgan_if_missing(self) -> None:
        """Download RealESRGAN_x4plus.pth if not present (needed by Paint pipeline)."""
        if _REALESRGAN_PATH.exists():
            return
        _REALESRGAN_PATH.parent.mkdir(parents=True, exist_ok=True)
        print("[AI-SERVICE] Downloading RealESRGAN checkpoint...")
        import urllib.request
        url = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
        try:
            urllib.request.urlretrieve(url, str(_REALESRGAN_PATH))
            print("[AI-SERVICE] RealESRGAN checkpoint downloaded successfully.")
        except Exception as e:
            raise RuntimeError(
                f"[AI-SERVICE] Failed to download RealESRGAN checkpoint: {e}\n"
                f"Download manually and place at: {_REALESRGAN_PATH}"
            ) from e

    def download_weights_if_missing(self) -> None:
        """Download Hunyuan3D-2.1 weights from HuggingFace Hub if not present.

        smart_load_model() expects weights at:
            $HY3DGEN_MODELS/Hunyuan3D-2.1/hunyuan3d-dit-v2-1/
        This matches weights/ being mounted at /app/weights (HY3DGEN_MODELS=/app/weights).
        """
        repo_dir = _REPO_DIR

        # Check for the two critical directories
        shape_dir = repo_dir / "hunyuan3d-dit-v2-1"
        paint_dir = repo_dir / "hunyuan3d-paintpbr-v2-1"

        if not shape_dir.exists() or not paint_dir.exists():
            print(
                "[AI-SERVICE] Weights missing. Downloading tencent/Hunyuan3D-2.1 from HuggingFace Hub...\n"
                f"Target directory: {repo_dir}"
            )
            from huggingface_hub import snapshot_download
            snapshot_download(
                repo_id="tencent/Hunyuan3D-2.1",
                local_dir=str(repo_dir),
                ignore_patterns=["*.gif", "*.mp4", "assets/*", "demos/*"],
            )
            print("[AI-SERVICE] Weights download complete.")
        else:
            print("[AI-SERVICE] Hunyuan3D-2.1 weights found. Validating checkpoint files...")

        # Full checkpoint validation after download/existence check
        _validate_checkpoints()
        print("[AI-SERVICE] All checkpoints validated successfully.")

        # RealESRGAN for Paint pipeline
        self.download_realesrgan_if_missing()

    # ── Main Generation Pipeline ─────────────────────────────────────────────

    def run_generation(self, product_id: str, job_manager) -> dict:
        """Run the full Hunyuan3D-2.1 pipeline. Returns a result dict."""
        if not torch.cuda.is_available():
            raise RuntimeError(
                "[AI-SERVICE] CUDA GPU not available. "
                "Hunyuan3D-2.1 inference requires an NVIDIA GPU with CUDA support."
            )

        start_time = time.time()
        gpu_info_start = get_gpu_info()

        output_glb = settings.STORAGE_DIR / f"{product_id}.glb"
        output_preview = settings.STORAGE_DIR / f"{product_id}_preview.png"

        job = job_manager.get_job(product_id)
        if not job or not job.image_urls:
            raise ValueError(
                f"[AI-SERVICE] No product images found in generation job for product_id={product_id}."
            )

        print(f"[AI-SERVICE] Stage 0: Collecting {len(job.image_urls)} product image(s)...")

        # ── STAGE 0: Collect, deduplicate, and validate images ───────────────
        valid_images = []
        seen_urls = set()
        for url in job.image_urls:
            if url in seen_urls:
                continue
            seen_urls.add(url)
            try:
                res = requests.get(url, timeout=15)
                res.raise_for_status()
                img = Image.open(io.BytesIO(res.content)).convert("RGBA")
                valid_images.append({"url": url, "image": img})
            except Exception as e:
                print(f"[AI-SERVICE] Warning: Skipping broken image URL: {url}. Reason: {e}")

        if not valid_images:
            raise ValueError(
                "[AI-SERVICE] No valid product images could be fetched. "
                "Check that all image URLs are accessible from the container."
            )

        pil_images = [x["image"] for x in valid_images]
        print(f"[AI-SERVICE] Collected {len(pil_images)} unique product image(s).")

        # Ensure weights are present and validated
        self.download_weights_if_missing()

        # Temporary workspace for OBJ + texture maps
        temp_dir = str(settings.STORAGE_DIR / f"temp_{product_id}")
        os.makedirs(temp_dir, exist_ok=True)

        # Free VRAM before starting
        gc.collect()
        torch.cuda.empty_cache()

        # Track whether generation completed fully so the finally block
        # knows whether to preserve or delete the temp directory.
        _generation_succeeded = False

        try:
            # ── STAGE 1: Background Removal ──────────────────────────────────
            print(f"[AI-SERVICE] Stage 1: Removing background from {len(pil_images)} image(s)...")
            job_manager.update_job(product_id, progress=15.0)

            from hy3dshape.rembg import BackgroundRemover
            rembg = BackgroundRemover()

            nobg_images = []
            total = len(pil_images)
            for idx, img in enumerate(pil_images):
                img_nobg = rembg(img)
                nobg_images.append(img_nobg)
                # Per-image progress: stage 1 spans 15% → 30%
                progress = 15.0 + (idx + 1) / total * 15.0
                job_manager.update_job(product_id, progress=round(progress, 1))
                print(f"[AI-SERVICE]   Background removed: {idx + 1}/{total}")

            del rembg
            gc.collect()
            torch.cuda.empty_cache()

            # ── STAGE 2: Shape Generation ────────────────────────────────────
            print("[AI-SERVICE] Stage 2: Reconstructing 3D geometry (Hunyuan3DDiT)...")
            job_manager.update_job(product_id, progress=35.0)

            from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline

            # Load directly to CUDA — the official approach used by all Tencent
            # scripts (demo.py, model_worker.py, gradio_app.py).
            #
            # Memory safety comes from Fix 1 in pipelines.py:
            #   mmap=True   → the 6.9 GB ckpt dict is OS-mapped, not heap-allocated
            #   del ckpt    → dict freed before .to('cuda') is called
            # Peak RAM during load: ~7-8 GB (model params + transfer buffers).
            # Peak VRAM after load: 6.9 GB model params.
            #
            # Note: enable_model_cpu_offload() is intentionally NOT called.
            # It was copied from HuggingFace Diffusers into the upstream
            # Hunyuan3DDiTPipeline but was never completed — it calls
            # self.components which is undefined. No official Tencent script
            # (demo.py, model_worker.py, gradio_app.py) ever uses it.
            # The official low_vram_mode is torch.cuda.empty_cache() after
            # generation, which is already done in our finally block.
            print("[AI-SERVICE]   Loading shape model to CUDA...")
            pipeline_shapegen = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
                "Hunyuan3D-2.1",              # resolved via HY3DGEN_MODELS env var
                subfolder="hunyuan3d-dit-v2-1",
                device="cuda",
                dtype=torch.float16,
                use_safetensors=False,
                variant="fp16",
            )
            job_manager.update_job(product_id, progress=45.0)

            quality_preset = settings.QUALITY_PRESETS.get(
                job.quality, settings.QUALITY_PRESETS["standard"]
            )
            steps = quality_preset["dit_steps"]
            octree_res = quality_preset["octree_resolution"]

            print(f"[AI-SERVICE]   Running {steps} DiT steps at octree_resolution={octree_res}...")
            with torch.inference_mode():
                mesh = pipeline_shapegen(
                    image=nobg_images[0],
                    num_inference_steps=steps,
                    octree_resolution=octree_res,
                )[0]

            # Save initial untextured mesh
            initial_glb_path = os.path.join(temp_dir, "initial.glb")
            mesh.export(initial_glb_path)
            print(f"[AI-SERVICE]   Initial mesh saved: {initial_glb_path}")

            # Unload shape model completely to free VRAM for Paint pipeline
            del pipeline_shapegen, mesh
            gc.collect()
            torch.cuda.empty_cache()

            # ── STAGE 3: Texture Generation ──────────────────────────────────
            print("[AI-SERVICE] Stage 3: Synthesizing PBR textures (Hunyuan3DPaint)...")
            job_manager.update_job(product_id, progress=55.0)

            from textureGenPipeline import Hunyuan3DPaintPipeline, Hunyuan3DPaintConfig
            from convert_utils import create_glb_with_pbr_materials

            conf = Hunyuan3DPaintConfig(max_num_view=6, resolution=512)

            # multiview_utils.py: when multiview_pretrained_path is a local directory
            # it skips snapshot_download and does:
            #   model_path = os.path.join(model_path, "hunyuan3d-paintpbr-v2-1")
            conf.multiview_pretrained_path = str(_REPO_DIR)

            # absolute paths for checkpoints
            conf.realesrgan_ckpt_path = str(_REALESRGAN_PATH)
            conf.multiview_cfg_path = str(_PAINT_CFG_PATH)

            # Note: conf.custom_pipeline is NOT used by multiview_utils.py
            # which hardcodes the path relative to its own __file__ location.
            # Do NOT set it here to avoid confusion.

            paint_pipeline = Hunyuan3DPaintPipeline(conf)
            job_manager.update_job(product_id, progress=65.0)

            output_obj_path = os.path.join(temp_dir, "textured.obj")

            print("[AI-SERVICE]   Running multiview texture synthesis...")
            textured_path_obj = paint_pipeline(
                mesh_path=initial_glb_path,
                image_path=nobg_images,   # pass all background-removed images
                output_mesh_path=output_obj_path,
                save_glb=False,            # we handle GLB export via convert_utils
            )

            del paint_pipeline
            gc.collect()
            torch.cuda.empty_cache()

            # ── STAGE 4: Assemble PBR GLB ────────────────────────────────────
            print("[AI-SERVICE] Stage 4: Assembling PBR GLB file...")
            job_manager.update_job(product_id, progress=82.0)

            if not os.path.exists(textured_path_obj):
                raise FileNotFoundError(
                    f"[AI-SERVICE] Texture pipeline did not produce an OBJ output file.\n"
                    f"Expected: {textured_path_obj}\n"
                    "Check that the Paint pipeline completed successfully."
                )

            # Verify each PBR texture file exists before assembling
            texture_files = {
                "albedo":    textured_path_obj.replace(".obj", ".jpg"),
                "metallic":  textured_path_obj.replace(".obj", "_metallic.jpg"),
                "roughness": textured_path_obj.replace(".obj", "_roughness.jpg"),
            }
            missing_textures = [
                f"{k}: {v}" for k, v in texture_files.items()
                if not os.path.exists(v)
            ]
            if missing_textures:
                raise FileNotFoundError(
                    "[AI-SERVICE] Paint pipeline did not produce all expected PBR texture files.\n"
                    "Missing:\n" + "\n".join(f"  - {m}" for m in missing_textures)
                )

            create_glb_with_pbr_materials(textured_path_obj, texture_files, str(output_glb))

            if not output_glb.exists() or output_glb.stat().st_size == 0:
                raise RuntimeError(
                    f"[AI-SERVICE] GLB assembly failed — output file is empty or missing: {output_glb}"
                )
            print(f"[AI-SERVICE]   GLB assembled: {output_glb} ({output_glb.stat().st_size} bytes)")

            # ── STAGE 4b: Mesh optimization and validation ───────────────────
            from services.mesh_optimizer import mesh_optimizer
            opt_result = mesh_optimizer.optimize_and_validate(
                str(output_glb), str(output_preview), job.quality
            )

            # ── STAGE 5: Preview Image ───────────────────────────────────────
            print("[AI-SERVICE] Stage 5: Generating preview image...")
            job_manager.update_job(product_id, progress=95.0)

            nobg_img = nobg_images[0].copy()
            nobg_img.thumbnail((400, 300))
            canvas = Image.new("RGBA", (400, 300), color=(249, 250, 251, 255))
            w, h = nobg_img.size
            canvas.paste(nobg_img, ((400 - w) // 2, (300 - h) // 2), mask=nobg_img)
            canvas.convert("RGB").save(str(output_preview), "PNG")
            print(f"[AI-SERVICE]   Preview saved: {output_preview}")

            end_time = time.time()
            gpu_info_end = get_gpu_info()

            # Mark success before the finally block runs
            _generation_succeeded = True

            return {
                "success": True,
                "generation_time": round(end_time - start_time, 2),
                "file_size": output_glb.stat().st_size,
                "gpu_used": gpu_info_start.get("gpu_used", "Unknown"),
                "vram_usage": max(
                    gpu_info_start.get("vram_usage", 0.0),
                    gpu_info_end.get("vram_usage", 0.0),
                ),
                "texture_resolution": settings.QUALITY_PRESETS.get(
                    job.quality, settings.QUALITY_PRESETS["standard"]
                )["texture_resolution"],
                "vertices": opt_result.get("vertices", 0),
                "faces": opt_result.get("faces", 0),
            }

        finally:
            # ── Cleanup ───────────────────────────────────────────────────────
            # SUCCESS: delete the temp working directory (OBJ + texture maps).
            #          The final .glb has already been moved to STORAGE_DIR.
            # FAILURE: PRESERVE the temp directory for debugging.
            #          initial.glb and any partial textures remain on disk so
            #          the cause of Stage 3 / Stage 4 failures can be inspected.
            if _generation_succeeded:
                shutil.rmtree(temp_dir, ignore_errors=True)
            else:
                # Check whether the initial mesh exists to help the developer
                initial_glb = os.path.join(temp_dir, "initial.glb")
                if os.path.exists(initial_glb):
                    size = os.path.getsize(initial_glb)
                    print(
                        f"[AI-SERVICE] Generation failed — intermediate artifacts preserved at: {temp_dir}\n"
                        f"[AI-SERVICE]   initial.glb is available for inspection ({size} bytes): {initial_glb}\n"
                        f"[AI-SERVICE]   To clean up manually: rm -rf {temp_dir}"
                    )
                else:
                    print(
                        f"[AI-SERVICE] Generation failed — temp directory preserved at: {temp_dir}\n"
                        f"[AI-SERVICE]   (initial.glb was not yet written when the failure occurred)"
                    )
            gc.collect()
            torch.cuda.empty_cache()


hunyuan_generator = HunyuanGenerator()
