#!/bin/bash
# -----------------------------------------------------------------------
# AI Service Entrypoint
#
# The docker-compose dev setup mounts the host ./ai-service directory over
# /app, which shadows any compiled .so files baked into the image during
# docker build. This script recompiles the missing extensions at container
# start before launching uvicorn.
# -----------------------------------------------------------------------
set -e

# -----------------------------------------------------------------------
# PyTorch shared libraries must be on LD_LIBRARY_PATH for compiled
# CUDA extensions (custom_rasterizer_kernel.so, mesh_inpaint_processor.so)
# to find libc10.so, libtorch.so, etc. at runtime.
# -----------------------------------------------------------------------
TORCH_LIB_DIR=$(python -c "import torch, os; print(os.path.join(os.path.dirname(torch.__file__), 'lib'))" 2>/dev/null || echo "")
if [ -n "$TORCH_LIB_DIR" ] && [ -d "$TORCH_LIB_DIR" ]; then
    export LD_LIBRARY_PATH="${TORCH_LIB_DIR}:${LD_LIBRARY_PATH}"
fi

echo "[ENTRYPOINT] AI Service starting up..."

# -----------------------------------------------------------------------
# 1. Recompile custom_rasterizer_kernel if missing
# -----------------------------------------------------------------------
RASTERIZER_DIR="/app/Hunyuan3D-2.1/hy3dpaint/custom_rasterizer"
if ! python -c "import custom_rasterizer_kernel" 2>/dev/null; then
    echo "[ENTRYPOINT] custom_rasterizer_kernel not found — recompiling..."
    cd "$RASTERIZER_DIR"
    TORCH_CUDA_ARCH_LIST="12.0a" pip install --no-build-isolation -e . --quiet
    echo "[ENTRYPOINT] custom_rasterizer_kernel compiled successfully."
else
    echo "[ENTRYPOINT] custom_rasterizer_kernel already available."
fi

# -----------------------------------------------------------------------
# 2. Recompile mesh_inpaint_processor if missing
# -----------------------------------------------------------------------
RENDERER_DIR="/app/Hunyuan3D-2.1/hy3dpaint/DifferentiableRenderer"
INPAINT_SO=$(find "$RENDERER_DIR" -name "mesh_inpaint_processor*.so" 2>/dev/null | head -1)
if [ -z "$INPAINT_SO" ]; then
    echo "[ENTRYPOINT] mesh_inpaint_processor.so not found — recompiling..."
    cd "$RENDERER_DIR"
    bash compile_mesh_painter.sh
    echo "[ENTRYPOINT] mesh_inpaint_processor compiled successfully."
else
    echo "[ENTRYPOINT] mesh_inpaint_processor already available: $INPAINT_SO"
fi

# -----------------------------------------------------------------------
# 3. Ensure storage directory exists
# -----------------------------------------------------------------------
mkdir -p "${STORAGE_PATH:-/app/storage}"

# -----------------------------------------------------------------------
# 4. Launch FastAPI service
# -----------------------------------------------------------------------
echo "[ENTRYPOINT] Launching uvicorn..."
cd /app
exec uvicorn main:app --host 0.0.0.0 --port 8000
