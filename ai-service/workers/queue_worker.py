import threading
import time
import traceback
from typing import List
from jobs.job_manager import job_manager
from services.hunyuan_service import hunyuan_generator

workers: List[threading.Thread] = []
running = False

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
            job_manager.update_job(product_id, status="running", progress=10.0)
            
            try:
                result = hunyuan_generator.run_generation(
                    product_id=product_id,
                    job_manager=job_manager
                )
                
                if result.get("success"):
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
                        faces=result.get("faces")
                    )
                    print(f"[AI-SERVICE] Generation completed successfully for product: {product_id}")
                else:
                    error_msg = result.get("error", "Unknown generation error")
                    job_manager.update_job(
                        product_id,
                        status="failed",
                        error=error_msg
                    )
                    print(f"[AI-SERVICE] Generation failed for product: {product_id}. Error: {error_msg}")
                    
            except Exception as inner_ex:
                err_trace = traceback.format_exc()
                print(f"[AI-SERVICE] Fatal error in generation thread: {err_trace}")
                job_manager.update_job(
                    product_id,
                    status="failed",
                    error=f"Runtime error: {str(inner_ex)}"
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
    t = threading.Thread(target=worker_loop, daemon=True)
    t.start()
    workers.append(t)

def stop_workers():
    global running, workers
    running = False
    for t in workers:
        t.join(timeout=2.0)
    workers = []
    print("[AI-SERVICE] Background worker threads stopped.")
