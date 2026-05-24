"""ONNX Runtime inference engine for YOLOv8 single-class person detection."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


@dataclass
class Detection:
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_name: str = "person"

    def to_dict(self) -> dict:
        return {
            "bbox": [round(self.x1, 2), round(self.y1, 2), round(self.x2, 2), round(self.y2, 2)],
            "confidence": round(self.confidence, 4),
            "class_name": self.class_name,
        }


@dataclass
class InferenceResult:
    detections: list[Detection] = field(default_factory=list)
    inference_ms: float = 0.0
    preprocess_ms: float = 0.0
    postprocess_ms: float = 0.0

    def to_dict(self) -> dict:
        return {
            "detections": [d.to_dict() for d in self.detections],
            "count": len(self.detections),
            "timing": {
                "preprocess_ms": round(self.preprocess_ms, 2),
                "inference_ms": round(self.inference_ms, 2),
                "postprocess_ms": round(self.postprocess_ms, 2),
            },
        }


class ONNXEngine:
    """Wraps an ONNX-exported YOLOv8 model for synchronous CPU/GPU inference."""

    INPUT_SIZE = 640

    def __init__(
        self,
        model_path: str | Path,
        confidence_threshold: float = 0.25,
        nms_iou_threshold: float = 0.45,
    ) -> None:
        self.model_path = Path(model_path)
        self.confidence_threshold = confidence_threshold
        self.nms_iou_threshold = nms_iou_threshold

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if "CUDAExecutionProvider" in ort.get_available_providers()
            else ["CPUExecutionProvider"]
        )
        self._session = ort.InferenceSession(str(self.model_path), providers=providers)
        self._input_name: str = self._session.get_inputs()[0].name
        self._active_provider: str = self._session.get_providers()[0]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, image_bgr: np.ndarray) -> InferenceResult:
        """Run detection on a single BGR image (H×W×3 uint8)."""
        result = InferenceResult()
        orig_h, orig_w = image_bgr.shape[:2]

        t0 = time.perf_counter()
        tensor, scale, pad_x, pad_y = self._preprocess(image_bgr)
        result.preprocess_ms = (time.perf_counter() - t0) * 1000

        t1 = time.perf_counter()
        raw = self._session.run(None, {self._input_name: tensor})[0]
        result.inference_ms = (time.perf_counter() - t1) * 1000

        t2 = time.perf_counter()
        result.detections = self._postprocess(raw, scale, pad_x, pad_y, orig_w, orig_h)
        result.postprocess_ms = (time.perf_counter() - t2) * 1000

        return result

    def predict_bytes(self, image_bytes: bytes) -> InferenceResult:
        """Decode raw image bytes then run predict()."""
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image bytes.")
        return self.predict(img)

    def draw_detections(self, image_bgr: np.ndarray, detections: list[Detection]) -> np.ndarray:
        """Return a copy of the image with bounding boxes drawn."""
        out = image_bgr.copy()
        for det in detections:
            x1, y1, x2, y2 = int(det.x1), int(det.y1), int(det.x2), int(det.y2)
            cv2.rectangle(out, (x1, y1), (x2, y2), (0, 200, 80), 2)
            label = f"person {det.confidence:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(out, (x1, y1 - th - 6), (x1 + tw + 4, y1), (0, 200, 80), -1)
            cv2.putText(out, label, (x1 + 2, y1 - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1)
        return out

    @property
    def metadata(self) -> dict:
        return {
            "model_path": str(self.model_path),
            "input_size": self.INPUT_SIZE,
            "confidence_threshold": self.confidence_threshold,
            "nms_iou_threshold": self.nms_iou_threshold,
            "provider": self._active_provider,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _preprocess(
        self, image_bgr: np.ndarray
    ) -> tuple[np.ndarray, float, float, float]:
        """Letterbox-resize to INPUT_SIZE×INPUT_SIZE, normalize, add batch dim.

        Returns (tensor, scale, pad_x, pad_y) so boxes can be mapped back to
        the original image coordinates after inference.
        """
        s = self.INPUT_SIZE
        h, w = image_bgr.shape[:2]
        scale = min(s / w, s / h)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = cv2.resize(image_bgr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        pad_x = (s - new_w) / 2
        pad_y = (s - new_h) / 2

        canvas = np.full((s, s, 3), 114, dtype=np.uint8)
        x0, y0 = int(pad_x), int(pad_y)
        canvas[y0 : y0 + new_h, x0 : x0 + new_w] = resized

        rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        tensor = rgb.astype(np.float32) / 255.0
        tensor = np.transpose(tensor, (2, 0, 1))[np.newaxis]  # NCHW
        return tensor, scale, pad_x, pad_y

    def _postprocess(
        self,
        raw: np.ndarray,
        scale: float,
        pad_x: float,
        pad_y: float,
        orig_w: int,
        orig_h: int,
    ) -> list[Detection]:
        """Parse YOLOv8 ONNX output and return filtered, NMS-applied detections.

        YOLOv8 ONNX exports with shape [1, 5, 8400] for a single-class model
        (cx, cy, w, h, conf). We transpose to [8400, 5] for easier indexing.
        """
        # raw shape: [1, num_outputs, num_anchors]
        preds = raw[0]  # [5, 8400] or [8400, 5] depending on export opset
        if preds.shape[0] < preds.shape[1]:
            preds = preds.T  # normalise to [8400, 5]

        conf_mask = preds[:, 4] >= self.confidence_threshold
        preds = preds[conf_mask]
        if len(preds) == 0:
            return []

        # cx, cy, w, h → x1, y1, x2, y2 (still in letterboxed space)
        cx, cy, w, h = preds[:, 0], preds[:, 1], preds[:, 2], preds[:, 3]
        x1 = cx - w / 2
        y1 = cy - h / 2
        x2 = cx + w / 2
        y2 = cy + h / 2

        # Map back to original image coordinates
        x1 = np.clip((x1 - pad_x) / scale, 0, orig_w)
        y1 = np.clip((y1 - pad_y) / scale, 0, orig_h)
        x2 = np.clip((x2 - pad_x) / scale, 0, orig_w)
        y2 = np.clip((y2 - pad_y) / scale, 0, orig_h)

        confidences = preds[:, 4].tolist()
        boxes_xywh = np.stack([x1, y1, x2 - x1, y2 - y1], axis=1).tolist()

        indices = cv2.dnn.NMSBoxes(
            boxes_xywh, confidences, self.confidence_threshold, self.nms_iou_threshold
        )
        if len(indices) == 0:
            return []

        detections: list[Detection] = []
        for i in indices.flatten():
            detections.append(
                Detection(
                    x1=float(x1[i]),
                    y1=float(y1[i]),
                    x2=float(x2[i]),
                    y2=float(y2[i]),
                    confidence=float(confidences[i]),
                )
            )
        return detections
