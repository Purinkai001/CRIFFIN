"""
Background service to pre-cache embeddings for all slides.
Includes legacy cache migration for moving old .pt files to model subfolders.
"""
import os
import shutil
import logging
import asyncio

from app.config import SLIDES_DIR, CACHE_DIR
from app.services.cache import slide_cache
from app.services.extraction import extract_features

logger = logging.getLogger(__name__)

WARMUP_LEVELS = [1, 2, 3]
DEFAULT_MODEL = "medsiglip"


def migrate_legacy_cache():
    """Move old .pt files from cache/ root to cache/medsiglip/."""
    model_dir = os.path.join(CACHE_DIR, DEFAULT_MODEL)
    os.makedirs(model_dir, exist_ok=True)
    
    migrated = 0
    for f in os.listdir(CACHE_DIR):
        if f.endswith(".pt"):
            src = os.path.join(CACHE_DIR, f)
            dst = os.path.join(model_dir, f)
            try:
                shutil.move(src, dst)
                migrated += 1
            except Exception as e:
                logger.warning(f"Failed to migrate {f}: {e}")
    
    if migrated:
        logger.info(f"Migrated {migrated} legacy cache files to {DEFAULT_MODEL}/")


async def cache_slide(slide, model, model_name=DEFAULT_MODEL, levels=None):
    """Cache a single slide at specified levels."""
    if levels is None:
        levels = WARMUP_LEVELS
    
    for level in levels:
        if slide_cache.exists(slide, level, model_name):
            logger.debug(f"Cache exists: {slide} L{level} ({model_name})")
            continue
        
        logger.info(f"Caching: {slide} L{level} ({model_name})")
        try:
            await asyncio.to_thread(
                extract_features, slide, SLIDES_DIR, model, 
                target_level=level, model_name=model_name
            )
        except Exception as e:
            logger.error(f"Failed to cache {slide} L{level}: {e}")


async def warmup_cache(model, model_name=DEFAULT_MODEL):
    """Cache embeddings for all slides at levels 1-3."""
    migrate_legacy_cache()
    
    if not os.path.exists(SLIDES_DIR):
        logger.warning(f"Slides directory not found: {SLIDES_DIR}")
        return
    
    slides = [
        f for f in os.listdir(SLIDES_DIR)
        if f.lower().endswith(('.mrxs', '.svs', '.ndpi'))
    ]
    
    if not slides:
        logger.info("No slides found for cache warmup")
        return
    
    logger.info(f"Starting cache warmup for {len(slides)} slides (levels {WARMUP_LEVELS}, model: {model_name})")
    
    for slide in slides:
        await cache_slide(slide, model, model_name)
    
    slide_cache.log_size(model_name)
    logger.info("Cache warmup complete")
