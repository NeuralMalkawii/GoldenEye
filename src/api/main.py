"""GoldenEye FastAPI application factory."""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
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

# JSON output so Railway/Grafana can index fields directly
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    log.info("loading_model", path=settings.model_path)
    app.state.engine = ONNXEngine(
        settings.model_path,
        confidence_threshold=settings.confidence_threshold,
        nms_iou_threshold=settings.nms_iou_threshold,
        confidence_temperature=settings.confidence_temperature,
    )
    log.info("model_ready", **app.state.engine.metadata)
    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    # Sentry — opt-in: nothing initialises and no SDK overhead unless DSN is set.
    if settings.sentry_dsn:
        try:
            import sentry_sdk

            sentry_sdk.init(
                dsn=settings.sentry_dsn,
                traces_sample_rate=0.1,
                profiles_sample_rate=0.1,
                send_default_pii=False,
            )
            log.info("sentry_enabled")
        except ImportError:
            log.warning("sentry_dsn_set_but_sdk_missing")

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

    # Structured request logging — one JSON line per request, Grafana-indexable.
    # Sits before instrumentator so Prometheus and logs see the same event.
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        t0 = time.perf_counter()
        response = await call_next(request)
        dur_ms = (time.perf_counter() - t0) * 1000
        log.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            ms=round(dur_ms, 1),
            client=request.client.host if request.client else None,
        )
        return response

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
