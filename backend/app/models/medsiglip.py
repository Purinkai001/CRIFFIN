"""
MedSigLIP Vision-Language Model wrapper for pathology image analysis.
Matches the VLMModel interface for drop-in use with extraction/slides.
"""
import os
import logging
import numpy as np
import torch
from PIL import Image
from torchvision.transforms.functional import resize as tv_resize
from torchvision.transforms.functional import to_tensor, to_pil_image
from transformers import AutoProcessor, AutoModel
from app.config import HF_TOKEN, MEDSIGLIP_ID, MEDSIGLIP_PATH

logger = logging.getLogger(__name__)


def _torchvision_resize(image: Image.Image, size=(448, 448)) -> Image.Image:
    from torchvision.transforms import InterpolationMode
    tensor = to_tensor(image)
    resized = tv_resize(tensor, list(size), interpolation=InterpolationMode.BILINEAR, antialias=False)
    return to_pil_image(resized)


def _ensure_model_downloaded():
    if os.path.exists(os.path.join(MEDSIGLIP_PATH, "config.json")):
        logger.info(f"MedSigLIP found at {MEDSIGLIP_PATH}")
        return
    logger.info(f"MedSigLIP not found locally. Downloading {MEDSIGLIP_ID} to {MEDSIGLIP_PATH}...")
    os.makedirs(MEDSIGLIP_PATH, exist_ok=True)
    model = AutoModel.from_pretrained(MEDSIGLIP_ID, token=HF_TOKEN)
    processor = AutoProcessor.from_pretrained(MEDSIGLIP_ID, token=HF_TOKEN)
    model.save_pretrained(MEDSIGLIP_PATH)
    processor.save_pretrained(MEDSIGLIP_PATH)
    logger.info(f"MedSigLIP saved to {MEDSIGLIP_PATH}")


class MedSigLIPModel:

    def __init__(self, name: str = "medsiglip", device=None):
        self.name = name
        if device is None:
            self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self._device = device

        logger.info(f"Loading MedSigLIP on {self._device}...")
        try:
            _ensure_model_downloaded()
            self._model = AutoModel.from_pretrained(MEDSIGLIP_PATH).to(self._device)
            self._processor = AutoProcessor.from_pretrained(MEDSIGLIP_PATH)
            self._model.eval()
            logger.info("MedSigLIP loaded successfully.")
        except Exception as e:
            logger.error(f"Error loading MedSigLIP: {e}")
            raise

    @property
    def device(self):
        return self._device

    def embed_image(self, batched_image):
        resized = [_torchvision_resize(img) for img in batched_image]
        inputs = self._processor(images=resized, return_tensors="pt").to(self._device)
        with torch.inference_mode():
            image_embeds = self._model.get_image_features(**inputs)
        
        # Debug logs for user to inspect embeddings
        logger.info(f"[MedSigLIP.embed_image] Shape: {image_embeds.shape}")
        logger.info(f"[MedSigLIP.embed_image] Stats - Mean: {image_embeds.mean():.4f}, Std: {image_embeds.std():.4f}, Min: {image_embeds.min():.4f}, Max: {image_embeds.max():.4f}")
        logger.info(f"[MedSigLIP.embed_image] Norms (L2): {torch.norm(image_embeds, p=2, dim=-1).mean():.4f}")
        
        return image_embeds

    def embed_text(self, text):
        if isinstance(text, str):
            text = [text]
        inputs = self._processor(text=text, padding="max_length", return_tensors="pt").to(self._device)
        with torch.inference_mode():
            text_embeds = self._model.get_text_features(**inputs)
        
        # Debug logs for user to inspect embeddings
        logger.info(f"[MedSigLIP.embed_text] Shape: {text_embeds.shape}")
        logger.info(f"[MedSigLIP.embed_text] Stats - Mean: {text_embeds.mean():.4f}, Std: {text_embeds.std():.4f}, Min: {text_embeds.min():.4f}, Max: {text_embeds.max():.4f}")
        logger.info(f"[MedSigLIP.embed_text] Norms (L2): {torch.norm(text_embeds, p=2, dim=-1).mean():.4f}")
        
        return text_embeds

    def compute_img_txt_sims(self, img_embds, txt_embds):
        with torch.inference_mode():
            img_embds = img_embds.to(self._device)
            txt_embds = txt_embds.to(self._device)
            sim_scores = (img_embds @ txt_embds.T).cpu().numpy()
        sim_scores = np.mean(sim_scores, axis=-1)
        return sim_scores
