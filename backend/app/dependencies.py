import logging
from typing import Tuple
from fastapi import Request, Form, HTTPException

logger = logging.getLogger(__name__)

ALLOWED_MODEL = "medsiglip"


def get_model(request: Request, model_name: str = Form(ALLOWED_MODEL)) -> Tuple[object, str]:
    """Return (model, model_name) tuple for use in routes."""
    logger.info(f"[get_model] Requesting model: {model_name}")

    if model_name != ALLOWED_MODEL:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported model_name '{model_name}'. Allowed: {ALLOWED_MODEL}"
        )

    models = getattr(request.app.state, "models", {})
    model = models.get(model_name)
    if model is None:
        raise HTTPException(status_code=503, detail=f"Model '{model_name}' not loaded")
    return model, model_name


