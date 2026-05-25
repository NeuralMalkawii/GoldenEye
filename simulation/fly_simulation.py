"""
GoldenEye Phase 5 — UAV Flight Simulation

Simulates a UAV flyover of real SAR imagery by:
  1. Loading a 4K aerial image (Shaheen / SARD dataset)
  2. Generating a flight path (lawnmower or spiral) over it
  3. Extracting crop windows to simulate altitude + camera FOV
  4. Streaming frames to the GoldenEye WebSocket API
  5. Overlaying detection boxes and recording to MP4

Usage:
  # Lawnmower scan at 50m altitude over a single image
  python simulation/fly_simulation.py --image path/to/image.jpg

  # Spiral scan over a random image from the dataset
  python simulation/fly_simulation.py --dataset real_data/images/test/ --mode spiral

  # Custom output path and altitude
  python simulation/fly_simulation.py --image img.jpg --altitude 30 --output simulation/output/run.mp4
"""

import argparse
import asyncio
import csv
import json
import os
import random
import time
from pathlib import Path

import cv2
import numpy as np
import websockets

# ── Output video ──────────────────────────────────────────────────────────────
OUTPUT_W, OUTPUT_H = 1280, 720
TARGET_FPS = 10
JPEG_QUALITY = 75

# ── Flight parameters ─────────────────────────────────────────────────────────
SPEED_PX = 56          # horizontal travel per frame in source pixels
LAWNMOWER_OVERLAP = 0.5  # row overlap fraction

# Altitude (m) → fraction of 4K image used as crop window
# Smaller fraction = lower altitude = more zoomed in
ALTITUDE_CROP = {
    20: 0.22,
    30: 0.30,
    40: 0.38,
    50: 0.46,
    60: 0.55,
    70: 0.63,
    80: 0.71,
    95: 0.82,
}

# Amber colour in BGR for HUD/annotations
AMBER_BGR = (32, 178, 220)
AMBER_DIM  = (20, 110, 140)


# ── Crop helpers ──────────────────────────────────────────────────────────────

def crop_size(img_w: int, img_h: int, altitude_m: int = 50):
    """Return (crop_w, crop_h) for the given simulated altitude."""
    frac = ALTITUDE_CROP.get(altitude_m, 0.46)
    cw = int(img_w * frac)
    ch = int(img_h * frac)
    # Maintain 16:9 aspect ratio of output
    ch = int(cw * OUTPUT_H / OUTPUT_W)
    return cw, ch


def extract_frame(src, cx, cy, cw, ch):
    """Crop (cx,cy)-centred window from src, resize to OUTPUT_W×OUTPUT_H."""
    x1 = max(0, min(src.shape[1] - cw, cx - cw // 2))
    y1 = max(0, min(src.shape[0] - ch, cy - ch // 2))
    crop = src[y1:y1 + ch, x1:x1 + cw]
    frame = cv2.resize(crop, (OUTPUT_W, OUTPUT_H), interpolation=cv2.INTER_LINEAR)
    return frame, x1, y1


# ── Flight paths ──────────────────────────────────────────────────────────────

def lawnmower_path(img_w, img_h, cw, ch):
    """Left-right sweep with 50% row overlap."""
    hw, hh = cw // 2, ch // 2
    row_step = int(ch * (1 - LAWNMOWER_OVERLAP))
    pts = []
    y = hh
    going_right = True
    while y <= img_h - hh:
        xs = range(hw, img_w - hw, SPEED_PX)
        if not going_right:
            xs = reversed(list(xs))
        for x in xs:
            pts.append((x, y))
        y += row_step
        going_right = not going_right
    return pts


def spiral_path(img_w, img_h, cw, ch):
    """Outward Archimedean spiral from image centre."""
    cx0, cy0 = img_w // 2, img_h // 2
    hw, hh = cw // 2, ch // 2
    max_r = min(img_w // 2 - hw, img_h // 2 - hh)
    pts = [(cx0, cy0)]
    angle, radius = 0.0, 0.0
    while radius < max_r:
        angle += 0.12
        radius += SPEED_PX * 0.10
        x = int(cx0 + radius * np.cos(angle))
        y = int(cy0 + radius * np.sin(angle))
        x = max(hw, min(img_w - hw, x))
        y = max(hh, min(img_h - hh, y))
        pts.append((x, y))
    return pts


# ── Annotation ────────────────────────────────────────────────────────────────

def draw_frame(frame, detections, frame_id, fps, x1_off, y1_off, cw, ch,
               altitude_m, image_name=""):
    """Draw tactical detection boxes and HUD onto frame (in-place)."""
    sx = OUTPUT_W / cw
    sy = OUTPUT_H / ch

    for i, det in enumerate(detections):
        bx1, by1, bx2, by2 = det["bbox"]
        # Map source-image coords → output-frame coords
        fx1 = int((bx1 - x1_off) * sx)
        fy1 = int((by1 - y1_off) * sy)
        fx2 = int((bx2 - x1_off) * sx)
        fy2 = int((by2 - y1_off) * sy)
        # Clamp
        fx1, fy1 = max(0, fx1), max(0, fy1)
        fx2, fy2 = min(OUTPUT_W - 1, fx2), min(OUTPUT_H - 1, fy2)

        conf = int(det["confidence"] * 100)
        cs = max(6, min(18, (fx2 - fx1) // 3))

        # Corner brackets
        cv2.line(frame, (fx1, fy1 + cs), (fx1, fy1), AMBER_BGR, 2)
        cv2.line(frame, (fx1, fy1), (fx1 + cs, fy1), AMBER_BGR, 2)
        cv2.line(frame, (fx2 - cs, fy1), (fx2, fy1), AMBER_BGR, 2)
        cv2.line(frame, (fx2, fy1), (fx2, fy1 + cs), AMBER_BGR, 2)
        cv2.line(frame, (fx2, fy2 - cs), (fx2, fy2), AMBER_BGR, 2)
        cv2.line(frame, (fx2, fy2), (fx2 - cs, fy2), AMBER_BGR, 2)
        cv2.line(frame, (fx1 + cs, fy2), (fx1, fy2), AMBER_BGR, 2)
        cv2.line(frame, (fx1, fy2), (fx1, fy2 - cs), AMBER_BGR, 2)

        # Centre dot
        mcx, mcy = (fx1 + fx2) // 2, (fy1 + fy2) // 2
        cv2.circle(frame, (mcx, mcy), 2, AMBER_BGR, -1)

        # Label background + text
        label = f"#{i+1} PERSON {conf}%"
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
        cv2.rectangle(frame, (fx1, fy1 - lh - 8), (fx1 + lw + 6, fy1), (18, 14, 10), -1)
        cv2.putText(frame, label, (fx1 + 3, fy1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, AMBER_BGR, 1, cv2.LINE_AA)

    # HUD bar
    hh_bar = 30
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, OUTPUT_H - hh_bar), (OUTPUT_W, OUTPUT_H), (14, 10, 8), -1)
    cv2.addWeighted(overlay, 0.80, frame, 0.20, 0, frame)
    cv2.line(frame, (0, OUTPUT_H - hh_bar), (OUTPUT_W, OUTPUT_H - hh_bar), (55, 45, 35), 1)

    left = f"ALT {altitude_m}m  |  FRAME {frame_id:04d}  |  FPS {fps:4.1f}  |  DETS {len(detections)}"
    right = f"GoldenEye · YOLOv8n · best.onnx"
    cv2.putText(frame, left,  (8, OUTPUT_H - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, (190, 165, 100), 1, cv2.LINE_AA)
    cv2.putText(frame, right, (OUTPUT_W - 240, OUTPUT_H - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.36, (100, 88, 65), 1, cv2.LINE_AA)

    # "LIVE" badge top-left
    cv2.rectangle(frame, (8, 8), (58, 26), (18, 14, 10), -1)
    cv2.rectangle(frame, (8, 8), (58, 26), AMBER_DIM, 1)
    cv2.circle(frame, (18, 17), 4, (50, 80, 200), -1)  # red dot
    cv2.putText(frame, "LIVE", (25, 21),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, AMBER_BGR, 1, cv2.LINE_AA)

    return frame


# ── Core simulation ───────────────────────────────────────────────────────────

async def run_simulation(source_img, path_pts, cw, ch, ws_url,
                         output_path, altitude_m, image_name="", verbose=True):
    """Stream flight frames to API, annotate, write MP4. Returns results log."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    writer = cv2.VideoWriter(
        output_path,
        cv2.VideoWriter_fourcc(*"mp4v"),
        TARGET_FPS,
        (OUTPUT_W, OUTPUT_H),
    )
    if not writer.isOpened():
        raise RuntimeError(f"Could not open VideoWriter for {output_path}")

    log = []
    frame_id = 0
    total_dets = 0
    t_window: list[float] = []

    print(f"\nConnecting to {ws_url} …")
    async with websockets.connect(ws_url, max_size=16_000_000) as ws:
        print(f"Connected. {len(path_pts)} positions | altitude {altitude_m}m | "
              f"crop {cw}×{ch}")

        for cx, cy in path_pts:
            t0 = time.perf_counter()

            frame, x1_off, y1_off = extract_frame(source_img, cx, cy, cw, ch)

            # Encode and stream
            _, buf = cv2.imencode(
                ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
            )
            await ws.send(buf.tobytes())

            # Receive detections
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=8.0)
            except asyncio.TimeoutError:
                print(f"  frame {frame_id}: API timeout — skipping")
                writer.write(frame)
                continue

            result = json.loads(raw)
            frame_id += 1
            total_dets += result["count"]

            # FPS (1-second rolling window)
            now = time.perf_counter()
            t_window = [t for t in t_window if now - t < 1.0]
            t_window.append(now)
            fps = len(t_window)

            # Annotate and write
            annotated = draw_frame(
                frame.copy(), result["detections"], frame_id, fps,
                x1_off, y1_off, cw, ch, altitude_m, image_name,
            )
            writer.write(annotated)

            log.append({
                "frame_id": frame_id,
                "cx": cx,
                "cy": cy,
                "altitude_m": altitude_m,
                "count": result["count"],
                "inference_ms": round(result["timing"]["inference_ms"], 1),
            })

            if verbose and frame_id % 25 == 0:
                print(
                    f"  [{frame_id:4d}/{len(path_pts)}] "
                    f"pos ({cx:4d},{cy:4d}) | "
                    f"dets {result['count']} | "
                    f"inf {result['timing']['inference_ms']:.0f}ms | "
                    f"total {total_dets}"
                )

    writer.release()
    print(f"\n✓ Wrote {frame_id} frames → {output_path}")
    print(f"  Total detections: {total_dets}")
    return log


# ── CLI entry point ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="GoldenEye UAV flight simulation — streams SAR imagery to detection API"
    )
    parser.add_argument("--image",    help="Path to a single source image")
    parser.add_argument("--dataset",  help="Directory of images; one is chosen randomly")
    parser.add_argument("--output",   default="simulation/output/demo_flight.mp4")
    parser.add_argument("--mode",     choices=["lawnmower", "spiral"], default="lawnmower")
    parser.add_argument("--altitude", type=int, default=50,
                        choices=sorted(ALTITUDE_CROP), metavar="M",
                        help="Simulated altitude in metres (default 50)")
    parser.add_argument("--api",      default="ws://localhost:8000/ws/live",
                        help="WebSocket URL of the GoldenEye API")
    parser.add_argument("--seed",     type=int, default=42)
    parser.add_argument("--quiet",    action="store_true")
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)

    # ── Resolve source image
    if args.image:
        img_path = Path(args.image)
    elif args.dataset:
        images = list(Path(args.dataset).glob("*.jpg")) + \
                 list(Path(args.dataset).glob("*.png"))
        if not images:
            parser.error(f"No images found in {args.dataset}")
        img_path = random.choice(images)
    else:
        parser.error("Provide --image or --dataset")

    print(f"Source: {img_path}")
    src = cv2.imread(str(img_path))
    if src is None:
        raise ValueError(f"Could not load: {img_path}")

    img_h, img_w = src.shape[:2]
    print(f"Image size: {img_w}×{img_h}")

    # ── Compute crop size
    cw, ch = crop_size(img_w, img_h, args.altitude)
    print(f"Crop: {cw}×{ch} ({cw/img_w:.0%} of image width)")

    # ── Generate flight path
    if args.mode == "lawnmower":
        path = lawnmower_path(img_w, img_h, cw, ch)
    else:
        path = spiral_path(img_w, img_h, cw, ch)
    print(f"Path: {len(path)} positions ({args.mode})")

    # ── Run
    results = asyncio.run(
        run_simulation(
            src, path, cw, ch,
            args.api, args.output,
            args.altitude, img_path.name,
            verbose=not args.quiet,
        )
    )

    # ── Save CSV
    out = Path(args.output)
    csv_path = str(out.with_name(out.stem + "_results.csv"))
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=["frame_id", "cx", "cy", "altitude_m", "count", "inference_ms"]
        )
        writer.writeheader()
        writer.writerows(results)
    print(f"CSV → {csv_path}")


if __name__ == "__main__":
    main()
