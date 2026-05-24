"""Image and video detection endpoints."""

from __future__ import annotations

import base64
import uuid
from pathlib import Path

import aiofiles
import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from src.api.config import get_settings
from src.api.schemas import ImageDetectResponse, VideoJobResponse

router = APIRouter(prefix="/api/detect", tags=["detection"])
settings = get_settings()


@router.post("/image", response_model=ImageDetectResponse)
async def detect_image(request: Request, file: UploadFile = File(...)):
    """Run person detection on a single uploaded image."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="File must be an image.")

    raw = await file.read()
    if len(raw) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large.")

    engine = request.app.state.engine
    result = engine.predict_bytes(raw)

    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    annotated = engine.draw_detections(img, result.detections)
    _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64 = base64.b64encode(buf).decode()

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
    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    dest = upload_dir / f"{job_id}{suffix}"

    async with aiofiles.open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            await f.write(chunk)

    from src.api.workers import process_video
    process_video.delay(job_id, str(dest))

    return VideoJobResponse(job_id=job_id)
