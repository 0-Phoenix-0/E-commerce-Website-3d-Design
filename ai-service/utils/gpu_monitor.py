import torch

def get_gpu_info() -> dict:
    """
    Retrieves CUDA GPU information and active VRAM allocation in gigabytes.
    """
    if not torch.cuda.is_available():
        return {
            "gpu_used": "CPU Fallback",
            "vram_usage": 0.0,
            "cuda_available": False
        }
        
    try:
        device_name = torch.cuda.get_device_name(0)
        allocated_bytes = torch.cuda.memory_allocated(0)
        allocated_gb = round(allocated_bytes / (1024 ** 3), 2)
        return {
            "gpu_used": device_name,
            "vram_usage": allocated_gb,
            "cuda_available": True
        }
    except Exception as e:
        print(f"[AI-SERVICE] Failed to query GPU metrics: {e}")
        return {
            "gpu_used": "CUDA Device",
            "vram_usage": 0.0,
            "cuda_available": True
        }
