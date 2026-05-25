"""Integration tests for all GoldenEye FastAPI endpoints."""

from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
import pytest
import cv2


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _jpeg(h=480, w=640) -> bytes:
    img = np.full((h, w, 3), 128, dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def _mp4_stub() -> bytes:
    """Minimal valid MP4 header bytes — enough to pass content-type check."""
    # 16-byte ftyp box: length(4) + 'ftyp'(4) + 'mp42'(4) + 0(4)
    return b"\x00\x00\x00\x10ftyp" + b"mp42" + b"\x00" * 4 + b"\x00" * 256


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

class TestHealth:
    def test_status_ok(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"

    def test_model_field(self, client):
        r = client.get("/api/health")
        assert "model" in r.json()

    def test_provider_field(self, client):
        r = client.get("/api/health")
        assert "provider" in r.json()

    def test_version_field(self, client):
        r = client.get("/api/health")
        assert "version" in r.json()


# ---------------------------------------------------------------------------
# /api/detect/image
# ---------------------------------------------------------------------------

class TestDetectImage:
    def test_returns_200(self, client):
        r = client.post(
            "/api/detect/image",
            files={"file": ("test.jpg", _jpeg(), "image/jpeg")},
        )
        assert r.status_code == 200

    def test_response_schema(self, client):
        r = client.post(
            "/api/detect/image",
            files={"file": ("test.jpg", _jpeg(), "image/jpeg")},
        )
        body = r.json()
        assert "detections" in body
        assert "count" in body
        assert "timing" in body
        assert "annotated_image_b64" in body

    def test_count_matches_detections_length(self, client):
        r = client.post(
            "/api/detect/image",
            files={"file": ("test.jpg", _jpeg(), "image/jpeg")},
        )
        body = r.json()
        assert body["count"] == len(body["detections"])

    def test_timing_fields_present(self, client):
        r = client.post(
            "/api/detect/image",
            files={"file": ("test.jpg", _jpeg(), "image/jpeg")},
        )
        timing = r.json()["timing"]
        for key in ("preprocess_ms", "inference_ms", "postprocess_ms"):
            assert key in timing
            assert timing[key] >= 0

    def test_annotated_image_is_base64(self, client):
        import base64
        r = client.post(
            "/api/detect/image",
            files={"file": ("test.jpg", _jpeg(), "image/jpeg")},
        )
        b64 = r.json()["annotated_image_b64"]
        # Must be valid base64
        decoded = base64.b64decode(b64)
        assert len(decoded) > 0

    def test_detection_bbox_format(self, client):
        """Each detection must have bbox as [x1,y1,x2,y2] and a confidence."""
        r = client.post(
            "/api/detect/image",
            files={"file": ("test.jpg", _jpeg(), "image/jpeg")},
        )
        for det in r.json()["detections"]:
            assert "bbox" in det
            assert len(det["bbox"]) == 4
            assert "confidence" in det
            assert 0.0 <= det["confidence"] <= 1.0
            assert det["class_name"] == "person"

    def test_non_image_rejected(self, client):
        r = client.post(
            "/api/detect/image",
            files={"file": ("doc.pdf", b"%PDF", "application/pdf")},
        )
        assert r.status_code == 415

    def test_png_accepted(self, client, blank_png_bytes):
        r = client.post(
            "/api/detect/image",
            files={"file": ("test.png", blank_png_bytes, "image/png")},
        )
        assert r.status_code == 200

    def test_4k_image(self, client):
        """Large image (4K) must succeed within a reasonable time."""
        big = np.full((2160, 3840, 3), 100, dtype=np.uint8)
        _, buf = cv2.imencode(".jpg", big)
        r = client.post(
            "/api/detect/image",
            files={"file": ("big.jpg", buf.tobytes(), "image/jpeg")},
        )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# /api/detect/video  (upload only — Celery worker not running in tests)
# ---------------------------------------------------------------------------

class TestDetectVideo:
    def test_non_video_rejected(self, client):
        r = client.post(
            "/api/detect/video",
            files={"file": ("test.jpg", _jpeg(), "image/jpeg")},
        )
        assert r.status_code == 415

    def test_video_upload_queues_job(self, client, monkeypatch):
        """Video upload must return a job_id; Celery call is mocked."""
        from unittest.mock import MagicMock
        import src.api.workers as workers_module

        mock_task = MagicMock()
        mock_task.delay = MagicMock()
        monkeypatch.setattr(workers_module, "process_video", mock_task)

        r = client.post(
            "/api/detect/video",
            files={"file": ("clip.mp4", _mp4_stub(), "video/mp4")},
        )
        assert r.status_code == 200
        body = r.json()
        assert "job_id" in body
        assert len(body["job_id"]) == 36  # UUID4


# ---------------------------------------------------------------------------
# /api/jobs/{job_id}
# ---------------------------------------------------------------------------

class TestJobs:
    def test_unknown_job_returns_404(self, client):
        r = client.get("/api/jobs/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404

    def test_result_mp4_unknown_job_404(self, client):
        r = client.get("/api/jobs/00000000-0000-0000-0000-000000000000/result.mp4")
        assert r.status_code == 404

    def test_result_csv_unknown_job_404(self, client):
        r = client.get("/api/jobs/00000000-0000-0000-0000-000000000000/result.csv")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# /api/models
# ---------------------------------------------------------------------------

class TestModels:
    def test_returns_200(self, client):
        r = client.get("/api/models")
        assert r.status_code == 200

    def test_response_has_models_list(self, client):
        body = r = client.get("/api/models").json()
        assert "models" in body
        assert isinstance(body["models"], list)

    def test_active_model_field(self, client):
        body = client.get("/api/models").json()
        assert "active_model" in body

    def test_model_entry_schema(self, client):
        models = client.get("/api/models").json()["models"]
        assert len(models) >= 1
        m = models[0]
        for key in ("name", "path", "input_size", "provider", "confidence_threshold", "active"):
            assert key in m


# ---------------------------------------------------------------------------
# /api/metrics  (Prometheus)
# ---------------------------------------------------------------------------

class TestMetrics:
    def test_metrics_endpoint_ok(self, client):
        r = client.get("/api/metrics")
        assert r.status_code == 200
        assert "http_requests" in r.text or "goldeneye" in r.text or "process_" in r.text


# ---------------------------------------------------------------------------
# /ws/live — WebSocket live detection
# ---------------------------------------------------------------------------

class TestWebSocketLive:
    def test_connection_accepts(self, client):
        with client.websocket_connect("/ws/live") as ws:
            assert ws is not None

    def test_single_frame_returns_detection_schema(self, client):
        with client.websocket_connect("/ws/live") as ws:
            ws.send_bytes(_jpeg())
            msg = ws.receive_json()
            assert msg["frame_id"] == 0
            assert "detections" in msg
            assert "count" in msg
            assert msg["count"] == len(msg["detections"])
            for key in ("preprocess_ms", "inference_ms", "postprocess_ms"):
                assert key in msg["timing"]

    def test_frame_ids_increment(self, client):
        with client.websocket_connect("/ws/live") as ws:
            for _ in range(3):
                ws.send_bytes(_jpeg())
            ids = [ws.receive_json()["frame_id"] for _ in range(3)]
            assert ids == [0, 1, 2]

    def test_invalid_bytes_yields_error_frame(self, client):
        """Garbage bytes should not kill the connection — engine raises, handler reports."""
        with client.websocket_connect("/ws/live") as ws:
            ws.send_bytes(b"not-a-jpeg")
            msg = ws.receive_json()
            assert msg["count"] == 0
            assert msg["error"] is not None


# ---------------------------------------------------------------------------
# Path traversal — job_id must be a valid UUID
# ---------------------------------------------------------------------------

class TestJobIdValidation:
    @pytest.mark.parametrize("bad_id", [
        "../etc/passwd",
        "..%2F..%2Fetc",
        "not-a-uuid",
        "00000000-XXXX-0000-0000-000000000000",
    ])
    def test_bad_job_id_rejected(self, client, bad_id):
        r = client.get(f"/api/jobs/{bad_id}")
        # Either 400 (invalid) or 404 (escaped chars hit a route that doesn't exist)
        assert r.status_code in (400, 404)

    def test_bad_job_id_on_mp4_rejected(self, client):
        r = client.get("/api/jobs/not-a-uuid/result.mp4")
        assert r.status_code in (400, 404)


# ---------------------------------------------------------------------------
# Image upload size cap — 413 before OOM
# ---------------------------------------------------------------------------

class TestImageSizeCap:
    def test_oversize_image_rejected_413(self, client, monkeypatch):
        """Upload larger than max_upload_mb must return 413 before reading whole body."""
        # Shrink the cap to 1 MB so the test stays fast
        from src.api import config, routes
        settings = config.get_settings()
        monkeypatch.setattr(settings, "max_upload_mb", 1)
        # Routes import settings at module-load time, so patch there too
        monkeypatch.setattr(routes.detect.settings, "max_upload_mb", 1)

        big = b"\xff" * (2 * 1024 * 1024)  # 2 MB of junk, content-type=image is enough
        r = client.post(
            "/api/detect/image",
            files={"file": ("big.jpg", big, "image/jpeg")},
        )
        assert r.status_code == 413


# ---------------------------------------------------------------------------
# Model regression: known positive image must detect >= 1 person
# ---------------------------------------------------------------------------

def _find_known_positive() -> Path | None:
    """Locate a known-positive test image, in portability order.

    Priority:
      1. tests/fixtures/known_positive.jpg  (committed to repo, runs in CI)
      2. $GOLDENEYE_REGRESSION_IMAGE        (env override for local dev)
      3. The original Windows dev path      (back-compat)
    """
    import os

    bundled = Path(__file__).parent / "fixtures" / "known_positive.jpg"
    if bundled.exists():
        return bundled

    env = os.environ.get("GOLDENEYE_REGRESSION_IMAGE")
    if env and Path(env).exists():
        return Path(env)

    legacy = Path(r"C:\Users\Omar\Documents\Claude\Projects\Capstone\Datasets\real_data\images\test\human_0004282761.jpg")
    if legacy.exists():
        return legacy

    return None


_KNOWN_POSITIVE = _find_known_positive()


@pytest.mark.skipif(
    _KNOWN_POSITIVE is None,
    reason="No regression fixture — drop a labeled image at tests/fixtures/known_positive.jpg",
)
class TestModelRegression:
    def test_known_positive_detects_person(self, client):
        raw = _KNOWN_POSITIVE.read_bytes()
        r = client.post(
            "/api/detect/image",
            files={"file": ("human.jpg", raw, "image/jpeg")},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["count"] >= 1, (
            f"Regression: expected >= 1 person in {_KNOWN_POSITIVE}, got {body['count']}"
        )

    def test_known_positive_confidence_above_threshold(self, client):
        raw = _KNOWN_POSITIVE.read_bytes()
        r = client.post(
            "/api/detect/image",
            files={"file": ("human.jpg", raw, "image/jpeg")},
        )
        dets = r.json()["detections"]
        assert all(d["confidence"] >= 0.25 for d in dets)
