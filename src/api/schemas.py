"""Pydantic v2 request/response schemas for the GoldenEye API."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Detection / inference
# ---------------------------------------------------------------------------


class DetectionItem(BaseModel):
    bbox: list[float] = Field(..., min_length=4, max_length=4)
    confidence: float
    class_name: str


class TimingInfo(BaseModel):
    preprocess_ms: float
    inference_ms: float
    postprocess_ms: float


class ImageDetectResponse(BaseModel):
    detections: list[DetectionItem]
    count: int
    timing: TimingInfo
    annotated_image_b64: str


# ---------------------------------------------------------------------------
# Video jobs
# ---------------------------------------------------------------------------


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    done = "done"
    failed = "failed"


class VideoJobResponse(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.queued
    message: str = "Job accepted"


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: float = Field(0.0, ge=0.0, le=100.0, description="Percentage complete")
    total_frames: int = 0
    processed_frames: int = 0
    error: str | None = None
    result_mp4_url: str | None = None
    result_csv_url: str | None = None


# ---------------------------------------------------------------------------
# Models registry
# ---------------------------------------------------------------------------


class ModelInfo(BaseModel):
    name: str
    path: str
    input_size: int
    provider: str
    confidence_threshold: float
    nms_iou_threshold: float
    active: bool


class ModelsListResponse(BaseModel):
    models: list[ModelInfo]
    active_model: str


class ModelSelectRequest(BaseModel):
    name: str


class ModelSelectResponse(BaseModel):
    active_model: str
    message: str


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str
    model: str
    provider: str
    version: str = "0.1.0"


# ---------------------------------------------------------------------------
# WebSocket frames
# ---------------------------------------------------------------------------


class WSDetectionFrame(BaseModel):
    frame_id: int
    detections: list[DetectionItem]
    count: int
    timing: TimingInfo
    error: str | None = None
