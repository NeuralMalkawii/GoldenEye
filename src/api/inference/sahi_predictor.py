"""Sliced Aided Hyper Inference (SAHI) for small-object detection at 4K.

The base ONNX engine letterboxes any input to 640x640, which destroys
~68 px median targets in 4K Shaheen imagery (they become ~11 px and fall
below the model's receptive field). This predictor tiles the input into
overlapping patches at native resolution, runs the engine per tile, and
fuses results with global NMS.

Reference: Akyon et al., "Slicing Aided Hyper Inference" (2022).

Kept dep-free on purpose: pulling in `sahi`+`ultralytics` would drag in
the full PyTorch stack (~700 MB) which won't fit on the Railway free tier.
This re-implementation is ~50 lines and produces identical results for
the single-class person detection case.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import cv2
import numpy as np

from src.api.inference.onnx_engine import Detection, InferenceResult, ONNXEngine


@dataclass
class SliceSpec:
    tile: int = 640
    overlap: float = 0.2
    iou_threshold: float = 0.5  # cross-tile NMS


class SAHIPredictor:
    """Tiled inference wrapper around an ONNXEngine.

    For images at or below the tile size, falls back to the base engine
    transparently — no overhead.
    """

    def __init__(self, engine: ONNXEngine, spec: SliceSpec | None = None) -> None:
        self.engine = engine
        self.spec = spec or SliceSpec()

    def predict(self, image_bgr: np.ndarray) -> InferenceResult:
        h, w = image_bgr.shape[:2]
        tile = self.spec.tile

        # No-tile fast path: image fits in one inference call
        if max(h, w) <= tile:
            return self.engine.predict(image_bgr)

        result = InferenceResult()
        t0 = time.perf_counter()
        offsets = list(self._iter_tile_origins(w, h))
        result.preprocess_ms = (time.perf_counter() - t0) * 1000

        all_detections: list[Detection] = []
        t1 = time.perf_counter()
        for (x0, y0) in offsets:
            tile_img = image_bgr[y0 : y0 + tile, x0 : x0 + tile]
            tile_result = self.engine.predict(tile_img)
            for d in tile_result.detections:
                all_detections.append(
                    Detection(
                        x1=d.x1 + x0,
                        y1=d.y1 + y0,
                        x2=d.x2 + x0,
                        y2=d.y2 + y0,
                        confidence=d.confidence,
                        class_name=d.class_name,
                    )
                )
        result.inference_ms = (time.perf_counter() - t1) * 1000

        t2 = time.perf_counter()
        result.detections = self._global_nms(all_detections)
        result.postprocess_ms = (time.perf_counter() - t2) * 1000
        return result

    def predict_bytes(self, image_bytes: bytes) -> InferenceResult:
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image bytes.")
        return self.predict(img)

    def _iter_tile_origins(self, w: int, h: int):
        """Yield (x0, y0) origins covering the full image with overlap."""
        tile = self.spec.tile
        step = max(1, int(tile * (1 - self.spec.overlap)))
        ys = list(range(0, max(1, h - tile + 1), step))
        xs = list(range(0, max(1, w - tile + 1), step))
        # Make sure the right/bottom edges are always covered
        if not ys or ys[-1] + tile < h:
            ys.append(max(0, h - tile))
        if not xs or xs[-1] + tile < w:
            xs.append(max(0, w - tile))
        seen: set[tuple[int, int]] = set()
        for y in ys:
            for x in xs:
                key = (x, y)
                if key in seen:
                    continue
                seen.add(key)
                yield key

    def _global_nms(self, dets: list[Detection]) -> list[Detection]:
        if not dets:
            return []
        boxes = np.array(
            [[d.x1, d.y1, d.x2 - d.x1, d.y2 - d.y1] for d in dets], dtype=np.float32
        ).tolist()
        scores = [d.confidence for d in dets]
        indices = cv2.dnn.NMSBoxes(
            boxes, scores, self.engine.confidence_threshold, self.spec.iou_threshold
        )
        if len(indices) == 0:
            return []
        return [dets[i] for i in np.array(indices).flatten()]
