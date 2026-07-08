import trimesh
import numpy as np
from PIL import Image
from config import settings

class MeshOptimizer:
    def optimize_and_validate(self, glb_path: str, preview_path: str, quality: str) -> dict:
        """
        Simplifies mesh structures, normalizes face normals, and performs decimation checks.
        """
        try:
            mesh = trimesh.load(glb_path, force='mesh')
            preset = settings.QUALITY_PRESETS.get(quality, settings.QUALITY_PRESETS["standard"])
            simplify_ratio = preset["simplify_ratio"]
            
            if simplify_ratio < 1.0:
                face_count = len(mesh.faces)
                target_faces = int(face_count * simplify_ratio)
                if target_faces > 100:
                    mesh = mesh.simplify_quadratic_decimation(target_faces)
            
            mesh.remove_degenerate_faces()
            mesh.remove_duplicate_faces()
            mesh.fix_normals()
            mesh.export(glb_path, file_type='glb')
            
            return {
                "vertices": len(mesh.vertices),
                "faces": len(mesh.faces)
            }
        except Exception as e:
            print(f"[AI-SERVICE] Mesh decimation warning: {e}")
            return {"vertices": 0, "faces": 0}

    def generate_procedural_glb(self, img: Image.Image, output_glb: str, output_preview: str, quality: str) -> dict:
        """
        Procedurally designs a gradient-painted container model using Pillow-derived dominant colors.
        Saves GLB outputs and overlays centering thumbnails.
        """
        try:
            mini_img = img.resize((1, 1))
            dominant_rgb = mini_img.getpixel((0, 0))
            
            body = trimesh.creation.box(extents=[0.8, 1.2, 0.4])
            cap = trimesh.creation.icosphere(subdivisions=2, radius=0.25)
            cap.apply_translation([0, 0.6, 0])
            
            mesh = body + cap
            
            vertices_count = len(mesh.vertices)
            colors = np.zeros((vertices_count, 4), dtype=np.uint8)
            for i, vert in enumerate(mesh.vertices):
                factor = (vert[1] + 0.6) / 1.5
                r = int(dominant_rgb[0] * factor + 60 * (1 - factor))
                g = int(dominant_rgb[1] * factor + 70 * (1 - factor))
                b = int(dominant_rgb[2] * factor + 180 * (1 - factor))
                colors[i] = [min(255, max(0, r)), min(255, max(0, g)), min(255, max(0, b)), 255]
                
            mesh.visual.vertex_colors = colors
            
            preset = settings.QUALITY_PRESETS.get(quality, settings.QUALITY_PRESETS["standard"])
            simplify_ratio = preset["simplify_ratio"]
            if simplify_ratio < 1.0:
                target_faces = int(len(mesh.faces) * simplify_ratio)
                mesh = mesh.simplify_quadratic_decimation(target_faces)
                
            mesh.remove_degenerate_faces()
            mesh.remove_duplicate_faces()
            mesh.fix_normals()
            
            mesh.export(output_glb, file_type='glb')
            
            # Generate centering 2D preview
            preview_img = img.copy()
            preview_img.thumbnail((400, 300))
            canvas = Image.new("RGB", (400, 300), color=(249, 250, 251)) # slate gray background
            w, h = preview_img.size
            canvas.paste(preview_img, ((400 - w) // 2, (300 - h) // 2))
            canvas.save(output_preview)
            
            return {
                "vertices": len(mesh.vertices),
                "faces": len(mesh.faces)
            }
        except Exception as e:
            print(f"[AI-SERVICE] Procedural GLB mesh creation warning: {e}")
            try:
                fallback_mesh = trimesh.creation.box(extents=[1.0, 1.0, 1.0])
                fallback_mesh.export(output_glb, file_type='glb')
                canvas = Image.new("RGB", (400, 300), color=(255, 255, 255))
                canvas.save(output_preview)
                return {"vertices": 8, "faces": 12}
            except Exception as inner_e:
                print(f"[AI-SERVICE] Fatal fallback mesh export error: {inner_e}")
                return {"vertices": 0, "faces": 0}

mesh_optimizer = MeshOptimizer()
