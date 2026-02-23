"""
Configuration and constants for the backend server.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Directories
SLIDES_DIR = os.getenv("SLIDES_DIR", "slides")

# Cleanup configuration
MAX_STORAGE_GB = 256  # Maximum size of slides folder in GB
MAX_FILE_AGE_HOURS = 99999  # Delete files older than 72 hours
CLEANUP_INTERVAL = 300  # Check every 5 minutes (seconds)

# Model configuration
HF_TOKEN = os.getenv("HF_TOKEN")

#medsiglip configuration
MEDSIGLIP_ID = "google/medsiglip-448"
MEDSIGLIP_PATH = "/shared/path_vlm/models/medsiglip"


# Processing defaults
DEFAULT_PROCESS_LEVEL = 1
TILE_SIZE = (448, 448)
BATCH_SIZE = 128
FILTER_THRESHOLD = 253  # Brightness threshold for tissue detection

# Cache configuration
CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")

# Logging configuration
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
