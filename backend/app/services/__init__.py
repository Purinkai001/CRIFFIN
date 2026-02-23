# Services package
from app.services.cache import slide_cache
from app.services.extraction import extract_features
from app.services.zip_handler import handle_zip_file, extract_single_slide_zip
from app.services.cleanup import cleanup_service, get_dir_size
