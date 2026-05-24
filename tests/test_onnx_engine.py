"""Unit tests for the ONNX inference engine."""

from __future__ import annotations

import numpy as np
import pytest


class TestPreprocess:
    """_preprocess() must produce a valid NCHW float32 tensor."""

    def test_output_shape(self, engine):
        import cv2
        img = np.full((480, 640, 3), 128, dtype=np.uint8)
        tensor, scale, pad_x, pad_y = engine._preprocess(img)
        assert tensor.shape == (1, 3, 640, 640)

    def test_output_dtype(self, engine):
        img = np.full((100, 100, 3), 200, dtype=np.uint8)
        tensor, *_ = engine._preprocess(img)
        assert tensor.dtype == np.float32

    def test_pixel_range(self, engine):
        img = np.full((640, 640, 3), 255, dtype=np.uint8)
        tensor, *_ = engine._preprocess(img)
        assert tensor.min() >= 0.0
        assert tensor.max() <= 1.0 + 1e-6

    def test_scale_and_pad_square_input(self, engine):
        img = np.zeros((640, 640, 3), dtype=np.uint8)
        _, scale, pad_x, pad_y = engine._preprocess(img)
        assert scale == pytest.approx(1.0)
        assert pad_x == pytest.approx(0.0)
        assert pad_y == pytest.approx(0.0)

    def test_letterbox_wide_image(self, engine):
        """Wide image: pad top/bottom, no side padding."""
        img = np.zeros((320, 640, 3), dtype=np.uint8)
        _, scale, pad_x, pad_y = engine._preprocess(img)
        assert scale == pytest.approx(1.0)
        assert pad_x == pytest.approx(0.0)
        assert pad_y > 0

    def test_letterbox_tall_image(self, engine):
        """Tall image: pad left/right, no top/bottom padding."""
        img = np.zeros((640, 320, 3), dtype=np.uint8)
        _, scale, pad_x, pad_y = engine._preprocess(img)
        assert scale == pytest.approx(1.0)
        assert pad_x > 0
        assert pad_y == pytest.approx(0.0)

    def test_4k_image_downscales(self, engine):
        img = np.zeros((2160, 3840, 3), dtype=np.uint8)
        _, scale, *_ = engine._preprocess(img)
        assert scale < 1.0


class TestPostprocess:
    """_postprocess() must correctly filter, map, and NMS boxes."""

    def _make_raw(self, cx, cy, w, h, conf, *, shape="standard"):
        """Build a fake raw ONNX output for one anchor.

        shape='standard'  → [1, 5, 8400] (cx,cy,w,h,conf on axis-1)
        shape='transposed' → [1, 8400, 5]
        """
        anchor = np.array([[cx, cy, w, h, conf]], dtype=np.float32)  # [1,5]
        if shape == "standard":
            full = np.zeros((1, 5, 8400), dtype=np.float32)
            full[0, :, 0] = anchor[0]
        else:
            full = np.zeros((1, 8400, 5), dtype=np.float32)
            full[0, 0, :] = anchor[0]
        return full

    def test_below_threshold_returns_empty(self, engine):
        raw = self._make_raw(320, 320, 50, 50, conf=0.10)
        dets = engine._postprocess(raw, scale=1.0, pad_x=0, pad_y=0, orig_w=640, orig_h=640)
        assert dets == []

    def test_above_threshold_returns_detection(self, engine):
        raw = self._make_raw(320, 320, 100, 100, conf=0.85)
        dets = engine._postprocess(raw, scale=1.0, pad_x=0, pad_y=0, orig_w=640, orig_h=640)
        assert len(dets) == 1
        assert dets[0].confidence == pytest.approx(0.85, abs=1e-4)
        assert dets[0].class_name == "person"

    def test_bbox_coordinates_in_image_bounds(self, engine):
        raw = self._make_raw(320, 320, 100, 100, conf=0.9)
        dets = engine._postprocess(raw, scale=1.0, pad_x=0, pad_y=0, orig_w=640, orig_h=640)
        assert len(dets) == 1
        d = dets[0]
        assert 0 <= d.x1 < d.x2 <= 640
        assert 0 <= d.y1 < d.y2 <= 640

    def test_handles_transposed_output(self, engine):
        """Engine must handle both [1,5,8400] and [1,8400,5] output shapes."""
        raw = self._make_raw(320, 320, 80, 80, conf=0.75, shape="transposed")
        dets = engine._postprocess(raw, scale=1.0, pad_x=0, pad_y=0, orig_w=640, orig_h=640)
        assert len(dets) == 1

    def test_scale_maps_boxes_back(self, engine):
        """Boxes computed in letterboxed space must map to original coords."""
        # Image 320×320 padded to 640×640 → scale=1.0, pad=(160,160)
        # Anchor at letterboxed centre (320,320) = original (160,160)
        raw = self._make_raw(320, 320, 60, 60, conf=0.9)
        dets = engine._postprocess(raw, scale=1.0, pad_x=160, pad_y=160, orig_w=320, orig_h=320)
        assert len(dets) == 1
        d = dets[0]
        cx_orig = (d.x1 + d.x2) / 2
        cy_orig = (d.y1 + d.y2) / 2
        assert cx_orig == pytest.approx(160, abs=2)
        assert cy_orig == pytest.approx(160, abs=2)


class TestPredictBytes:
    """predict_bytes() wraps predict() for raw byte inputs."""

    def test_blank_image_no_crash(self, engine, blank_jpeg):
        result = engine.predict_bytes(blank_jpeg)
        assert result.detections is not None
        assert result.inference_ms > 0

    def test_invalid_bytes_raises(self, engine):
        with pytest.raises(ValueError, match="Could not decode"):
            engine.predict_bytes(b"not an image")

    def test_png_input(self, engine, blank_png_bytes):
        result = engine.predict_bytes(blank_png_bytes)
        assert isinstance(result.detections, list)

    def test_timing_fields_populated(self, engine, blank_jpeg):
        result = engine.predict_bytes(blank_jpeg)
        assert result.preprocess_ms >= 0
        assert result.inference_ms > 0
        assert result.postprocess_ms >= 0

    def test_result_dict_schema(self, engine, blank_jpeg):
        d = engine.predict_bytes(blank_jpeg).to_dict()
        assert "detections" in d
        assert "count" in d
        assert "timing" in d
        assert isinstance(d["count"], int)

    @pytest.mark.skipif(
        not (
            (lambda p: p.exists())(
                __import__("pathlib").Path(r"C:\Users\Omar\Documents\Claude\Projects\Capstone\Datasets\real_data\images\test\human_0004282761.jpg")
            )
        ),
        reason="real_data test set not found",
    )
    def test_real_desert_image_detects_person(self, engine):
        path = r"C:\Users\Omar\Documents\Claude\Projects\Capstone\Datasets\real_data\images\test\human_0004282761.jpg"
        raw = open(path, "rb").read()
        result = engine.predict_bytes(raw)
        assert len(result.detections) >= 1, "Expected at least one person in known positive image"
        assert result.detections[0].confidence >= 0.5


class TestModelMetadata:
    def test_metadata_keys(self, engine):
        m = engine.metadata
        for key in ("model_path", "input_size", "confidence_threshold", "nms_iou_threshold", "provider"):
            assert key in m

    def test_input_size(self, engine):
        assert engine.metadata["input_size"] == 640

    def test_provider_is_cpu(self, engine):
        assert "CPU" in engine.metadata["provider"]


class TestDrawDetections:
    def test_returns_same_shape(self, engine, blank_jpeg):
        import cv2
        arr = np.frombuffer(blank_jpeg, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        result = engine.predict(img)
        out = engine.draw_detections(img, result.detections)
        assert out.shape == img.shape

    def test_does_not_mutate_input(self, engine, blank_jpeg):
        import cv2
        arr = np.frombuffer(blank_jpeg, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        original = img.copy()
        from src.api.inference.onnx_engine import Detection
        fake = [Detection(x1=10, y1=10, x2=100, y2=100, confidence=0.9)]
        import cv2
        engine.draw_detections(img, fake)
        assert cv2.norm(img, original, cv2.NORM_INF) == 0, "draw_detections mutated the input image"
