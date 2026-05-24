"""
GoldenEye Phase 5 — Altitude Robustness Evaluation

Runs the flight simulation at multiple altitudes, collects per-frame detection
counts, and computes the altitude robustness curve used in the capstone report.

Requires the GoldenEye API to be running (image endpoint, not WebSocket).

Usage:
  python simulation/evaluate_sim.py \
    --dataset real_data/images/test/ \
    --labels  real_data/labels/test/ \
    --output  simulation/output/altitude_eval.csv \
    --n 50
"""

import argparse
import csv
import json
import os
import random
import time
from pathlib import Path

import cv2
import httpx
import numpy as np

ALTITUDES = [20, 30, 40, 50, 60, 70, 80, 95]

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


# ── Geometry helpers ──────────────────────────────────────────────────────────

def crop_size(img_w, img_h, altitude_m):
    frac = ALTITUDE_CROP.get(altitude_m, 0.46)
    cw = int(img_w * frac)
    ch = int(cw * 720 / 1280)   # 16:9
    return cw, ch


def iou(a, b):
    """Compute IoU between two [x1,y1,x2,y2] boxes."""
    ix1 = max(a[0], b[0]); iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2]); iy2 = min(a[3], b[3])
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def load_gt_boxes(label_path, img_w, img_h):
    """Read YOLO-format label file; return list of [x1,y1,x2,y2] boxes."""
    boxes = []
    if not os.path.exists(label_path):
        return boxes
    with open(label_path) as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            _, xc, yc, bw, bh = map(float, parts[:5])
            x1 = (xc - bw / 2) * img_w
            y1 = (yc - bh / 2) * img_h
            x2 = (xc + bw / 2) * img_w
            y2 = (yc + bh / 2) * img_h
            boxes.append([x1, y1, x2, y2])
    return boxes


# ── Crop GT boxes to the simulated camera window ──────────────────────────────

def clip_boxes_to_crop(gt_boxes, x1_off, y1_off, cw, ch, min_visible=0.3):
    """Return GT boxes (in crop coordinates) that are ≥min_visible visible."""
    clipped = []
    for box in gt_boxes:
        bx1, by1, bx2, by2 = box
        # Intersect with crop window
        cx1 = max(bx1, x1_off)
        cy1 = max(by1, y1_off)
        cx2 = min(bx2, x1_off + cw)
        cy2 = min(by2, y1_off + ch)
        if cx2 <= cx1 or cy2 <= cy1:
            continue
        visible_area = (cx2 - cx1) * (cy2 - cy1)
        full_area = (bx2 - bx1) * (by2 - by1)
        if full_area > 0 and visible_area / full_area >= min_visible:
            # Shift to crop-local coords
            clipped.append([cx1 - x1_off, cy1 - y1_off,
                             cx2 - x1_off, cy2 - y1_off])
    return clipped


# ── Matching helpers (for precision/recall) ───────────────────────────────────

def match_detections(pred_boxes, gt_boxes, iou_thresh=0.5):
    """
    Greedy matching of predictions to ground truth at given IoU threshold.
    Returns (tp, fp, fn).
    """
    matched_gt = set()
    tp = 0
    fp = 0
    for pb in pred_boxes:
        best_iou, best_j = 0.0, -1
        for j, gb in enumerate(gt_boxes):
            if j in matched_gt:
                continue
            v = iou(pb, gb)
            if v > best_iou:
                best_iou, best_j = v, j
        if best_iou >= iou_thresh:
            tp += 1
            matched_gt.add(best_j)
        else:
            fp += 1
    fn = len(gt_boxes) - len(matched_gt)
    return tp, fp, fn


# ── Per-altitude evaluation ───────────────────────────────────────────────────

def evaluate_altitude(images, labels_dir, altitude_m, api_url, n_per_altitude):
    """Run n_per_altitude images at this altitude; return aggregate metrics."""
    tp_total = fp_total = fn_total = 0
    inf_times = []
    rows = []

    for img_path in images[:n_per_altitude]:
        src = cv2.imread(str(img_path))
        if src is None:
            continue
        img_h, img_w = src.shape[:2]
        cw, ch = crop_size(img_w, img_h, altitude_m)

        # Centre crop (deterministic — evaluates the centre of each image)
        cx, cy = img_w // 2, img_h // 2
        x1 = max(0, min(img_w - cw, cx - cw // 2))
        y1 = max(0, min(img_h - ch, cy - ch // 2))
        crop = src[y1:y1 + ch, x1:x1 + cw]
        crop_resized = cv2.resize(crop, (1280, 720))

        # Encode as JPEG
        _, buf = cv2.imencode(".jpg", crop_resized,
                              [int(cv2.IMWRITE_JPEG_QUALITY), 80])

        # Send to API
        t0 = time.perf_counter()
        try:
            resp = httpx.post(
                f"{api_url}/api/detect/image",
                files={"file": (img_path.name, buf.tobytes(), "image/jpeg")},
                timeout=15.0,
            )
            resp.raise_for_status()
            result = resp.json()
        except Exception as e:
            print(f"  API error for {img_path.name}: {e}")
            continue
        inf_ms = (time.perf_counter() - t0) * 1000

        # Predicted boxes in crop (1280×720) coords
        pred_boxes = []
        for det in result.get("detections", []):
            bx1, by1, bx2, by2 = det["bbox"]
            # Scale from inference output (may be 640-space) to 1280×720
            sx = 1280 / 640
            sy = 720 / 640
            pred_boxes.append([bx1 * sx, by1 * sy, bx2 * sx, by2 * sy])

        # Ground truth boxes (cropped to window, scaled to 1280×720)
        lbl_stem = img_path.stem
        label_path = Path(labels_dir) / f"{lbl_stem}.txt"
        gt_full = load_gt_boxes(str(label_path), img_w, img_h)
        gt_crop = clip_boxes_to_crop(gt_full, x1, y1, cw, ch)
        # Scale GT from crop-native coords to 1280×720
        gt_scaled = [
            [bx1 * 1280 / cw, by1 * 720 / ch, bx2 * 1280 / cw, by2 * 720 / ch]
            for bx1, by1, bx2, by2 in gt_crop
        ]

        tp, fp, fn = match_detections(pred_boxes, gt_scaled)
        tp_total += tp
        fp_total += fp
        fn_total += fn
        inf_times.append(inf_ms)

        rows.append({
            "image": img_path.name,
            "altitude_m": altitude_m,
            "gt_count": len(gt_scaled),
            "pred_count": len(pred_boxes),
            "tp": tp, "fp": fp, "fn": fn,
            "inf_ms": round(inf_ms, 1),
        })

    precision = tp_total / (tp_total + fp_total) if (tp_total + fp_total) > 0 else 0.0
    recall    = tp_total / (tp_total + fn_total) if (tp_total + fn_total) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    avg_inf = float(np.mean(inf_times)) if inf_times else 0.0

    return {
        "altitude_m": altitude_m,
        "n": len(rows),
        "tp": tp_total, "fp": fp_total, "fn": fn_total,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "avg_inf_ms": round(avg_inf, 1),
    }, rows


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Altitude robustness evaluation for GoldenEye simulation"
    )
    parser.add_argument("--dataset", required=True,
                        help="Directory of source images (e.g. real_data/images/test/)")
    parser.add_argument("--labels", required=True,
                        help="Directory of YOLO label files (e.g. real_data/labels/test/)")
    parser.add_argument("--output", default="simulation/output/altitude_eval.csv")
    parser.add_argument("--api",    default="http://localhost:8000",
                        help="Base URL of the GoldenEye API")
    parser.add_argument("--n",      type=int, default=50,
                        help="Images per altitude (default 50)")
    parser.add_argument("--seed",   type=int, default=42)
    parser.add_argument("--altitudes", nargs="+", type=int, default=ALTITUDES,
                        help="Altitudes to evaluate (default: all 8)")
    args = parser.parse_args()

    random.seed(args.seed)

    images = sorted(Path(args.dataset).glob("*.jpg")) + \
             sorted(Path(args.dataset).glob("*.png"))
    random.shuffle(images)
    if not images:
        raise ValueError(f"No images found in {args.dataset}")
    print(f"Found {len(images)} images. Using {args.n} per altitude.")

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    summary_rows = []
    all_detail_rows = []

    for alt in sorted(args.altitudes):
        print(f"\n── Altitude {alt}m ──")
        summary, detail = evaluate_altitude(
            images, args.labels, alt, args.api, args.n
        )
        print(
            f"  P={summary['precision']:.3f}  R={summary['recall']:.3f}  "
            f"F1={summary['f1']:.3f}  avg_inf={summary['avg_inf_ms']:.0f}ms  "
            f"(n={summary['n']})"
        )
        summary_rows.append(summary)
        all_detail_rows.extend(detail)

    # Write summary CSV (one row per altitude)
    with open(args.output, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(summary_rows[0].keys()))
        w.writeheader()
        w.writerows(summary_rows)
    print(f"\n✓ Summary → {args.output}")

    # Write detail CSV (one row per image×altitude)
    detail_path = args.output.replace(".csv", "_detail.csv")
    with open(detail_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(all_detail_rows[0].keys()))
        w.writeheader()
        w.writerows(all_detail_rows)
    print(f"  Detail  → {detail_path}")

    # Print summary table
    print("\n─── Altitude Robustness Summary ─────────────────────")
    print(f"{'Alt (m)':>8}  {'Prec':>6}  {'Recall':>7}  {'F1':>6}  {'Inf ms':>7}")
    print("─" * 45)
    for r in summary_rows:
        print(
            f"{r['altitude_m']:>8}  {r['precision']:>6.3f}  "
            f"{r['recall']:>7.3f}  {r['f1']:>6.3f}  {r['avg_inf_ms']:>7.1f}"
        )


if __name__ == "__main__":
    main()
