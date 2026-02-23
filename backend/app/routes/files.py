"""
File management routes: upload, list, extract.
"""
import os
import shutil
import time
import asyncio
import logging
from fastapi import APIRouter, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse

from app.config import SLIDES_DIR
from app.services.zip_handler import handle_zip_file
from app.services.cache import slide_cache
from app.services.cache_warmup import cache_slide
from app.dependencies import get_model

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Files"])



@router.get("/files")
def list_files():
    """List all available slide files on the server."""
    if not os.path.exists(SLIDES_DIR):
        return {"files": []}
    
    valid_files = []
    for root, dirs, files in os.walk(SLIDES_DIR):
        for f in files:
            file_path = os.path.join(root, f)
            
            if not os.path.exists(file_path):
                continue
            
            if f.lower().endswith(('.svs', '.mrxs', '.ndpi', '.zip')):
                if f.lower().endswith('.mrxs'):
                    base_name = os.path.splitext(f)[0]
                    data_dir = os.path.join(SLIDES_DIR, base_name)
                    if not os.path.exists(data_dir) or not os.path.isdir(data_dir):
                        continue
                
                try:
                    size_mb = os.path.getsize(file_path) / (1024 * 1024)
                    valid_files.append({"name": f, "size_mb": round(size_mb, 2)})
                except OSError:
                    continue
    
    return {"files": valid_files}


@router.post("/upload_chunk")
async def upload_chunk(file: UploadFile = File(...), filename: str = Form(...)):
    """Upload a file chunk for chunked uploads."""
    t_start = time.time()
    file_path = os.path.join(SLIDES_DIR, filename)
    
    if os.path.exists(file_path):
        os.utime(file_path, None)

    with open(file_path, "ab") as f:
        shutil.copyfileobj(file.file, f)
    print(f"Upload chunk processed in {time.time() - t_start:.4f}s")
    return {"status": "ok", "filename": filename}


@router.post("/extract_batch")
async def extract_batch(filename: str = Form(...), model_info = Depends(get_model)):
    """Extract zip and auto-cache all slides at levels 1-3."""
    model, model_name = model_info
    
    if not filename.lower().endswith(".zip"):
        return JSONResponse(status_code=400, content={"error": "File must be a .zip"})
    
    extracted = handle_zip_file(filename)
    
    if not extracted:
        return JSONResponse(status_code=400, content={"error": "No slides found in zip"})
    
    for slide_name in extracted:
        asyncio.create_task(cache_slide(slide_name, model, model_name))
        logger.info(f"Queued cache task for: {slide_name} ({model_name})")
    
    slides_info = []
    for slide_name in extracted:
        slides_info.append({
            "filename": slide_name,
            "thumbnail_url": f"/thumbnail/{slide_name}"
        })
    
    return {"slides": slides_info, "count": len(slides_info)}


@router.delete("/delete_file/{filename:path}")
async def delete_file(filename: str):
    """Delete a slide file and its cache."""
    if not filename:
        return JSONResponse(status_code=400, content={"error": "Filename is required"})
    
    if ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        return JSONResponse(status_code=400, content={"error": "Invalid filename"})
    
    file_path = os.path.join(SLIDES_DIR, filename)
    
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "File not found"})
    
    try:
        slide_cache.delete(filename)
        os.remove(file_path)
        
        if filename.lower().endswith('.mrxs'):
            base_name = os.path.splitext(filename)[0]
            data_dir = os.path.join(SLIDES_DIR, base_name)
            if os.path.exists(data_dir) and os.path.isdir(data_dir):
                shutil.rmtree(data_dir)
        
        return {"status": "ok", "message": f"Successfully deleted {filename}"}
    
    except OSError as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to delete file: {str(e)}"})