"""Model registry endpoints — list available .onnx files and hot-swap active model."""

from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from src.api.config import get_settings
from src.api.inference.onnx_engine import ONNXEngine
from src.api.schemas import (
    ModelInfo,
    ModelSelectRequest,
    ModelSelectResponse,
    ModelsListResponse,
)

router = APIRouter(prefix="/api/models", tags=["models"])

# Single-process lock: serialise hot-swap so a concurrent /api/models/select
# call can't replace app.state.engine while another request is mid-read.
_swap_lock = asyncio.Lock()

MODELS_DIR = Path("models")


def _active_name(engine: ONNXEngine) -> str:
    return Path(engine.metadata["model_path"]).name


def _list_files() -> list[Path]:
    if not MODELS_DIR.is_dir():
        return []
    return sorted(p for p in MODELS_DIR.glob("*.onnx") if p.is_file())


@router.get("", response_model=ModelsListResponse)
async def list_models(request: Request):
    engine: ONNXEngine = request.app.state.engine
    active = _active_name(engine)
    meta = engine.metadata

    files = _list_files()
    if not any(p.name == active for p in files):
        # Active model lives outside models/ (e.g. test fixture) — still expose it
        files = [Path(meta["model_path"]), *files]

    models = [
        ModelInfo(
            name=p.name,
            path=str(p),
            input_size=ONNXEngine.INPUT_SIZE,
            provider=meta["provider"] if p.name == active else "lazy",
            confidence_threshold=meta["confidence_threshold"],
            nms_iou_threshold=meta["nms_iou_threshold"],
            active=p.name == active,
        )
        for p in files
    ]
    return ModelsListResponse(models=models, active_model=active)


@router.post("/select", response_model=ModelSelectResponse)
async def select_model(body: ModelSelectRequest, request: Request):
    """Hot-swap the active model by filename. Serialised by _swap_lock."""
    # Reject anything that resolves outside MODELS_DIR (no traversal)
    name = Path(body.name).name
    if name != body.name or not name.endswith(".onnx"):
        raise HTTPException(status_code=400, detail="Invalid model name.")

    candidate = MODELS_DIR / name
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found in models/.")

    settings = get_settings()
    async with _swap_lock:
        loop = asyncio.get_running_loop()
        # Loading an ONNX session is sync/CPU-bound — do it off the event loop
        new_engine = await loop.run_in_executor(
            None,
            lambda: ONNXEngine(
                candidate,
                confidence_threshold=settings.confidence_threshold,
                nms_iou_threshold=settings.nms_iou_threshold,
                confidence_temperature=settings.confidence_temperature,
            ),
        )
        request.app.state.engine = new_engine

    return ModelSelectResponse(active_model=name, message=f"Switched to {name}")
