"""
Utility for finding slide files with caching to improve performance.
"""
import os

# Cache for slide file paths: (search_dir, filename) -> full_path
_path_cache = {}

def find_slide(search_dir, filename=None):
    """
    Find a slide file in the directory tree with memory caching.
    
    Args:
        search_dir: Base directory to search
        filename: Specific filename to look for. If None, returns the first slide found.
        
    Returns:
        Full absolute path to the slide or None if not found.
    """
    cache_key = (search_dir, filename)
    if cache_key in _path_cache:
        path = _path_cache[cache_key]
        if os.path.exists(path):
            return path
        else:
            del _path_cache[cache_key]

    extensions = ('.mrxs', '.svs', '.ndpi')
    
    for root, dirs, files in os.walk(search_dir):
        if filename and filename in files:
            path = os.path.join(root, filename)
            _path_cache[cache_key] = path
            return path
        
        if not filename:
            # Sort to prioritize MRXS if multiple found
            for f in sorted(files, key=lambda x: not x.lower().endswith('.mrxs')):
                if f.lower().endswith(extensions):
                    path = os.path.join(root, f)
                    _path_cache[cache_key] = path
                    return path
                    
    return None

def clear_path_cache():
    """Clear the path cache."""
    _path_cache.clear()

def evict_from_cache(filename):
    """Remove a specific file from the path cache."""
    keys_to_del = [k for k in _path_cache.keys() if k[1] == filename]
    for k in keys_to_del:
        del _path_cache[k]
