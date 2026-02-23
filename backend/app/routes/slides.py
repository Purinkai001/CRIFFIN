"""
Slide processing routes: thumbnail, tile, process.
"""
import os
import io
import time
import json
import logging
import numpy as np
import openslide
from fastapi import APIRouter, Form, Depends
from fastapi.responses import Response, JSONResponse

from app.config import SLIDES_DIR, TILE_SIZE
from app.services.extraction import extract_features
from app.services.path_finder import find_slide
from app.dependencies import get_model

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Slides"])



@router.get("/thumbnail/{filename}")
def get_thumbnail(filename: str):
    """Get a thumbnail image of a slide."""
    # ZIP handling moved to background service or explicit /extract_batch

    file_path = find_slide(SLIDES_DIR, filename)
    if not file_path:
        file_path = find_slide(SLIDES_DIR)

    if not file_path or not os.path.exists(file_path): 
        return Response(status_code=404)
        
    try:
        os.utime(file_path, None)  # Mark as active
        slide = openslide.OpenSlide(file_path)
        thumb = slide.get_thumbnail((1024, 1024))
        slide.close()
        buf = io.BytesIO()
        thumb.save(buf, format='JPEG')
        return Response(content=buf.getvalue(), media_type="image/jpeg")
    except Exception as e:
        logger.error(f"Error getting thumbnail for {filename}: {e}")
        return JSONResponse(status_code=500, content={"error": f"Failed to read slide: {str(e)}"})


@router.get("/tile/{filename}/{x}/{y}")
def get_tile(filename: str, x: int, y: int, level: int = 0):
    """Get a tile from a specific location in the slide.
    
    Args:
        x, y: Level 0 coordinates (as stored during processing)
        level: Pyramid level to read from (0=highest res, higher=lower res)
    
    Note: Uses TILE_SIZE from config to match the size used during processing.
    """
    file_path = find_slide(SLIDES_DIR, filename)
    if not file_path:
        file_path = find_slide(SLIDES_DIR)

    if not file_path: 
        return Response(status_code=404)
        
    try:
        slide = openslide.OpenSlide(file_path)
        # Use TILE_SIZE from config to match processing tile size
        tile = slide.read_region((x, y), level, TILE_SIZE).convert("RGB")
        slide.close()
        buf = io.BytesIO()
        tile.save(buf, format='JPEG')
        return Response(content=buf.getvalue(), media_type="image/jpeg")
    except Exception as e:
        logger.error(f"Error getting tile for {filename} at ({x}, {y}): {e}")
        return JSONResponse(status_code=500, content={"error": f"Failed to read tile: {str(e)}"})


@router.post("/process")
async def process(model_info = Depends(get_model), filename: str = Form(...), query: str = Form(...), level: int = Form(1)):
    model, model_name = model_info
    logger.info(f"[/process] Request received - filename: {filename}, query: {query}, level: {level}, model: {model_name}")


    full_path = find_slide(SLIDES_DIR, filename)
    logger.info(f"[/process] Slide path resolved: {full_path}")
    if full_path:
        os.utime(full_path, None)

    t_process_start = time.time()
    embs, coords, dims, err = extract_features(filename, SLIDES_DIR, model, level, model_name)
    
    logger.info(f"[/process] extract_features result - embs: {embs is not None}, coords count: {len(coords) if coords else 0}, dims: {dims}, err: {err}")
    
    if err:
        logger.error(f"[/process] Feature extraction failed: {err}")
        return JSONResponse(status_code=400, content={"error": err})

    # Parse query input: accept a raw string, JSON string, or JSON array of strings.
    try:
        query_items = json.loads(query)
        if isinstance(query_items, str):
            query_items = [query_items]
        elif isinstance(query_items, list):
            if any(not isinstance(item, str) for item in query_items):
                return JSONResponse(
                    status_code=400,
                    content={"error": "query must be a string or an array of strings"},
                )
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "query must be a string or an array of strings"},
            )
    except json.JSONDecodeError:
        query_items = [query]  # Fallback to single string

    t_calc_start = time.time()
    
    # Process each query item
    all_query_results = []
    for item in query_items:
        # Single embedding for each query term.
        text_emb = model.embed_text(item)
        label = item
        
        # Use compute_img_txt_sims which applies logit_scale.exp()
        scores = model.compute_img_txt_sims(embs, text_emb)
        
        if scores.ndim == 0:
            scores = np.array([scores])

        results = []
        for c, s in zip(coords, scores):
            results.append({
                "x": c[0], 
                "y": c[1], 
                "score": float(s)
            })
        
        all_query_results.append({
            "query": label,
            "results": results
        })

    logger.info(f"Similarity Calc Time: {time.time() - t_calc_start:.4f}s")
    logger.info(f"Total API Time: {time.time() - t_process_start:.4f}s")

    # Return format: multiple results if array, single if not
    if len(all_query_results) == 1:
        return {"results": all_query_results[0]["results"], "width": dims[0], "height": dims[1]}
    else:
        return {"query_results": all_query_results, "width": dims[0], "height": dims[1]}
