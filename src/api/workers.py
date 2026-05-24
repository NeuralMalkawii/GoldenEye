"""Celery tasks for async video processing."""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path

import cv2
from celery import Celery

from src.api.config import get_settings
from src.api.inference.onnx_engine import ONNXEngine

settings = get_settings()

app = Celery("goldeneye", broker=settings.redis_url, backend=settings.redis_url)
app.conf.update(task_track_started=True, result_expires=3600)

_engine: ONNXEngine | None = None


def _get_engine() -> ONNXEngine:
    global _engine
    if _engine is None:
        _engine = ONNXEngine(
            settings.model_path,
            confidence_threshold=settings.confidence_threshold,
            nms_iou_threshold=settings.nms_iou_threshold,
        )
    return _engine


@app.task(bind=True)
def process_video(self, job_id: str, input_path: str) -> dict:
    """Process a video file frame-by-frame and write annotated output + CSV."""
    jobs_dir = Path(settings.jobs_dir) / job_id
    jobs_dir.mkdir(parents=True, exist_ok=True)

    meta_path = jobs_dir / "meta.json"
    out_video_path = jobs_dir / "result.mp4"
    out_csv_path = jobs_dir / "result.csv"

    cap = cv2.VideoCapture(input_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_video_path), fourcc, fps, (width, height))

    engine = _get_engine()
    rows: list[dict] = []

    def _update_meta(status: str, processed: int, error: str | None = None) -> None:
        data = {
            "job_id": job_id,
            "status": status,
            "total_frames": total_frames,
            "processed_frames": processed,
            "progress": round(processed / max(total_frames, 1) * 100, 1),
            "error": error,
            "result_mp4_url": f"/api/jobs/{job_id}/result.mp4" if status == "done" else None,
            "result_csv_url": f"/api/jobs/{job_id}/result.csv" if status == "done" else None,
        }
        meta_path.write_text(json.dumps(data))
        self.update_state(state="PROGRESS", meta=data)

    _update_meta("processing", 0)
    processed = 0

    try:
        with open(out_csv_path, "w", newline="") as csvfile:
            writer_csv = csv.DictWriter(
                csvfile,
                fieldnames=["frame", "x1", "y1", "x2", "y2", "confidence"],
            )
            writer_csv.writeheader()

            while True:
                ok, frame = cap.read()
                if not ok:
                    break

                result = engine.predict(frame)
                annotated = engine.draw_detections(frame, result.detections)
                writer.write(annotated)

                for det in result.detections:
                    writer_csv.writerow(
                        {
                            "frame": processed,
                            "x1": det.x1,
                            "y1": det.y1,
                            "x2": det.x2,
                            "y2": det.y2,
                            "confidence": det.confidence,
                        }
                    )

                processed += 1
                if processed % 30 == 0:
                    _update_meta("processing", processed)

    finally:
        cap.release()
        writer.release()

    _update_meta("done", processed)
    return {"job_id": job_id, "processed_frames": processed}
