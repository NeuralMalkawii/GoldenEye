# GoldenEye — AI Implementation Strategy

**For:** Omar, Hamza, Suhaib
**Scope:** Highest-accuracy human-detection model + demo app (image / video / live simulation), no drone yet.
**Date:** 2026-05-21

This document answers four questions in order: (1) which datasets and in what order, (2) which preprocessing per dataset, (3) which model and combination wins, (4) how to build the demo with a simulated drone view. Skeleton code lives in two companion files in this folder:

- `train_pipeline.py` — progressive fine-tuning skeleton
- `demo_app.py` — Gradio demo with three modes

---

## 1. Your dataset inventory

| Source | Type | Approx size | Domain | Notes |
|---|---|---|---|---|
| Shaheen real | Real aerial RGB | ~12 GB (~7,500 images) | UAE deserts, top-down + oblique | Closest to your deployment domain. Highest value per image. |
| Shaheen synthetic | Synthetic aerial RGB | ~8 GB (~90,000 images) | UAE-styled, simulated | Massive volume. Useful for scale, but synthetic-to-real gap is real. |
| HERIDAL | Real aerial RGB | ~1,500 images (1080p), tens of GB if you want | Wilderness/mountain SAR (Croatia) | High-altitude, small humans. Trains the small-object capability. |
| SARD (Kaggle) | Real aerial RGB | ~5,600 images | Mixed SAR scenarios | General SAR baseline. Diverse poses. |
| Doron_parson1 (Roboflow) | Real aerial RGB | varies, check size | Drone person detection | Likely drone-mounted, useful as another aerial generalizer. |
| Wadi Rum (TBD) | You will collect | 0 today, target 500–2,000 images | Jordan red-sand | This is your novelty. Highest scientific value per image. |

Total: roughly 105,000+ labeled images before you collect Wadi Rum. That's a strong corpus by any standard.

---

## 2. Training strategy — progressive fine-tuning (recommended)

Train **sequentially** in five stages, not all at once. The reason is that you want the model to learn general "person from above" first, then desert-specific features, then your deployment domain. If you mix everything from the start, the model's loss gets dominated by whichever dataset has the most images (your Shaheen synthetic 90K), and small but valuable datasets (Wadi Rum, real Shaheen) get under-weighted.

### Stage 0 — pretrained weights (free)
Start from `yolov8s.pt` or `yolov8m.pt` (pretrained on COCO, which already has the `person` class). Do **not** train from scratch. You inherit ~250,000 person bounding boxes for free.

### Stage 1 — generic aerial SAR pretraining
Train on the union of **HERIDAL + SARD + Doron_parson1**. Goal: teach the model "person seen from above, in natural outdoor environments, possibly small." Run for 50–80 epochs. Keep the best checkpoint on a held-out 10% split.

### Stage 2 — desert synthetic exposure
Fine-tune from Stage 1's checkpoint on **Shaheen synthetic (8 GB / ~90K)**. Goal: massive exposure to desert color palettes, dune textures, lighting. 30–50 epochs. Lower learning rate (10× lower than Stage 1).

### Stage 3 — desert real fine-tune
Fine-tune from Stage 2 on **Shaheen real (12 GB / ~7,500)**. Goal: bridge the sim-to-real gap, learn the true UAE distribution. 30–50 epochs. Lower learning rate again (another 3–5× lower).

### Stage 4 — target adaptation
Fine-tune from Stage 3 on **your Wadi Rum collection**. 10–20 epochs, very low learning rate, with strong early stopping. This is the smallest dataset but the most important — it's your deployment distribution.

**Why this order works:**
- Generic → specific is the textbook transfer-learning principle.
- Synthetic before real avoids the model over-fitting to synthetic artifacts that don't appear in reality.
- Real Shaheen UAE is closer to Wadi Rum than HERIDAL is, so it goes later.
- Wadi Rum last preserves what the model just learned about real desert humans, then specializes.

**Learning-rate schedule for sequential fine-tuning:**
- Stage 1: lr0 = 1e-3 (cosine, warmup 3 epochs)
- Stage 2: lr0 = 1e-4
- Stage 3: lr0 = 3e-5
- Stage 4: lr0 = 1e-5, freeze backbone for first 5 epochs then unfreeze

### Alternative — mixed training with sample weighting
If progressive fine-tuning is too time-consuming, you can train once on the union of all sets but with **per-sample weighting**: weight each Wadi Rum image 5×, each Shaheen real image 3×, each HERIDAL/SARD/Doron image 1×, each Shaheen synthetic image 0.3×. Achievable in Ultralytics via a custom sampler. Easier to run, harder to defend in the report. Progressive wins on both accuracy and pedagogical clarity.

### Run *both* and compare
For the report, you want a table. Train both pipelines and show which one wins on the same held-out test set. This is exactly the kind of methodological rigor that earns Distinction.

---

## 3. Preprocessing per dataset

Different datasets need different augmentation because they have different failure modes.

### HERIDAL + SARD + Doron_parson1 (generic SAR)
- Standard YOLO augmentations: mosaic 1.0, mixup 0.1, hsv_h 0.015, hsv_s 0.7, hsv_v 0.4, fliplr 0.5, scale 0.5.
- Multi-scale training (640 ± 160 px).
- **No** color-shift toward desert tones here — you want this stage to be domain-neutral.

### Shaheen synthetic
- **Aggressive** color jitter (hsv_v 0.6, hsv_s 0.9) to fight sim-to-real gap.
- Heavy mosaic and mixup.
- Add Gaussian noise (sigma 0.01–0.03) — synthetic data is too clean, real cameras are noisy.
- Light JPEG compression artifacts (quality 70–90 random).
- Random brightness gradient to simulate sun direction.

### Shaheen real
- Reduce color jitter (hsv_v 0.3) — these images already have the right colors, don't destroy them.
- Add **CLAHE** preprocessing (Contrast Limited Adaptive Histogram Equalization) on L-channel — well documented to help low-contrast desert imagery.
- Glare simulation: random bright patches on the image (occasional, 10% probability).
- Heat haze: small wavy distortion field (rare, 5%).
- Motion blur: light kernel (3×3) at 15% probability — drone vibration is real.

### Wadi Rum collection
- Match Shaheen real preprocessing.
- Plus: **color jitter biased toward red** to teach robustness across red-sand variations.
- Copy-paste augmentation: paste known-good human crops from Shaheen real onto Wadi Rum backgrounds (and vice versa) to multiply your effective small dataset.

### Universal techniques worth applying everywhere
- **Mosaic** at 1.0 for first 80% of epochs, **disable at final 20%** (Ultralytics best practice).
- **Multi-scale training** with image sizes in {512, 640, 768, 896}.
- **Test-Time Augmentation (TTA)** at inference for the evaluation pass — gives 1–2% mAP boost.
- **SAHI (Slicing Aided Hyper Inference)** for high-altitude images where humans are <32 px. Crucial if your drone flies at 50–100 m AGL.

---

## 4. Model choice — what to train and why

### Recommended primary: YOLOv8s (deployment) + YOLOv8m (research)

Train both. YOLOv8s is what you'll deploy on Hailo-8L; YOLOv8m is what you'll report as your accuracy ceiling.

**Why YOLOv8 (not v11 or v12):**
- **Hailo Dataflow Compiler officially supports YOLOv8** with documented export paths. v11/v12 support exists but is younger and more fragile.
- Massive ecosystem (Ultralytics), best documentation, easiest to defend at viva.
- Edge-friendly variants (n, s) maintain real-time speed.

**Why two sizes:**
- YOLOv8s on Hailo-8L will hit ~60+ FPS — your deployment target.
- YOLOv8m as a research baseline shows what's achievable when not constrained by edge hardware. The gap quantifies your edge-deployment cost.

### Worth considering as secondary models
- **YOLOv11s** — if Ultralytics + Hailo SDK supports it cleanly by the time you train, swap it in. Slight accuracy edge over v8s at similar speed.
- **RT-DETR-L** — transformer-based, often higher mAP, slower. Train one for the research table. Won't run on Hailo but will run on your dev box.
- **YOLO-NAS-S** — Deci's NAS-designed detector. Sometimes wins on small-object benchmarks. Try it for completeness.

### Ensemble for maximum accuracy
For the headline number in your report, ensemble:
- YOLOv8m (your best single model)
- YOLOv11s
- RT-DETR-L

Combine with **Weighted Box Fusion (WBF)** — better than NMS for ensembling. Use the `ensemble-boxes` Python library. Expect +2–4% mAP over the best single model. This is your "max accuracy" claim.

### What "best accuracy" probably looks like
A reasonable target progression on a held-out Shaheen real test set:
- Stage 1 only: ~70–75% mAP@0.5
- Stage 2 (added synthetic): ~78–82%
- Stage 3 (added real Shaheen): ~88–93%
- Stage 4 (added Wadi Rum): ~91–95% (on Wadi Rum), ~88–92% (on Shaheen real, may dip slightly)
- Ensemble: ~93–96%

Shaheen reported 98% accuracy. Treat that as a number to beat carefully — accuracy without a defined metric (mAP@0.5? mAP@0.5:0.95? confidence threshold?) is impossible to compare directly. In your report, always state the metric.

---

## 5. Evaluation methodology

Define this up front and never deviate:

- **Primary metric:** mAP@0.5 on held-out test set.
- **Secondary:** mAP@0.5:0.95, precision, recall, F1.
- **Per-dataset eval:** evaluate each stage's checkpoint on every dataset's test split. Builds the cross-dataset matrix that demonstrates generalization.
- **Held-out splits:** never train on the test split. 80/10/10 train/val/test, frozen up front.
- **Confidence threshold:** 0.25 for mAP computation (standard), but report precision-recall curves so you can pick operating points later.
- **Edge inference:** also report FPS on Pi 5 + Hailo-8L for each deployed model.

The cross-dataset evaluation matrix is your headline figure:

```
                Test on →
                Shaheen real | Wadi Rum | HERIDAL | SARD | Combined
Train on ↓
COCO base           low         low       moderate  mod    low
+ Stage 1           low         low       high      high   moderate
+ Stage 2           moderate    low       high      high   high
+ Stage 3           high        moderate  moderate  mod    high
+ Stage 4           high        high      moderate  mod    high (ceiling)
Ensemble            very high   high      high      high   very high
```

Fill the cells with real numbers. Panels love this kind of table.

---

## 6. Demo system — image / video / live simulation

You want three modes plus a simulated drone flight. Recommended stack:

### Stack
- **Backend:** Python 3.11, Ultralytics YOLOv8, OpenCV, FastAPI (optional if you want a REST API).
- **UI:** **Gradio** — fastest to build, demo-friendly, supports image/video/webcam tabs natively. Streamlit also fine.
- **Live screen capture:** `mss` library — fast cross-platform screen-region capture.
- **Simulation:** see § 6.3.

### 6.1 Image mode
Drag and drop an image → run inference → return image with bounding boxes, confidence scores, count of detected humans. Trivial — Gradio's `gr.Image` does this in 30 lines.

### 6.2 Video mode
Upload a video → process frame-by-frame (or every Nth frame for speed) → return annotated video. Output also includes a CSV of (frame, bbox, confidence) for later analysis. Use OpenCV's VideoCapture/VideoWriter or `ffmpeg-python`.

### 6.3 Live simulation mode
Two clean options, listed by sophistication:

**Option A (recommended for capstone) — AirSim / Cosys-AirSim with Unreal Engine 5**

[Cosys-AirSim](https://github.com/Cosys-Lab/Cosys-AirSim) is the actively maintained fork of Microsoft AirSim (which was archived in 2022). It has:
- Unreal Engine 5 photorealistic deserts (free assets from Quixel Megascans).
- Python API to programmatically fly a drone and pull the camera feed.
- Built-in sensor models including RGB, depth, segmentation.

Workflow:
1. Install UE5 + Cosys-AirSim plugin.
2. Use a free desert scene asset (Quixel "Dune", Epic's "Desert" packs).
3. Drop 3D human models from MetaHumans or Mixamo into the scene at known coordinates.
4. Write a Python script that flies a virtual drone in a lawn-mower pattern.
5. Capture the camera feed → push frames to your YOLOv8 model → overlay detections.
6. Log ground-truth vs detected coordinates → quantitative simulation metric.

This is the most defensible option — it gives you a quantitative simulation evaluation, not just a visual demo. Plan ~2–3 weeks for someone on the team to learn UE5 well enough.

**Option B (faster, less impressive) — Pre-recorded desert flyover + screen capture**

1. Find a Creative Commons aerial desert video on YouTube/Pexels (or shoot one with a phone).
2. Optionally composite human figures in using After Effects or even ffmpeg overlays.
3. Play it back in any media player at fullscreen.
4. The "Live Screen" mode in your demo captures the screen region with `mss` and runs YOLOv8 on it in real time.

You can ship this in two days. Less impressive than Option A but works as a fallback.

**Option C (cheap, technically correct) — Google Earth Studio**

Google Earth Studio lets you script camera flights over real terrain. Wadi Rum and Empty Quarter both have high-resolution satellite imagery there. You won't have controllable human models in the scene, but you'll have realistic desert footage for free. Combine with screen capture mode.

### 6.4 Screen-share / screen-capture mode
The Live Simulation mode uses `mss` to grab a region of the screen at N FPS and feed it to YOLOv8. Works with any source on screen — Cosys-AirSim, Google Earth Studio, YouTube video, anything. This is the universal pipeline: whatever's on screen, the model sees it.

If you want to support remote screen sharing (you watching a teammate's screen), use OBS Virtual Camera as an intermediary — OBS receives the shared screen, exposes it as a virtual webcam, and your Gradio app reads from that webcam.

### 6.5 What the UI looks like

A Gradio app with four tabs:

1. **Image** — drop image, see boxes.
2. **Video** — drop video, see annotated video + detection CSV download.
3. **Live Screen** — pick a screen region, see live detection overlay; toggle to record session.
4. **Simulation Eval** — (Option A only) load a Cosys-AirSim mission log, see per-frame ground-truth vs detected coords, get accuracy stats.

---

## 7. Putting it on a timeline

If you've got, say, 12 weeks of capstone left:

- **Week 1–2:** Set up training infrastructure. Download and standardize datasets to YOLO format. Build the demo app shell (image + video modes), with COCO-pretrained YOLOv8 as a placeholder model so the team can demo something this week.
- **Week 3:** Stage 1 training (generic SAR). Verify everything works end-to-end with the demo app.
- **Week 4:** Stage 2 training (synthetic).
- **Week 5:** Stage 3 training (Shaheen real). This is when results start looking good.
- **Week 6:** Wadi Rum data collection (in parallel with Week 5 training).
- **Week 7:** Stage 4 training + ensemble. Hit your accuracy ceiling.
- **Week 8–9:** Build the Cosys-AirSim simulation and integrate it with the demo.
- **Week 10:** Hailo-8L export and on-device benchmarking (separate from the model strategy, but key for the deployment story).
- **Week 11:** Write up evaluation results, build cross-dataset matrix, finalize ablation table.
- **Week 12:** Final report, deck, viva prep.

---

## 8. Key risks and how to handle them

- **Dataset label mismatch.** Each source uses different class labels and bbox formats. Standardize everything to YOLO format with a single class `person` (or two: `person`, `vehicle`). Write a converter once. Sanity-check by visualizing 50 random boxes from each source.
- **Synthetic-to-real shift.** If after Stage 2 the model accuracy on Shaheen real *drops* below Stage 1, the synthetic data is too out-of-distribution. Mitigation: stronger augmentation in Stage 2, or weight synthetic samples down.
- **Catastrophic forgetting in sequential fine-tuning.** Stage 4 might destroy what Stage 3 learned. Mitigation: freeze the backbone for the first few epochs of each new stage; or use **Elastic Weight Consolidation** (EWC) if you want to get fancy.
- **Hailo runtime accuracy drop.** Quantizing FP32 → INT8 for Hailo can drop mAP by 1–3%. Plan for post-training quantization with calibration set, and report both fp32 and int8 numbers.
- **Wadi Rum data delay.** If you can't collect Wadi Rum imagery in time, Option B: synthesize it. Take Shaheen images, retint sand toward red, paste in clothing variations. Document this honestly as "approximate Wadi Rum domain via color transfer."

---

## 9. The honest single-paragraph answer

If you only do one thing: take YOLOv8s pretrained on COCO, do progressive fine-tuning HERIDAL+SARD+Doron → Shaheen synthetic → Shaheen real → Wadi Rum with stage-by-stage decreasing learning rates and CLAHE preprocessing on the real desert stages; evaluate on every dataset's held-out split to build a cross-environment matrix; also train YOLOv8m and ensemble with WBF for the headline number; deploy YOLOv8s to Hailo-8L. For the demo, build a Gradio app with image / video / live-screen modes, and use Cosys-AirSim with a UE5 desert scene to fly a virtual drone for the live mode. That combination, executed cleanly, beats Shaheen on cross-environment generalization and is a strong capstone.

---

## 10. Files in this folder

- `GoldenEye_Review_and_Shaheen_Integration.md` — the report-and-deck review from the previous session.
- `GoldenEye_AI_Implementation_Strategy.md` — this document.
- `train_pipeline.py` — progressive fine-tuning skeleton you can fill in and run.
- `demo_app.py` — Gradio demo skeleton with three modes.

Tell me which piece you want to drill into next — I can expand any section, write the actual training configs (yaml files for each stage), build the data converter, or sketch the Cosys-AirSim integration in more detail.
