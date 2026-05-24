"""Integration tests for all GoldenEye FastAPI endpoints."""

from __future__ import annotations

import io
import json

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
# Model regression: known positive image must detect >= 1 person
# ---------------------------------------------------------------------------

KNOWN_POSITIVE = r"C:\Users\Omar\Documents\Claude\Projects\Capstone\Datasets\real_data\images\test\human_0004282761.jpg"

@pytest.mark.skipif(
    not __import__("pathlib").Path(KNOWN_POSITIVE).exists(),
    reason="real_data test set not available",
)
class TestModelRegression:
    def test_known_positive_detects_person(self, client):
        raw = open(KNOWN_POSITIVE, "rb").read()
        r = client.post(
            "/api/detect/image",
            files={"file": ("human.jpg", raw, "image/jpeg")},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["count"] >= 1, (
            f"Regression: expected >= 1 person in {KNOWN_POSITIVE}, got {body['count']}"
        )

    def test_known_positive_confidence_above_threshold(self, client):
        raw = open(KNOWN_POSITIVE, "rb").read()
        r = client.post(
            "/api/detect/image",
            files={"file": ("human.jpg", raw, "image/jpeg")},
        )
        dets = r.json()["detections"]
        assert all(d["confidence"] >= 0.25 for d in dets)
