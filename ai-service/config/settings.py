import os
from pathlib import Path
import torch

BASE_DIR = Path(__file__).resolve().parent.parent

# ── API Settings ──────────────────────────────────────────────────────────────
PORT = int(os.getenv("PORT", 8000))
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "three-d-ai-internal-bypass-key")

# ── Storage Settings ──────────────────────────────────────────────────────────
STORAGE_DIR = Path(os.getenv("STORAGE_PATH", str(BASE_DIR / "storage")))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# ── Queue & Background Processing Settings ────────────────────────────────────
WORKER_COUNT = int(os.getenv("WORKER_COUNT", 1))
MAX_QUEUE_SIZE = int(os.getenv("MAX_QUEUE_SIZE", 100))
AUTO_GENERATE = os.getenv("AUTO_GENERATE_3D", "true").lower() == "true"

# ── GPU & Inference Settings ──────────────────────────────────────────────────
# Default config options for quality presets
QUALITY_PRESETS = {
    "draft": {
        "dit_steps": 15,
        "texture_resolution": "512x512",
        "mesh_resolution": "low",
        "simplify_ratio": 0.3
    },
    "standard": {
        "dit_steps": 25,
        "texture_resolution": "1024x1024",
        "mesh_resolution": "medium",
        "simplify_ratio": 0.6
    },
    "high": {
        "dit_steps": 50,
        "texture_resolution": "2048x2048",
        "mesh_resolution": "high",
        "simplify_ratio": 1.0
    }
}

# Auto-detect CUDA availability
CUDA_AVAILABLE = torch.cuda.is_available()
DEVICE = "cuda" if CUDA_AVAILABLE else "cpu"
GPU_NAME = torch.cuda.get_device_name(0) if CUDA_AVAILABLE else None

# Programmatic fallback preview image card
STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
FALLBACK_PREVIEW = STATIC_DIR / "default_preview.png"
if not FALLBACK_PREVIEW.exists():
    try:
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (400, 300), color=(99, 102, 241)) # indigo-500
        img.save(FALLBACK_PREVIEW)
    except Exception as e:
        print(f"Warning: Failed to generate fallback preview image: {e}")

print(f"3D AI Service Core Config Loaded:")
print(f"  - CUDA Available: {CUDA_AVAILABLE} (Device: {DEVICE}, Name: {GPU_NAME})")
print(f"  - Storage Path: {STORAGE_DIR}")
print(f"  - Workers Count: {WORKER_COUNT}")
