# GoldenEye — SAR Detection System

**GoldenEye** is a human detection system for aerial Search & Rescue operations in desert environments.
It runs a YOLOv8n model fully offline — on a Raspberry Pi 5 with Hailo-8L acceleration — with no cloud required.

## Quick facts

| | |
|---|---|
| **Model** | YOLOv8n · ONNX opset 20 · 11.7 MB |
| **mAP@0.5** | 0.979 on Shaheen real_data test split |
| **Latency** | ~42 ms per frame on CPU |
| **Deployment** | Web (Vercel + Railway) + Edge (Pi 5 + Hailo-8L) |
| **Team** | Omar Malkawi · Hamza Jad Allah · Suhaib Alajami |
| **Supervisor** | Dr. Rami Al-Ouran · HTU Capstone 2026 |

## Detection modes

| Mode | Path | Description |
|---|---|---|
| Image | `/detect/image` | Single-frame upload, annotated result in <100 ms |
| Video | `/detect/video` | Async Celery processing, download MP4 + CSV |
| Live | `/live` | Screen-share or webcam over WebSocket |

## Getting started

```bash
# Clone
git clone https://github.com/neuralmalkawii/GoldenEye
cd GoldenEye

# Start everything (Windows)
start.bat

# Or manually:
python -m uvicorn src.api.main:app --port 8000 --reload
cd src/frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Acknowledgments

The model and training data were contributed by the **Shaheen team** at the American University of Sharjah:
Yousef Irshaid, Malik Hader, Adham Elmosalamy, Ahmad Alsaleh, Dr. Mohamed Alhajri.
