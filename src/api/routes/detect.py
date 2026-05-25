"""Image and video detection endpoints."""

from __future__ import annotations

import asyncio
import base64
import uuid
from pathlib import Path
from typing import Literal

import aiofiles
import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile

from src.api.config import get_settings
from src.api.inference.sahi_predictor import SAHIPredictor, SliceSpec
from src.api.schemas import ImageDetectResponse, VideoJobResponse

router = APIRouter(prefix="/api/detect", tags=["detection"])
settings = get_settings()

DetectMode = Literal["full", "sahi"]


async def _read_capped(file: UploadFile, limit_bytes: int) -> bytes:
    """Read an UploadFile in 1 MiB chunks, aborting before exceeding limit_bytes.

    The previous implementation called `await file.read()` which loaded the
    whole body into memory before checking its size — a 2 GB POST would OOM
    the worker. This streams and short-circuits.
    """
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(1024 * 1024):
        total += len(chunk)
        if total > limit_bytes:
            raise HTTPException(status_code=413, detail="Upload too large.")
        chunks.append(chunk)
    return b"".join(chunks)


def _annotate_and_encode(engine, raw: bytes, detections) -> str:
    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    annotated = engine.draw_detections(img, detections)
    _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buf).decode()


@router.post("/image", response_model=ImageDetectResponse)
async def detect_image(
    request: Request,
    file: UploadFile = File(...),
    mode: DetectMode = Query("full", description="full = single 640 letterbox; sahi = tiled inference for small targets"),
):
    """Run person detection on a single uploaded image.

    `mode=sahi` slices the input into overlapping 640×640 tiles before inference —
    critical for 4K aerial imagery where the median target is ~68 px and shrinks
    to ~11 px after a single letterbox to 640.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="File must be an image.")

    raw = await _read_capped(file, settings.max_upload_mb * 1024 * 1024)

    engine = request.app.state.engine
    predictor = SAHIPredictor(engine, SliceSpec(tile=engine.INPUT_SIZE, overlap=0.2)) if mode == "sahi" else engine

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, predictor.predict_bytes, raw)
    b64 = await loop.run_in_executor(None, _annotate_and_encode, engine, raw, result.detections)

    return {
        **result.to_dict(),
        "annotated_image_b64": b64,
    }


@router.post("/video", response_model=VideoJobResponse)
async def detect_video(file: UploadFile = File(...)):
    """Accept a video file and queue it for async processing."""
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=415, detail="File must be a video.")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    job_id = str(uuid.uuid4())
    # Restrict suffix to a safe allowlist — file.filename is attacker-controlled
    raw_suffix = Path(file.filename or "video.mp4").suffix.lower()
    suffix = raw_suffix if raw_suffix in {".mp4", ".mov", ".avi", ".webm", ".mkv"} else ".mp4"
    dest = upload_dir / f"{job_id}{suffix}"

    limit = settings.max_upload_mb * 1024 * 1024
    async with aiofiles.open(dest, "wb") as f:
        total = 0
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > limit:
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Video too large.")
            await f.write(chunk)

    from src.api.workers import process_video
    process_video.delay(job_id, str(dest))

    return VideoJobResponse(job_id=job_id)
