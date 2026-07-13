import os
from pathlib import Path
import torch

# ── Directory Layout ──────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
HUNYUAN_DIR = BASE_DIR / "Hunyuan3D-2.1"
WEIGHTS_DIR = BASE_DIR / "weights"

# ── API Settings ──────────────────────────────────────────────────────────────
PORT = int(os.getenv("PORT", 8000))
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "three-d-ai-internal-bypass-key")

# ── Cloudinary Settings ───────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
CLOUDINARY_ENABLED = bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)

# ── Storage Settings ──────────────────────────────────────────────────────────
STORAGE_DIR = Path(os.getenv("STORAGE_PATH", str(BASE_DIR / "storage")))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# ── HuggingFace Cache Settings ────────────────────────────────────────────────
# Matches the HF_HOME env var set in Dockerfile and docker-compose.
HF_HOME = os.getenv("HF_HOME", str(Path.home() / ".cache" / "huggingface"))

# ── Queue & Background Processing Settings ─────────────────────────────────────
WORKER_COUNT = int(os.getenv("WORKER_COUNT", 1))
MAX_QUEUE_SIZE = int(os.getenv("MAX_QUEUE_SIZE", 100))
WORKER_TIMEOUT = int(os.getenv("WORKER_TIMEOUT", 3600))  # seconds per job
AUTO_GENERATE = os.getenv("AUTO_GENERATE_3D", "true").lower() == "true"

# ── Quality Presets ───────────────────────────────────────────────────────────
QUALITY_VALID_VALUES = {"draft", "standard", "high"}

QUALITY_PRESETS = {
    "draft": {
        "dit_steps": 15,
        "texture_resolution": "512x512",
        "mesh_resolution": "low",
        "simplify_ratio": 0.3,
        # 192³ = 7M voxels. Fast, lower geometric detail.
        # Safe for any VRAM ≥ 4 GB.
        "octree_resolution": 192,
    },
    "standard": {
        "dit_steps": 25,
        "texture_resolution": "1024x1024",
        "mesh_resolution": "medium",
        "simplify_ratio": 0.6,
        # 256³ = 16M voxels. Good quality, safe for 7–8 GB VRAM.
        "octree_resolution": 256,
    },
    "high": {
        "dit_steps": 50,
        "texture_resolution": "2048x2048",
        "mesh_resolution": "high",
        "simplify_ratio": 1.0,
        # 320³ = 32M voxels. Production quality; 384 requires 10-16 GB VRAM.
        # 320 is the maximum safe value for 7.96 GB VRAM with cpu offload.
        "octree_resolution": 320,
    },
}

# ── GPU & CUDA Settings ───────────────────────────────────────────────────────
CUDA_AVAILABLE = torch.cuda.is_available()
DEVICE = "cuda" if CUDA_AVAILABLE else "cpu"
GPU_NAME = torch.cuda.get_device_name(0) if CUDA_AVAILABLE else None

# ── Static Assets ─────────────────────────────────────────────────────────────
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
FALLBACK_PREVIEW = STATIC_DIR / "default_preview.png"
if not FALLBACK_PREVIEW.exists():
    try:
        from PIL import Image
        img = Image.new("RGB", (400, 300), color=(99, 102, 241))  # indigo-500
        img.save(FALLBACK_PREVIEW)
    except Exception as e:
        print(f"[CONFIG] Warning: Failed to generate fallback preview image: {e}")

print("3D AI Service Core Config Loaded:")
print(f"  - CUDA Available: {CUDA_AVAILABLE} (Device: {DEVICE}, Name: {GPU_NAME})")
print(f"  - Storage Path: {STORAGE_DIR}")
print(f"  - Weights Path: {WEIGHTS_DIR}")
print(f"  - Workers Count: {WORKER_COUNT}")
