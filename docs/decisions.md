# Decision Log

Key technical decisions made during the project, with rationale.

## D-01 · YOLOv8n over larger variants

**Decision:** Use YOLOv8n (nano, 11.7 MB) rather than YOLOv8s/m.

**Rationale:** The deployment target is Raspberry Pi 5 + Hailo-8L (26 TOPS). YOLOv8n compiles to `.hef` within Hailo's compute budget and sustains real-time FPS. The Shaheen team's evaluation showed nano already achieves mAP@0.5=0.979 on the target domain — scaling up buys negligible accuracy for a large runtime cost.

---

## D-02 · ONNX over TorchScript for web inference

**Decision:** Export to ONNX opset 20; run with ONNX Runtime.

**Rationale:** ONNX Runtime has a mature CPU execution provider with no PyTorch dependency in production. Smaller Docker image, faster cold start, easier cross-platform deployment. TorchScript requires the full PyTorch runtime.

---

## D-03 · Celery + Redis for video, not streaming

**Decision:** Video processing is async via Celery task queue, not a streaming endpoint.

**Rationale:** A 4K 30-fps video at 42 ms/frame takes ~1.4 s/s of content — faster than real-time but still many seconds total. Keeping the HTTP request open that long is unreliable across proxies and mobile networks. Celery decouples upload from processing and gives per-frame progress updates.

---

## D-04 · asyncio.Queue backpressure for WebSocket live stream

**Decision:** `/ws/live` uses a queue of depth 4; oldest frame is dropped when full.

**Rationale:** Inference at 42 ms/frame ≈ 24 FPS maximum throughput. A client at 30 FPS sends faster than the engine can process. Without backpressure, memory grows unbounded. Dropping the oldest frame (not newest) ensures the operator always sees the most recent state.

---

## D-05 · Next.js 16 + Tailwind v4 + OKLch colors

**Decision:** Use bleeding-edge Next.js 16 (App Router), Tailwind v4 CSS-only imports, OKLch color space.

**Rationale:** Tailwind v4 ships as a single CSS import with no PostCSS required, dramatically simplifying the build. OKLch is perceptually uniform — gradients between amber and terra look natural, not muddy. The App Router allows mixing Server and Client Components, keeping the landing page as a static zero-JS server component.

---

## D-06 · Letterbox over simple resize

**Decision:** Preprocess uses letterbox padding (grey fill 114) rather than stretch-resize.

**Rationale:** YOLOv8 was trained on letterboxed 640×640 inputs. Stretching distorts aspect ratios, which shifts bounding box geometry and degrades small-object recall. Letterboxing preserves aspect ratio; the pad offsets are tracked and undone in postprocessing.

---

## D-07 · Deferred training phases

**Decision:** Phases 0–2 (data pipeline, training) are deferred; the Shaheen `best.onnx` is used directly.

**Rationale:** The model already achieves mAP@0.5=0.979 on the target test set. Building the full system (API, frontend, deployment, documentation) around the existing model delivers more capstone value than re-running training. Training phases will resume when infrastructure work is complete and when Wadi Rum data is available for the cross-environment experiment.

---

## D-08 · No Redux / Zustand; plain useState

**Decision:** Frontend state is managed with `useState` per page, not a global store.

**Rationale:** Each detect page has isolated, linear state: `idle → loading → result → error`. There is no cross-page shared state beyond the API health status (in Navbar). A global store would add indirection with no benefit.
