"""Model registry endpoints — list and switch the active model."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from src.api.inference.onnx_engine import ONNXEngine
from src.api.schemas import ModelInfo, ModelSelectRequest, ModelSelectResponse, ModelsListResponse

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("", response_model=ModelsListResponse)
async def list_models(request: Request):
    engine: ONNXEngine = request.app.state.engine
    meta = engine.metadata
    return ModelsListResponse(
        models=[
            ModelInfo(
                name=meta["model_path"].split("/")[-1].split("\\")[-1],
                path=meta["model_path"],
                input_size=meta["input_size"],
                provider=meta["provider"],
                confidence_threshold=meta["confidence_threshold"],
                nms_iou_threshold=meta["nms_iou_threshold"],
                active=True,
            )
        ],
        active_model=meta["model_path"].split("/")[-1].split("\\")[-1],
    )


@router.post("/select", response_model=ModelSelectResponse)
async def select_model(body: ModelSelectRequest, request: Request):
    """Hot-swap the active model by name (filename in models/ directory)."""
    from pathlib import Path
    from src.api.config import get_settings

    settings = get_settings()
    candidate = Path("models") / body.name
    if not candidate.exists():
        raise HTTPException(status_code=404, detail=f"Model file '{body.name}' not found in models/.")

    engine = ONNXEngine(
        candidate,
        confidence_threshold=settings.confidence_threshold,
        nms_iou_threshold=settings.nms_iou_threshold,
    )
    request.app.state.engine = engine
    return ModelSelectResponse(active_model=body.name, message=f"Switched to {body.name}")
