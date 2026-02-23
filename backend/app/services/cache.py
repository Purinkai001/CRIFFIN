"""
Disk-based cache for slide embeddings using PyTorch serialization.
Supports model-specific subfolders (e.g., cache/medsiglip/).
"""
import os
import logging
import threading
import torch

from app.config import CACHE_DIR

logger = logging.getLogger(__name__)


class DiskCache:
    """Thread-safe persistent disk cache for slide embeddings."""
    
    def __init__(self, cache_dir=CACHE_DIR):
        self.cache_dir = cache_dir
        self._locks = {}
        self._global_lock = threading.Lock()
        os.makedirs(cache_dir, exist_ok=True)
    
    def _get_lock(self, filename, level, model_name):
        """Get or create a lock for a specific cache entry."""
        key = f"{model_name}:{filename}:{level}"
        with self._global_lock:
            if key not in self._locks:
                self._locks[key] = threading.Lock()
            return self._locks[key]
    
    def _make_path(self, filename, level, model_name="medsiglip"):
        """Build cache path: cache/{model_name}/{slide}_L{level}.pt"""
        safe_name = filename.replace("/", "_").replace("\\", "_")
        model_dir = os.path.join(self.cache_dir, model_name)
        os.makedirs(model_dir, exist_ok=True)
        return os.path.join(model_dir, f"{safe_name}_L{level}.pt")
    
    def exists(self, filename, level, model_name="medsiglip"):
        """Check if cache exists for a slide at given level."""
        return os.path.exists(self._make_path(filename, level, model_name))
    
    def load(self, filename, level, model_name="medsiglip"):
        """Load cached embeddings. Returns (embeddings, coords, dimensions) or None."""
        path = self._make_path(filename, level, model_name)
        
        with self._get_lock(filename, level, model_name):
            if os.path.exists(path):
                try:
                    data = torch.load(path, weights_only=False)
                    logger.debug(f"Cache HIT: {filename} L{level} ({model_name})")
                    return (data["embeddings"], data["coords"], data["dimensions"])
                except Exception as e:
                    logger.warning(f"Cache load failed for {filename} L{level}: {e}")
                    return None
        return None
    
    def save(self, filename, level, embeddings, coords, dimensions, model_name="medsiglip"):
        """Save embeddings to disk cache (thread-safe)."""
        path = self._make_path(filename, level, model_name)
        
        with self._get_lock(filename, level, model_name):
            if os.path.exists(path):
                logger.debug(f"Cache already exists: {filename} L{level}")
                return
            
            try:
                torch.save({
                    "embeddings": embeddings,
                    "coords": coords,
                    "dimensions": dimensions
                }, path)
                logger.debug(f"Cache SAVE: {filename} L{level} ({model_name})")
                self.log_size(model_name)
            except Exception as e:
                logger.error(f"Cache save failed for {filename} L{level}: {e}")
    
    def delete(self, filename, model_name=None):
        """Delete cache files for a slide. If model_name is None, deletes from all models."""
        safe_name = filename.replace("/", "_").replace("\\", "_")
        deleted = 0
        
        if model_name:
            model_dirs = [os.path.join(self.cache_dir, model_name)]
        else:
            model_dirs = [
                os.path.join(self.cache_dir, d) 
                for d in os.listdir(self.cache_dir) 
                if os.path.isdir(os.path.join(self.cache_dir, d))
            ]
        
        for model_dir in model_dirs:
            if not os.path.exists(model_dir):
                continue
            for f in os.listdir(model_dir):
                if f.startswith(safe_name + "_L"):
                    try:
                        os.remove(os.path.join(model_dir, f))
                        deleted += 1
                    except Exception as e:
                        logger.warning(f"Failed to delete cache file {f}: {e}")
        
        if deleted:
            logger.info(f"Cache DELETE: {filename} ({deleted} files)")
    
    def log_size(self, model_name="medsiglip"):
        """Log cache folder size for a specific model."""
        try:
            model_dir = os.path.join(self.cache_dir, model_name)
            if not os.path.exists(model_dir):
                return
            total = sum(
                os.path.getsize(os.path.join(model_dir, f))
                for f in os.listdir(model_dir)
                if os.path.isfile(os.path.join(model_dir, f))
            )
            file_count = len([f for f in os.listdir(model_dir) if f.endswith('.pt')])
            logger.info(f"Cache size ({model_name}): {total / (1024**2):.2f} MB ({file_count} files)")
        except Exception as e:
            logger.warning(f"Failed to calculate cache size: {e}")


slide_cache = DiskCache()
