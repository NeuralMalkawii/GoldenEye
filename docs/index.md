# GoldenEye — Aerial Human Detection for Desert SAR

**GoldenEye** is an AI-based aerial human-detection system aimed at assisting
search-and-rescue (SAR) operations in desert environments. A YOLOv8n model,
fine-tuned on a private desert dataset, identifies humans from drone-view
imagery and returns bounding boxes with confidence scores. The system is
designed for future edge deployment on a Raspberry Pi 5 with AI acceleration.

## Quick facts

|  |  |
|---|---|
| **Model** | YOLOv8n (3,005,843 parameters, 8.1 GFLOPs) |
| **Class** | Single class — human |
| **Test mAP@0.5** | 0.979 |
| **Test precision / recall** | 0.975 / 0.985 |
| **Inference time** | 2.7 ms/image on Tesla T4 GPU |
| **Target hardware** | Raspberry Pi 5 with AI acceleration |
| **Authors** | Hamza Jad Allah · Suhaib Alajami · Omar Malkawi |
| **Supervisor** | Dr. Rami Al-Ouran · AlHussein Technical University |

## Detection modes

| Mode | Path | Description |
|---|---|---|
| Image | `/detect/image` | Upload a single image; receive an annotated result |
| Video | `/detect/video` | Upload a video; receive an annotated MP4 + per-frame CSV |
| Live  | `/live`         | Stream camera or screen-share frames over WebSocket |

## Running locally

```bash
git clone https://github.com/neuralmalkawii/GoldenEye
cd GoldenEye

# Backend
python -m uvicorn src.api.main:app --port 8000 --reload

# Frontend (in another shell)
cd src/frontend && npm run dev
```

Then open <http://localhost:3000>.

## Acknowledgements

The private desert dataset used for fine-tuning was obtained from the **Shaheen
project**. Their contribution is gratefully acknowledged.
