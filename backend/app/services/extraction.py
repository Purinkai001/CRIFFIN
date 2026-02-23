"""
Feature extraction service for whole slide images.
"""
import sys
import time
import logging
import openslide
import torch
import numpy as np
from PIL import Image

from app.config import TILE_SIZE, BATCH_SIZE, FILTER_THRESHOLD
from app.services.cache import slide_cache
from app.services.path_finder import find_slide

logger = logging.getLogger(__name__)


def extract_features(filename, slides_dir, model, target_level=1, model_name="medsiglip"):
    """
    Extract image embeddings from a whole slide image.
    Uses disk cache to avoid re-processing.
    
    Args:
        filename: Name of the slide file
        slides_dir: Directory containing slides
        model: VLM model instance
        target_level: Pyramid level to process
        model_name: Model identifier for cache subfolder
        
    Returns:
        (embeddings, coords, dimensions, error)
    """
    t_total_start = time.time()
    
    # Check cache first
    cached = slide_cache.load(filename, target_level, model_name)
    if cached:
        return cached[0], cached[1], cached[2], None
    
    file_path = find_slide(slides_dir, filename)
    if not file_path:
        return None, None, None, f"File not found: {filename}"

    logger.info(f"Extracting: {filename} at Level {target_level}")

    try:
        slide = openslide.OpenSlide(file_path)
    except Exception as e:
        return None, None, None, str(e)
    
    t_prep = time.time()
    
    proc_level = min(target_level, slide.level_count - 1)
    
    dims = slide.level_dimensions[proc_level]
    downsample = slide.level_downsamples[proc_level]
    tile_size = TILE_SIZE
    
    logger.info(f"[extract] Slide info - level_count: {slide.level_count}, proc_level: {proc_level}, dims: {dims}, downsample: {downsample}, tile_size: {tile_size}")

    try:
        thumb_dims = (2048, 2048)
        thumbnail = slide.get_thumbnail(thumb_dims).convert("L")
        mask_low_res = np.array(thumbnail) < FILTER_THRESHOLD
        logger.info(f"[extract] Tissue mask - threshold: {FILTER_THRESHOLD}, mask shape: {mask_low_res.shape}, tissue pixels: {np.sum(mask_low_res)}")
    except Exception as e:
        logger.warning(f"Could not create tissue mask: {e}, using full slide")
        mask_low_res = np.ones((2048, 2048), dtype=bool)

    grid_w = dims[0] // tile_size[0]
    grid_h = dims[1] // tile_size[1]
    logger.info(f"[extract] Grid dimensions: {grid_w}x{grid_h}")
    
    if grid_w == 0 or grid_h == 0:
        slide.close()
        logger.error(f"[extract] Grid too small: dims={dims}, tile_size={tile_size}")
        return None, None, None, f"Slide too small for tiling at level {target_level} (dims: {dims}, tile: {tile_size})"
    
    mask_pil = Image.fromarray(mask_low_res)
    mask_grid = mask_pil.resize((grid_w, grid_h), resample=Image.NEAREST)
    tissue_indices = np.argwhere(np.array(mask_grid))
    
    logger.info(f"[extract] Tissue indices count: {len(tissue_indices)}, grid: {grid_w}x{grid_h}")
    logger.info(f"Prep Time: {time.time() - t_prep:.4f}s | Level: {proc_level} | Tiles: {len(tissue_indices)}")

    batch_img = []
    batch_coord = []
    all_embs = []
    all_coords = []
    
    total_io_time = 0.0
    total_inf_time = 0.0
    total_tiles = len(tissue_indices)
    
    logger.info("-" * 60)
    logger.info(f"{'PROGRESS':<20} | {'I/O (Disk)':<15} | {'GPU (AI)':<15}")
    logger.info("-" * 60)

    for i, (gy, gx) in enumerate(tissue_indices):
        t_io_start = time.time()
        
        l0_x = int(gx * tile_size[0] * downsample)
        l0_y = int(gy * tile_size[1] * downsample)
        
        try:
            w = min(tile_size[0], dims[0] - (gx * tile_size[0]))
            h = min(tile_size[1], dims[1] - (gy * tile_size[1]))

            tile = slide.read_region((l0_x, l0_y), proc_level, (w, h)).convert("RGB")
            tile_mean = np.mean(tile)
            
            if tile_mean > FILTER_THRESHOLD:
                logger.debug(f"[extract] Skipping tile at ({gx},{gy}) - mean: {tile_mean:.1f} > threshold: {FILTER_THRESHOLD}")
                total_io_time += (time.time() - t_io_start)
                continue
            
            if w != tile_size[0] or h != tile_size[1]:
                bg = Image.new('RGB', tile_size, (255, 255, 255))
                bg.paste(tile, (0, 0))
                tile = bg

            batch_img.append(tile)
            batch_coord.append((l0_x, l0_y))
        except Exception as e:
            logger.debug(f"Skipped tile at ({gx}, {gy}): {e}")

        total_io_time += (time.time() - t_io_start)

        if len(batch_img) >= BATCH_SIZE or (i == total_tiles - 1 and len(batch_img) > 0):
            t_inf_start = time.time()
            embs = model.embed_image(batch_img)
            all_embs.append(embs.cpu()) 
            all_coords.extend(batch_coord)
            batch_img = []
            batch_coord = []
            total_inf_time += (time.time() - t_inf_start)

            percent = int((i + 1) / total_tiles * 100)
            bar_len = 20
            filled = int(bar_len * percent / 100)
            bar = '█' * filled + '-' * (bar_len - filled)
            
            sys.stdout.write(f"\r|{bar}| {percent}% | {total_io_time:.2f}s        | {total_inf_time:.2f}s")
            sys.stdout.flush()

    slide.close()
    logger.info("")
    logger.info("-" * 60)
    logger.info(f"Total Wall Time: {time.time() - t_total_start:.4f}s")
    logger.info(f"Total I/O Time : {total_io_time:.4f}s")
    logger.info(f"Total GPU Time : {total_inf_time:.4f}s")

    if not all_embs:
        logger.error(f"[extract] No embeddings generated - all tiles skipped. total_tiles: {total_tiles}")
        return None, None, None, f"No tissue found (all {total_tiles} tiles were filtered out)"

    embeddings = torch.cat(all_embs, dim=0)
    dimensions = (int(dims[0] * downsample), int(dims[1] * downsample))
    
    slide_cache.save(filename, target_level, embeddings, all_coords, dimensions, model_name)

    return embeddings, all_coords, dimensions, None
