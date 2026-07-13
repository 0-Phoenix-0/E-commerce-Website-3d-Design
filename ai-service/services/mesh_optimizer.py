"""
Mesh Optimizer
==============
Post-processes the generated GLB to apply mesh simplification,
degenerate face removal, and normal correction for production use.
"""

import logging
import trimesh
import numpy as np
from PIL import Image
from config import settings

logger = logging.getLogger(__name__)


class MeshOptimizer:

    def optimize_and_validate(self, glb_path: str, preview_path: str, quality: str) -> dict:
        """Simplify and validate a GLB mesh file.

        Applies quadratic decimation, removes degenerate/duplicate faces,
        fixes normals, and validates the resulting mesh is non-empty.

        Returns:
            dict with 'vertices' and 'faces' counts.

        Raises:
            RuntimeError: if the mesh cannot be loaded or is empty after optimization.
        """
        try:
            mesh = trimesh.load(glb_path, force="mesh")
        except Exception as e:
            raise RuntimeError(
                f"[AI-SERVICE] Failed to load GLB for optimization: {glb_path}\n"
                f"Error: {e}\n"
                "This indicates the GLB assembly step failed or produced an invalid file."
            ) from e

        if not hasattr(mesh, "faces") or len(mesh.faces) == 0:
            raise RuntimeError(
                f"[AI-SERVICE] Loaded mesh has no faces: {glb_path}\n"
                "The GLB file may be empty or corrupt."
            )

        preset = settings.QUALITY_PRESETS.get(quality, settings.QUALITY_PRESETS["standard"])
        simplify_ratio = preset["simplify_ratio"]

        if simplify_ratio < 1.0:
            face_count = len(mesh.faces)
            target_faces = int(face_count * simplify_ratio)
            if target_faces > 100:
                try:
                    mesh = mesh.simplify_quadratic_decimation(target_faces)
                except Exception as e:
                    # Decimation failure is non-fatal; log and continue
                    logger.warning(
                        "[AI-SERVICE] Mesh decimation skipped (non-fatal): %s", e
                    )

        mesh.remove_degenerate_faces()
        mesh.remove_duplicate_faces()
        mesh.fix_normals()
        mesh.export(glb_path, file_type="glb")

        vertex_count = len(mesh.vertices)
        face_count = len(mesh.faces)

        if vertex_count == 0 or face_count == 0:
            raise RuntimeError(
                f"[AI-SERVICE] Mesh optimization produced an empty mesh: {glb_path}\n"
                f"vertices={vertex_count}, faces={face_count}\n"
                "The GLB export or simplification step may have failed."
            )

        logger.info(
            "[AI-SERVICE] Mesh optimized: %d vertices, %d faces (quality=%s)",
            vertex_count, face_count, quality
        )
        return {"vertices": vertex_count, "faces": face_count}


mesh_optimizer = MeshOptimizer()
