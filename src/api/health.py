"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

from src.api.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/api/health", response_model=HealthResponse)
async def health(request: Request):
    engine = request.app.state.engine
    meta = engine.metadata
    name = meta["model_path"].split("/")[-1].split("\\")[-1]
    return HealthResponse(status="ok", model=name, provider=meta["provider"])
