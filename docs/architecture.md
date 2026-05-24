# System Architecture

## Overview

GoldenEye is a three-tier system: a Next.js frontend, a FastAPI backend, and an ONNX inference engine.
All components run in Docker and are independently deployable.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                           │
│   Next.js 16  ·  React 19  ·  Tailwind v4  ·  WebSocket client │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP / WebSocket
┌───────────────────────▼─────────────────────────────────────────┐
│                      FastAPI Backend  (port 8000)               │
│                                                                  │
│  POST /api/detect/image   ──►  ONNXEngine.predict_bytes()       │
│  POST /api/detect/video   ──►  Celery task queue                │
│  WS   /ws/live            ──►  asyncio.Queue + thread pool      │
│  GET  /api/health                                                │
│  GET  /api/metrics        ──►  Prometheus scrape                │
└──────┬────────────────────────────────┬───────────────────────-─┘
       │                                │
┌──────▼──────────┐          ┌──────────▼────────────┐
│  ONNX Runtime   │          │  Redis + Celery worker │
│  best.onnx      │          │  (video processing)    │
│  CPU/CUDA       │          └────────────────────────┘
└─────────────────┘
```

## Component responsibilities

### Frontend (`src/frontend/`)

| File | Purpose |
|---|---|
| `app/page.tsx` | Landing — stats, mode cards, dataset table |
| `app/detect/image/page.tsx` | Upload + SVG tactical overlay |
| `app/detect/video/page.tsx` | Upload + progress ring + polling |
| `app/live/page.tsx` | WebSocket stream + canvas capture |
| `app/analytics/page.tsx` | Recharts altitude & degradation curves |
| `components/Navbar.tsx` | Sticky nav + live API health check |
| `lib/api.ts` | Typed fetch wrappers for all endpoints |

### Backend (`src/api/`)

| File | Purpose |
|---|---|
| `main.py` | FastAPI app factory, CORS, rate limiting, lifespan |
| `inference/onnx_engine.py` | Letterbox preprocess → ONNX run → NMS postprocess |
| `routes/detect.py` | `/api/detect/image` and `/api/detect/video` |
| `routes/jobs.py` | Job status, MP4/CSV download |
| `ws.py` | `/ws/live` — asyncio queue with backpressure |
| `workers.py` | Celery task for frame-by-frame video processing |
| `health.py` | `/api/health` liveness probe |

## Inference pipeline

```
Input image (any resolution)
        │
        ▼
Letterbox resize → 640×640 + grey padding (114)
        │
        ▼
BGR → RGB → normalize [0,1] → NCHW float32 tensor
        │
        ▼
ONNX Runtime session.run()   [~35 ms CPU]
        │
        ▼
Output: [1, 5, 8400]  (cx, cy, w, h, conf per anchor)
        │
        ▼
Transpose → [8400, 5]  ·  filter conf ≥ 0.25
        │
        ▼
Convert cx/cy/w/h → x1/y1/x2/y2
        │
        ▼
Unpad & unscale to original image coordinates
        │
        ▼
cv2.dnn.NMSBoxes (IoU threshold 0.45)
        │
        ▼
List[Detection]  →  JSON + annotated JPEG (base64)
```

## Data flow — video processing

```
Client uploads video
        │
POST /api/detect/video
        │  saves to uploads/{job_id}.mp4
        ▼
process_video.delay(job_id, path)   [Celery]
        │
        ▼
Worker: cv2.VideoCapture → frame loop
  → ONNXEngine.predict()
  → cv2.VideoWriter (annotated)
  → detection row → CSV
  → meta.json updated every 30 frames
        │
        ▼
Client polls GET /api/jobs/{job_id}
        │  (every 1.5 s)
        ▼
Status: queued → processing (0–100%) → done
        │
GET /api/jobs/{job_id}/result.mp4
GET /api/jobs/{job_id}/result.csv
```

## Design decisions

See [Decision Log](decisions.md) for the rationale behind key choices.
