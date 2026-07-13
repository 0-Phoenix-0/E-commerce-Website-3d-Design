import torch


def get_gpu_info() -> dict:
    """Returns CUDA GPU information including allocated and reserved VRAM.

    Note: memory_reserved is the more accurate indicator of total GPU VRAM
    consumption during inference. PyTorch pre-reserves a CUDA memory pool;
    memory_allocated is the subset of that pool actively used by tensors.
    """
    if not torch.cuda.is_available():
        return {
            "gpu_used": "CPU Fallback",
            "vram_usage": 0.0,
            "vram_allocated_mb": 0.0,
            "vram_reserved_mb": 0.0,
            "cuda_available": False,
        }

    try:
        device_name = torch.cuda.get_device_name(0)

        allocated_bytes = torch.cuda.memory_allocated(0)
        reserved_bytes = torch.cuda.memory_reserved(0)

        allocated_gb = round(allocated_bytes / (1024 ** 3), 3)
        allocated_mb = round(allocated_bytes / (1024 ** 2), 1)
        reserved_mb = round(reserved_bytes / (1024 ** 2), 1)

        return {
            "gpu_used": device_name,
            "vram_usage": allocated_gb,          # GB — for backward compat
            "vram_allocated_mb": allocated_mb,   # MB — allocated by PyTorch tensors
            "vram_reserved_mb": reserved_mb,     # MB — total CUDA pool reserved
            "cuda_available": True,
        }
    except Exception as e:
        print(f"[AI-SERVICE] Failed to query GPU metrics: {e}")
        return {
            "gpu_used": "CUDA Device",
            "vram_usage": 0.0,
            "vram_allocated_mb": 0.0,
            "vram_reserved_mb": 0.0,
            "cuda_available": True,
        }

