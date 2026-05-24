"""WebSocket endpoint for live frame-by-frame detection."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.api.inference.onnx_engine import ONNXEngine
from src.api.schemas import WSDetectionFrame

router = APIRouter(tags=["live"])

# Max frames queued before we drop to avoid unbounded memory growth
_BACKPRESSURE_LIMIT = 4


@router.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """Bidirectional WebSocket: client sends raw image bytes, server replies with JSON detections.

    The server runs inference in a thread pool so the event loop stays unblocked.
    Backpressure: if the queue grows beyond BACKPRESSURE_LIMIT, oldest frames are dropped.
    """
    await websocket.accept()
    engine: ONNXEngine = websocket.app.state.engine
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=_BACKPRESSURE_LIMIT)
    frame_id = 0

    async def receiver():
        nonlocal frame_id
        try:
            while True:
                data = await websocket.receive_bytes()
                if queue.full():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                await queue.put(data)
                frame_id += 1
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
                    detections=[d.to_dict() for d in result.detections],  # type: ignore[arg-type]
                    count=len(result.detections),
                    timing=result.to_dict()["timing"],  # type: ignore[arg-type]
                )
            except Exception as exc:
                frame = WSDetectionFrame(
                    frame_id=fid,
                    detections=[],
                    count=0,
                    timing={"preprocess_ms": 0, "inference_ms": 0, "postprocess_ms": 0},  # type: ignore[arg-type]
                    error=str(exc),
                )
            try:
                await websocket.send_text(frame.model_dump_json())
            except WebSocketDisconnect:
                break
            fid += 1

    await asyncio.gather(receiver(), sender())
