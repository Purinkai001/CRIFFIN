"""
FastAPI application setup and configuration.
"""
import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import SLIDES_DIR
from app.models.medsiglip import MedSigLIPModel
from app.services.cleanup import cleanup_service
from app.services.cache_warmup import warmup_cache
from app.routes import files, slides, deepzoom, query

logger = logging.getLogger(__name__)




@asynccontextmanager
async def lifespan(app: FastAPI):
    
    # Startup
    if not os.path.exists(SLIDES_DIR):
        os.makedirs(SLIDES_DIR)
    
    logger.info("Server starting... initializing models.")
    app.state.models = {}
    try:
        app.state.models["medsiglip"] = MedSigLIPModel(name="medsiglip")
    except Exception as e:
        logger.error(f"MedSigLIP failed to load: {e}")

    
    cleanup_task = asyncio.create_task(cleanup_service())
    warmup_task = asyncio.create_task(
        warmup_cache(app.state.models.get("medsiglip"), model_name="medsiglip")
    )
    
    yield
    
    # Shutdown
    cleanup_task.cancel()
    logger.info("Server shutting down.")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Pathology VLM API",
        description="Vision-Language Model API for whole slide image analysis",
        version="2.0.0",
        lifespan=lifespan
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/", tags=["Health"])
    def health_check():
        models = getattr(app.state, "models", {})
        return {"status": "active", "models_loaded": list(models.keys())}

    # Include routers
    app.include_router(files.router)
    app.include_router(slides.router)
    app.include_router(deepzoom.router)
    app.include_router(query.router)

    return app


# Create the app instance
app = create_app()
