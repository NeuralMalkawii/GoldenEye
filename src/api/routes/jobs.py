"""Job status and result download endpoints."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from src.api.config import get_settings
from src.api.schemas import JobStatus, JobStatusResponse

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
settings = get_settings()


def _validate_job_id(job_id: str) -> str:
    """Reject anything that isn't a well-formed UUID before any path join.

    The job_id is user-controlled via the URL; without this check a request
    like /api/jobs/..%2F..%2Fetc/result.mp4 could escape the jobs directory.
    """
    try:
        return str(uuid.UUID(job_id))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid job id.")


def _load_meta(job_id: str) -> dict:
    job_id = _validate_job_id(job_id)
    meta_path = Path(settings.jobs_dir) / job_id / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return json.loads(meta_path.read_text())


@router.get("/{job_id}", response_model=JobStatusResponse)
async def job_status(job_id: str):
    meta = _load_meta(job_id)
    return JobStatusResponse(**meta)


@router.get("/{job_id}/result.mp4")
async def job_result_video(job_id: str):
    meta = _load_meta(job_id)
    if meta.get("status") != "done":
        raise HTTPException(status_code=409, detail="Job is not done yet.")
    job_id = _validate_job_id(job_id)
    path = Path(settings.jobs_dir) / job_id / "result.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result video not found.")
    return FileResponse(path, media_type="video/mp4", filename=f"goldeneye_{job_id}.mp4")


@router.get("/{job_id}/result.csv")
async def job_result_csv(job_id: str):
    meta = _load_meta(job_id)
    if meta.get("status") != "done":
        raise HTTPException(status_code=409, detail="Job is not done yet.")
    job_id = _validate_job_id(job_id)
    path = Path(settings.jobs_dir) / job_id / "result.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result CSV not found.")
    return FileResponse(path, media_type="text/csv", filename=f"goldeneye_{job_id}.csv")
