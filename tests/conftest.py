"""Shared pytest fixtures for GoldenEye tests."""

from __future__ import annotations

import io
import os
from pathlib import Path

import cv2
import numpy as np
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parent.parent
MODEL_PATH = REPO_ROOT / "models" / "best.onnx"

# Real test images from the Shaheen real_data split (used when available)
DATASET_ROOT = Path(r"C:\Users\Omar\Documents\Claude\Projects\Capstone\Datasets")
REAL_DATA_TEST = DATASET_ROOT / "real_data" / "images" / "test"


# ---------------------------------------------------------------------------
# Synthetic test images (no disk dependency)
# ---------------------------------------------------------------------------

def _make_blank_image(h: int = 480, w: int = 640) -> np.ndarray:
    """Return a solid grey BGR image — nothing to detect."""
    return np.full((h, w, 3), 128, dtype=np.uint8)


def _make_blank_jpeg_bytes(h: int = 480, w: int = 640) -> bytes:
    img = _make_blank_image(h, w)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


@pytest.fixture(scope="session")
def blank_jpeg() -> bytes:
    return _make_blank_jpeg_bytes()


@pytest.fixture(scope="session")
def blank_png_bytes() -> bytes:
    img = _make_blank_image()
    _, buf = cv2.imencode(".png", img)
    return buf.tobytes()


@pytest.fixture(scope="session")
def real_image_jpeg() -> bytes | None:
    """First available JPG from the real_data test split, or None if not found."""
    if not REAL_DATA_TEST.exists():
        return None
    imgs = sorted(REAL_DATA_TEST.glob("*.jpg"))
    if not imgs:
        return None
    return imgs[0].read_bytes()


# ---------------------------------------------------------------------------
# Engine fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def engine():
    """Load the ONNX engine once for the entire test session."""
    pytest.importorskip("onnxruntime", reason="onnxruntime not installed")
    if not MODEL_PATH.exists():
        pytest.skip(f"Model not found: {MODEL_PATH}")
    from src.api.inference.onnx_engine import ONNXEngine
    return ONNXEngine(str(MODEL_PATH))


# ---------------------------------------------------------------------------
# FastAPI test client fixtures
# ---------------------------------------------------------------------------

os.environ.setdefault("MODEL_PATH", str(MODEL_PATH))
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")


@pytest.fixture(scope="session")
def app():
    from src.api.main import create_app
    return create_app()


@pytest.fixture(scope="session")
def client(app):
    with TestClient(app) as c:
        yield c


@pytest_asyncio.fixture(scope="session")
async def async_client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
