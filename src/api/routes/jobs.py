"""Job status and result download endpoints."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from src.api.config import get_settings
from src.api.schemas import JobStatus, JobStatusResponse

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
settings = get_settings()


def _load_meta(job_id: str) -> dict:
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
    path = Path(settings.jobs_dir) / job_id / "result.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result video not found.")
    return FileResponse(path, media_type="video/mp4", filename=f"goldeneye_{job_id}.mp4")


@router.get("/{job_id}/result.csv")
async def job_result_csv(job_id: str):
    meta = _load_meta(job_id)
    if meta.get("status") != "done":
        raise HTTPException(status_code=409, detail="Job is not done yet.")
    path = Path(settings.jobs_dir) / job_id / "result.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result CSV not found.")
    return FileResponse(path, media_type="text/csv", filename=f"goldeneye_{job_id}.csv")
