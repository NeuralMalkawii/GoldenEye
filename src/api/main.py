"""GoldenEye FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.api.config import get_settings
from src.api.health import router as health_router
from src.api.inference.onnx_engine import ONNXEngine
from src.api.routes.detect import router as detect_router
from src.api.routes.jobs import router as jobs_router
from src.api.routes.models import router as models_router
from src.api.ws import router as ws_router

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    log.info("loading_model", path=settings.model_path)
    app.state.engine = ONNXEngine(
        settings.model_path,
        confidence_threshold=settings.confidence_threshold,
        nms_iou_threshold=settings.nms_iou_threshold,
    )
    log.info("model_ready", **app.state.engine.metadata)
    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="GoldenEye SAR API",
        description="Human detection API for Search & Rescue operations.",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS
    origins = [o.strip() for o in settings.cors_origins.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting
    limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Prometheus metrics at /metrics
    Instrumentator().instrument(app).expose(app, endpoint="/api/metrics")

    # Routers
    app.include_router(health_router)
    app.include_router(detect_router)
    app.include_router(jobs_router)
    app.include_router(models_router)
    app.include_router(ws_router)

    return app


app = create_app()
