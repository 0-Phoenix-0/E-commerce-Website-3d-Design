import threading
import time
import traceback
import datetime
from typing import List
from pathlib import Path
from config import settings
from jobs.job_manager import job_manager
from services.hunyuan_service import hunyuan_generator


workers: List[threading.Thread] = []
running = False


def _upload_to_cloudinary(product_id: str, result: dict) -> tuple[str, str]:
    """
    Upload the generated GLB and preview PNG to Cloudinary.

    Returns:
        (model_url, preview_url) — Cloudinary secure_url for both files.

    Raises:
        RuntimeError: If either upload fails.
    """
    from services.cloudinary_service import upload_glb, upload_preview

    glb_path = str(settings.STORAGE_DIR / f"{product_id}.glb")
    preview_path = str(settings.STORAGE_DIR / f"{product_id}_preview.png")

    if not Path(glb_path).exists():
        raise RuntimeError(
            f"[AI-SERVICE] GLB file not found for Cloudinary upload: {glb_path}"
        )
    if not Path(preview_path).exists():
        raise RuntimeError(
            f"[AI-SERVICE] Preview PNG not found for Cloudinary upload: {preview_path}"
        )

    # Upload GLB first
    model_url = upload_glb(product_id, glb_path)

    # Upload preview PNG
    preview_url = upload_preview(product_id, preview_path)

    return model_url, preview_url


def worker_loop():
    global running
    print("[AI-SERVICE] Background worker thread started.")
    while running:
        try:
            try:
                product_id = job_manager.task_queue.get(timeout=1.0)
            except Exception:
                continue

            print(f"[AI-SERVICE] Processing job for product: {product_id}")

            # Transition to running — job_manager.update_job will set started_at
            job_manager.update_job(product_id, status="running", progress=10.0)

            try:
                result = hunyuan_generator.run_generation(
                    product_id=product_id,
                    job_manager=job_manager
                )

                if result.get("success"):
                    # ── Stage: Upload to Cloudinary ───────────────────────────
                    # Notify frontend that we are uploading (progress 98%)
                    job_manager.update_job(
                        product_id,
                        progress=98.0,
                        stage_label="Uploading to Cloudinary",
                    )

                    try:
                        model_url, preview_url = _upload_to_cloudinary(product_id, result)

                        # Store Cloudinary URLs in the job before calling completed
                        job_manager.update_job(
                            product_id,
                            model_url=model_url,
                            preview_url=preview_url,
                        )

                        # Now mark as completed — webhook will use the Cloudinary URLs
                        job_manager.update_job(
                            product_id,
                            status="completed",
                            progress=100.0,
                            generation_time=result.get("generation_time"),
                            file_size=result.get("file_size"),
                            gpu_used=result.get("gpu_used"),
                            vram_usage=result.get("vram_usage"),
                            texture_resolution_actual=result.get("texture_resolution"),
                            vertices=result.get("vertices"),
                            faces=result.get("faces"),
                            stage_label="Completed",
                        )
                        print(
                            f"[AI-SERVICE] Generation + Cloudinary upload completed for product: {product_id} "
                            f"in {result.get('generation_time', '?')}s | GLB: {model_url}"
                        )

                    except Exception as upload_ex:
                        # Cloudinary upload failed — mark as failed, preserve local GLB
                        upload_err = f"Cloudinary upload failed: {upload_ex}"
                        print(f"[AI-SERVICE] {upload_err} (local GLB preserved at {settings.STORAGE_DIR}/{product_id}.glb)")
                        job_manager.update_job(
                            product_id,
                            status="failed",
                            stage_label="Failed",
                            error=upload_err,
                        )
                else:
                    error_msg = result.get("error", "Unknown generation error")
                    job_manager.update_job(
                        product_id,
                        status="failed",
                        stage_label="Failed",
                        error=error_msg,
                    )
                    print(f"[AI-SERVICE] Generation failed for product: {product_id}. Error: {error_msg}")

            except Exception as inner_ex:
                # Store the FULL traceback in the job error field for debugging.
                # This is what gets sent to the backend webhook and surfaced in logs.
                err_trace = traceback.format_exc()
                short_msg = f"{type(inner_ex).__name__}: {str(inner_ex)}"
                print(f"[AI-SERVICE] Fatal error in generation for product {product_id}:\n{err_trace}")
                job_manager.update_job(
                    product_id,
                    status="failed",
                    stage_label="Failed",
                    # Include the concise message + first 2000 chars of traceback
                    error=f"{short_msg}\n\nTraceback:\n{err_trace[:2000]}",
                )
            finally:
                job_manager.task_queue.task_done()

        except Exception as e:
            print(f"[AI-SERVICE] Error in worker loop: {e}")
            time.sleep(1)


def start_workers():
    global running, workers
    if running:
        return
    running = True
    workers = []
    t = threading.Thread(target=worker_loop, daemon=True, name="ai-worker-0")
    t.start()
    workers.append(t)
    print(f"[AI-SERVICE] Started {len(workers)} background worker thread(s).")


def stop_workers():
    global running, workers
    running = False
    for t in workers:
        t.join(timeout=5.0)
    workers = []
    print("[AI-SERVICE] Background worker threads stopped.")
