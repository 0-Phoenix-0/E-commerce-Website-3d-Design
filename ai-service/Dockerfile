# ------------------------------------------------------------------
# PyTorch 2.7 + CUDA 12.8 (Official Blackwell / RTX 50 Support)
# ------------------------------------------------------------------
FROM pytorch/pytorch:2.7.0-cuda12.8-cudnn9-devel

WORKDIR /app

# ------------------------------------------------------------------
# Environment
# ------------------------------------------------------------------
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}
ENV LD_LIBRARY_PATH=${CUDA_HOME}/lib64:${LD_LIBRARY_PATH}

# NOTE: Do NOT set TORCH_CUDA_ARCH_LIST globally.
# "12.0" is NOT a valid arch string for PyTorch's arch list.
# The correct NVCC gencode (compute_120,code=sm_120) is set per-extension
# in setup.py. We pass the correct "12.0a" string only during rasterizer build.

# Disable pip cache to keep image lean
ENV PIP_NO_CACHE_DIR=1

# HuggingFace / model cache (matches the pytorch_cache volume in docker-compose)
ENV HF_HOME=/root/.cache/huggingface

# Hunyuan3D local weight cache: smart_load_model() looks here before HuggingFace Hub
ENV HY3DGEN_MODELS=/app/weights

# Storage directory for generated GLBs
ENV STORAGE_PATH=/app/storage

# ------------------------------------------------------------------
# System Dependencies
# ------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    cmake \
    ninja-build \
    pkg-config \
    libglib2.0-0 \
    libglib2.0-dev \
    libgl1 \
    libgl1-mesa-glx \
    libegl1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    mesa-utils \
    libopengl0 \
    libgles2-mesa-dev \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------
# Upgrade pip and wheel only
# ------------------------------------------------------------------
# Do NOT upgrade setuptools here. The base image ships triton==3.x which
# declares an unbound "setuptools" dependency. Any pip operation that
# resolves triton's deps will upgrade setuptools to 83+ (which removes
# pkg_resources). We pin setuptools AFTER all pip installs below.
RUN python -m pip install --upgrade pip wheel

# ------------------------------------------------------------------
# Install Python Requirements
# ------------------------------------------------------------------
COPY requirements.txt .
RUN pip install -r requirements.txt

# ------------------------------------------------------------------
# Copy Project Files
# ------------------------------------------------------------------
COPY . .

# ------------------------------------------------------------------
# Build Hunyuan3D CUDA Rasterizer
# "12.0a" is the correct PyTorch TORCH_CUDA_ARCH_LIST token for sm_120.
# setup.py also sets -gencode=arch=compute_120,code=sm_120 in nvcc flags.
# ------------------------------------------------------------------
RUN TORCH_CUDA_ARCH_LIST="12.0a" \
    cd /app/Hunyuan3D-2.1/hy3dpaint/custom_rasterizer && \
    pip install --no-build-isolation -e .

# ------------------------------------------------------------------
# Build Differentiable Renderer Mesh Painter
# NOTE: This .so is rebuilt at container startup via entrypoint.sh
# because the dev volume mount ./ai-service:/app shadows this output.
# ------------------------------------------------------------------
RUN cd /app/Hunyuan3D-2.1/hy3dpaint/DifferentiableRenderer && \
    bash compile_mesh_painter.sh

# ------------------------------------------------------------------
# FINAL setuptools pin — must be the last pip operation in this build.
# ------------------------------------------------------------------
# WHY THIS POSITION MATTERS:
#   triton==3.x (shipped by the pytorch base image) declares an unbound
#   "setuptools" dependency. Every pip install that resolves triton's deps
#   can upgrade setuptools to 83.0.0, which permanently removed pkg_resources.
#   Packages that import pkg_resources at runtime:
#     - pytorch-lightning==1.9.5  (via lightning_fabric / lightning_utilities)
#     - basicsr==1.4.2
#     - realesrgan==0.3.0
#   By pinning AFTER all other pip installs, no subsequent step can overwrite it.
#   Remove this pin when the above packages are updated to setuptools-82-clean versions.
RUN pip install "setuptools<82" && \
    python -c "import setuptools; v=setuptools.__version__; \
               print(f'[BUILD] setuptools {v} installed'); \
               parts=v.split('.'); major=int(parts[0]); \
               assert major < 82, f'setuptools {v} >= 82 — pkg_resources will be missing!'"

# ------------------------------------------------------------------
# Verify Installation at Build Time
# ------------------------------------------------------------------
# This step fails the build if any critical import is broken.
# Note on basicsr: it imports torchvision.transforms.functional_tensor which
# was removed in torchvision 0.16. The torchvision_fix.py in Hunyuan3D-2.1/
# monkey-patches it back. We apply that fix before testing basicsr, exactly
# as hunyuan_service.py does at runtime.
RUN python -c "\
import torch; \
print('Torch:', torch.__version__); \
print('CUDA:', torch.version.cuda); \
print('GPU Available at build:', torch.cuda.is_available()); \
print('Arch list:', torch.cuda.get_arch_list()); \
" && \
python -c "\
import pkg_resources; \
print('[BUILD] pkg_resources OK — setuptools provides it correctly'); \
" && \
python -c "\
import pytorch_lightning; \
print('[BUILD] pytorch_lightning', pytorch_lightning.__version__, 'OK'); \
" && \
python -c "\
import sys; \
sys.path.insert(0, '/app/Hunyuan3D-2.1'); \
from torchvision_fix import apply_fix; \
apply_fix(); \
import basicsr; \
print('[BUILD] basicsr OK (torchvision_fix applied)'); \
"

# ------------------------------------------------------------------
# Make entrypoint executable
# ------------------------------------------------------------------
RUN chmod +x /app/entrypoint.sh

# ------------------------------------------------------------------
# FastAPI via entrypoint (recompiles shadowed .so files before start)
# ------------------------------------------------------------------
EXPOSE 8000
CMD ["/app/entrypoint.sh"]