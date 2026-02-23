"""
ZIP file handling service for slide extraction.
"""
import os
import logging
import zipfile

from app.config import SLIDES_DIR

logger = logging.getLogger(__name__)


def extract_single_slide_zip(zip_path):
    """
    Extract a single slide zip and return the slide filename.
    Deletes the zip after extraction.
    
    Args:
        zip_path: Full path to the zip file
        
    Returns:
        List of extracted slide filenames
    """
    extracted_slides = []
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(SLIDES_DIR)
            namelist = z.namelist()
        
        os.remove(zip_path)
        logger.info(f"Extracted and deleted: {os.path.basename(zip_path)}")
        
        # Find the slide file
        for name in namelist:
            if name.lower().endswith(('.mrxs', '.svs', '.ndpi')):
                extracted_slides.append(os.path.basename(name))
            elif name.endswith('/'):
                # Directory structure = mrxs folder
                mrxs_name = name.strip('/') + ".mrxs"
                if os.path.exists(os.path.join(SLIDES_DIR, mrxs_name)):
                    extracted_slides.append(mrxs_name)
    except Exception as e:
        logger.error(f"Error extracting {zip_path}: {e}")
    
    return extracted_slides


def handle_zip_file(filename):
    """
    Smart zip handler supporting:
    - Zip of Zips: Extract outer, then extract all inner zips
    - Single Slide Zip: Extract directly
    
    Args:
        filename: Name of the zip file in SLIDES_DIR
        
    Returns:
        List of extracted slide filenames (*.mrxs, *.svs, etc.)
    """
    file_path = os.path.join(SLIDES_DIR, filename)
    if not filename.lower().endswith(".zip") or not os.path.exists(file_path):
        return [filename] if not filename.lower().endswith(".zip") else []
    
    extracted_slides = []
    inner_zips = []
    
    try:
        with zipfile.ZipFile(file_path, 'r') as outer_zip:
            contents = outer_zip.namelist()
            inner_zips = [f for f in contents if f.lower().endswith('.zip') and not f.startswith('__MACOSX')]
            
            if inner_zips:
                # --- ZIP OF ZIPS ---
                logger.info(f"Detected ZIP of ZIPs: {filename} contains {len(inner_zips)} inner zips")
                outer_zip.extractall(SLIDES_DIR)
        
        if inner_zips:
            # Delete outer zip first
            os.remove(file_path)
            logger.info(f"Deleted outer zip: {filename}")
            
            # Extract each inner zip
            for inner_name in inner_zips:
                inner_path = os.path.join(SLIDES_DIR, inner_name)
                if os.path.exists(inner_path):
                    slides = extract_single_slide_zip(inner_path)
                    extracted_slides.extend(slides)
        else:
            # --- SINGLE SLIDE ZIP ---
            slides = extract_single_slide_zip(file_path)
            extracted_slides.extend(slides)
            
    except Exception as e:
        logger.error(f"Error handling zip {filename}: {e}")
    
    logger.info(f"Total slides extracted: {len(extracted_slides)}")
    return extracted_slides
