"""
Background cleanup service for managing disk space.
"""
import os
import time
import asyncio
import shutil
import logging

from app.config import SLIDES_DIR, MAX_STORAGE_GB, MAX_FILE_AGE_HOURS, CLEANUP_INTERVAL
from app.services.cache import slide_cache
from app.services.zip_handler import handle_zip_file
from app.services.path_finder import evict_from_cache

logger = logging.getLogger(__name__)

# Incomplete uploads older than this are considered abandoned
INCOMPLETE_UPLOAD_MAX_AGE_HOURS = 1.0


def get_dir_size(path):
    """Calculate total size of a directory in bytes."""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size


def _delete_slide_with_data(filepath, filename):
    """
    Delete a slide file and its associated data directory (for MRXS files).
    Also evicts from caches.
    
    Args:
        filepath: Full path to the slide file
        filename: Base filename of the slide
        
    Returns:
        Size freed in bytes (including data directory if MRXS)
    """
    size_freed = 0
    
    try:
        if os.path.isfile(filepath):
            size_freed = os.path.getsize(filepath)
            os.remove(filepath)
            logger.info(f"Removed file: {filename}")
    except Exception as e:
        logger.error(f"Error removing file {filename}: {e}")
        return 0
    
    # Evict from caches
    evict_from_cache(filename)
    if filename.lower().endswith(('.svs', '.mrxs', '.ndpi')):
        slide_cache.evict_by_filename(filename)
    
    # MRXS cascade: remove associated data directory
    if filename.lower().endswith('.mrxs'):
        base_name = os.path.splitext(filename)[0]
        dir_path = os.path.join(SLIDES_DIR, base_name)
        if os.path.exists(dir_path) and os.path.isdir(dir_path):
            try:
                dir_size = get_dir_size(dir_path)
                shutil.rmtree(dir_path)
                size_freed += dir_size
                logger.info(f"Removed MRXS data directory: {base_name}")
            except Exception as e:
                logger.error(f"Error removing MRXS data dir {base_name}: {e}")
    
    return size_freed


def cleanup_incomplete_uploads():
    """
    Remove stale .zip files that were likely abandoned mid-upload.
    If a .zip file hasn't been modified in INCOMPLETE_UPLOAD_MAX_AGE_HOURS,
    it's probably an incomplete upload or failed extraction.
    
    Returns:
        Number of files removed
    """
    if not os.path.exists(SLIDES_DIR):
        return 0
    
    current_time = time.time()
    removed_count = 0
    
    for f in os.listdir(SLIDES_DIR):
        if f.lower().endswith('.zip'):
            fp = os.path.join(SLIDES_DIR, f)
            if os.path.isfile(fp):
                try:
                    mtime = os.path.getmtime(fp)
                    age_hours = (current_time - mtime) / 3600
                    
                    if age_hours > INCOMPLETE_UPLOAD_MAX_AGE_HOURS:
                        os.remove(fp)
                        removed_count += 1
                        logger.info(f"Removed stale zip {f} (Age: {age_hours:.1f}h)")
                except Exception as e:
                    logger.error(f"Error removing stale zip {f}: {e}")
    
    if removed_count > 0:
        logger.info(f"Removed {removed_count} incomplete/stale zip files")
    
    return removed_count


async def cleanup_service():
    """Background task to remove old or excess files."""
    logger.info(f"Cleanup service started. Storage limit: {MAX_STORAGE_GB}GB")
    while True:
        try:
            if not os.path.exists(SLIDES_DIR):
                await asyncio.sleep(CLEANUP_INTERVAL)
                continue

            current_time = time.time()
            
            # --- 0. Clean up incomplete/abandoned uploads first ---
            cleanup_incomplete_uploads()
            
            all_items = os.listdir(SLIDES_DIR)
            
            # --- 1. Automatic ZIP Extraction ---
            for item in all_items:
                if item.lower().endswith('.zip'):
                    logger.info(f"Auto-extracting {item}")
                    try:
                        handle_zip_file(item)
                        # Refresh items after extraction
                        all_items = os.listdir(SLIDES_DIR)
                    except Exception as e:
                        logger.error(f"Failed to extract {item}: {e}")

            # --- 2. Age-based Cleanup ---
            slide_files = {f for f in all_items if f.lower().endswith(('.svs', '.mrxs', '.ndpi'))}
            
            for item in all_items:
                item_path = os.path.join(SLIDES_DIR, item)
                should_delete = False
                reason = ""
                
                try:
                    mtime = os.path.getmtime(item_path)
                    age_hours = (current_time - mtime) / 3600
                    
                    if age_hours > MAX_FILE_AGE_HOURS:
                        should_delete = True
                        reason = f"Expired ({age_hours:.1f}h > {MAX_FILE_AGE_HOURS}h)"
                    
                    if os.path.isdir(item_path):
                        is_slide_data_dir = False
                        for sf in slide_files:
                            if sf.startswith(item) or item.startswith(os.path.splitext(sf)[0]):
                                is_slide_data_dir = True
                                break
                        
                        if is_slide_data_dir and not should_delete:
                            continue
                        
                        if not is_slide_data_dir and age_hours > MAX_FILE_AGE_HOURS:
                             should_delete = True
                             reason = f"Orphaned Directory & Expired ({age_hours:.1f}h)"

                    if should_delete:
                        if os.path.isfile(item_path):
                            _delete_slide_with_data(item_path, item)
                            logger.info(f"Removed {item} - {reason}")
                        elif os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                            logger.info(f"Removed directory {item} - {reason}")
                except Exception as e:
                    logger.error(f"Error processing {item}: {e}")

            # --- 3. Storage Limit Enforcement ---
            current_size = get_dir_size(SLIDES_DIR)
            max_size_bytes = MAX_STORAGE_GB * 1024 * 1024 * 1024
            
            if current_size > max_size_bytes:
                logger.warning(f"Storage limit exceeded ({current_size/1024**3:.2f}GB > {MAX_STORAGE_GB}GB). Removing oldest files.")
                
                # Get all files with their mtime
                files = []
                for f in os.listdir(SLIDES_DIR):
                    fp = os.path.join(SLIDES_DIR, f)
                    if os.path.isfile(fp):
                        files.append((fp, f, os.path.getmtime(fp)))
                
                # Sort by mtime (oldest first)
                files.sort(key=lambda x: x[2])
                
                for fp, filename, mtime in files:
                    if current_size <= max_size_bytes:
                        break
                    
                    try:
                        size_freed = _delete_slide_with_data(fp, filename)
                        current_size -= size_freed
                        logger.info(f"Removed {filename} to free space ({size_freed / 1024**2:.1f}MB)")
                    except Exception as e:
                        logger.error(f"Error freeing space with {filename}: {e}")

        except Exception as e:
            logger.error(f"Cleanup loop error: {e}")

        await asyncio.sleep(CLEANUP_INTERVAL)

