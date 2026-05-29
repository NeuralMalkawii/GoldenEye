"""WebSocket endpoint for live frame-by-frame detection."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.api.inference.onnx_engine import ONNXEngine
from src.api.schemas import DetectionItem, TimingInfo, WSDetectionFrame

router = APIRouter(tags=["live"])

# Max frames queued before we drop to avoid unbounded memory growth
_BACKPRESSURE_LIMIT = 4


@router.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """Bidirectional WebSocket: client sends raw image bytes, server replies with JSON detections.

    Inference runs in a thread pool so the event loop stays unblocked. If the queue
    grows beyond BACKPRESSURE_LIMIT, the oldest frames are dropped.
    """
    await websocket.accept()
    engine: ONNXEngine = websocket.app.state.engine
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=_BACKPRESSURE_LIMIT)

    async def receiver():
        try:
            while True:
                data = await websocket.receive_bytes()
                if queue.full():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                await queue.put(data)
        except WebSocketDisconnect:
            await queue.put(b"")  # sentinel

    async def sender():
        fid = 0
        while True:
            data = await queue.get()
            if data == b"":
                break
            try:
                result = await loop.run_in_executor(None, engine.predict_bytes, data)
                frame = WSDetectionFrame(
                    frame_id=fid,
                    detections=[
                        DetectionItem(
                            bbox=[d.x1, d.y1, d.x2, d.y2],
                            confidence=d.confidence,
                            class_name=d.class_name,
                        )
                        for d in result.detections
                    ],
                    count=len(result.detections),
                    timing=TimingInfo(
                        preprocess_ms=result.preprocess_ms,
                        inference_ms=result.inference_ms,
                        postprocess_ms=result.postprocess_ms,
                    ),
                )
            except Exception as exc:
                frame = WSDetectionFrame(
                    frame_id=fid,
                    detections=[],
                    count=0,
                    timing=TimingInfo(preprocess_ms=0, inference_ms=0, postprocess_ms=0),
                    error=str(exc),
                )
            try:
                await websocket.send_text(frame.model_dump_json())
            except WebSocketDisconnect:
                break
            fid += 1

    await asyncio.gather(receiver(), sender())
