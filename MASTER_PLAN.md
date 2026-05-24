# GoldenEye — Master Implementation Plan

**Owner:** Omar Malkawi
**Team:** Hamza Jad Allah, Suhaib Alajami, Omar Malkawi
**Supervisor:** Dr. Rami Al-Ouran
**Plan revision:** v1.1 — 2026-05-24 (adds HERIDAL.yolov8; renames `train/` → `doron_parson1`)
**Status:** Approved for execution

This master plan is the canonical reference for the GoldenEye project. It supersedes informal task lists and prior recommendation docs (`GoldenEye_Review_and_Shaheen_Integration.md`, `GoldenEye_AI_Implementation_Strategy.md`), both of which remain valid background material.

The plan is organized into ten phases. Each phase has a goal, deliverables, tasks, owners, dependencies, and a definition of done. Phase 1 — the research and experimentation phase you asked for — is the longest and most prescriptive.

---

## Table of Contents

1. [Dataset reality check](#0-dataset-reality-check)
2. [Tech stack overview](#tech-stack-overview)
3. [Phase 0 — Foundation & Setup](#phase-0--foundation--setup)
4. [Phase 1 — Research & Experimentation (Notebooks)](#phase-1--research--experimentation-notebooks)
5. [Phase 2 — Production Training Pipeline](#phase-2--production-training-pipeline)
6. [Phase 3 — Backend Inference Service](#phase-3--backend-inference-service)
7. [Phase 4 — Modern Frontend (Image / Video / Live)](#phase-4--modern-frontend-image--video--live)
8. [Phase 5 — Simulation Environment](#phase-5--simulation-environment)
9. [Phase 6 — Edge Deployment (Hailo + Pi 5)](#phase-6--edge-deployment-hailo--pi-5)
10. [Phase 7 — Testing, Validation, Monitoring](#phase-7--testing-validation-monitoring)
11. [Phase 8 — Documentation & Knowledge Base](#phase-8--documentation--knowledge-base)
12. [Phase 9 — Deployment & DevOps](#phase-9--deployment--devops)
13. [Phase 10 — Capstone Deliverables & Defense](#phase-10--capstone-deliverables--defense)
14. [Cross-cutting features beyond what you mentioned](#cross-cutting-features-beyond-what-you-mentioned)
15. [Risk register](#risk-register)
16. [12-week timeline](#12-week-timeline)

---

## 0. Dataset reality check

What I actually found in `Datasets/` (revised v1.1):

| Folder | Format | Images | Resolution | Labels | Notes |
|---|---|---|---|---|---|
| `SARD-Dataset-search-and-rescue/` | YOLO (Roboflow export) | 5,755 (train 4,041 / val 1,144 / test 570) | 640×640 (pre-tiled 3×3) | 1 class `human` | Plug-and-play. Strong baseline source. |
| `real_data/` (Shaheen real) | CSV+JSON (Label Studio %) | 7,056 (train 4,939 / val 706 / test 1,411) | 3840×2160 (4K) | `human` + `without human` (negatives) | **Needs format conversion.** Median bbox 68×67 px → small-object problem. Altitudes 20–95 m tagged. |
| `synthetic_data/` (Shaheen synthetic) | folders only | 59,820 (14,866 with human / 44,954 without) | mixed | **NO bounding boxes** — only classification by folder | Confirmed no annotated Roboflow version exists. Pseudo-labeling required (Notebook 03). Structured by degradation × altitude. |
| **`HERIDAL.yolov8/`** ⭐ NEW | YOLO (Roboflow export) | 1,600 (1,040 positive + 560 negatives) | 4000×3000 (12 MP) | 1 class `person`, 3,194 boxes total | **Only `train/` split present — needs 80/10/10 resplit.** Mean box dimension 66 px (range 19–203 px) → very small targets. Wilderness/mountain SAR domain (Croatia originally). Reinforces SAHI requirement. |
| `doron_parson1/` (renamed from previous `train/`) | YOLO (Roboflow export) | 616 | 4000×2250 | 1 class `person`, 858 boxes | In-house DJI aerial collection. Single split — needs 80/10/10 resplit. |

**Total usable detection data after conversion + HERIDAL split + pseudo-labeling:** **~74,847 labeled images.**

### What HERIDAL adds to the plan

HERIDAL is not "yet another SAR dataset" — it shifts the project in three concrete ways:

1. **Out-of-domain robustness signal.** HERIDAL is wilderness/forest/mountain terrain, very different from desert. A model that fine-tunes on HERIDAL first and still generalizes to UAE desert proves true *cross-environment generalization*, not just memorization of UAE color statistics. The cross-dataset matrix (NB12) gains a column nobody else has.
2. **Small-object signal-to-noise improvement.** With 3,194 boxes averaging 66 px at 4000×3000 (and minimum 19 px), HERIDAL is one of the hardest small-object benchmarks in SAR. Wins on HERIDAL transfer directly to the high-altitude regime of real_data.
3. **Negative samples for false-positive reduction.** 560 background images (rocks, vegetation, terrain) without people. Mine these as hard negatives in Stage 1 — the wilderness scene clutter is qualitatively different from desert clutter, broadening the model's "what a person is NOT" prior.

Key implications this changes from yesterday's strategy:

1. **A new sub-stage is required before Stage 2**: pseudo-labeling the synthetic data. Without bounding boxes those 59,820 images are detection-useless.
2. **High-resolution + small-object pipeline is mandatory**. Median target is 68×67 px in 4K — at 640 px input the targets become 11×11 px. **SAHI tiling** during both training and inference is not optional; it is the core technique.
3. **Altitude-stratified evaluation becomes the headline experiment**. Both real and synthetic data are tagged by altitude. You can publish a "performance vs altitude" curve that nobody else has — including Shaheen. This is your strongest novel contribution.
4. **Degradation-stratified robustness** is also free for the taking. Shaheen synthesized three degradation levels — train once, evaluate at low/mod/severe to show robustness.
5. **Negatives are abundant** (3,814 real + 44,954 synthetic without-human). Use them for hard-negative mining and false-positive-rate reporting.

---

## Tech stack overview

Cutting-edge, fast, current as of mid-2026. All choices justified inline.

**ML / training stack**
- **PyTorch 2.4+** with `torch.compile` for 1.5–2× speedup during training.
- **Ultralytics YOLOv8 & YOLOv11** — official Hailo support, fastest path to a deployable model.
- **RT-DETR-L** — transformer detector for the ensemble; higher mAP ceiling.
- **Albumentations** — fast augmentation library; better than torchvision for detection.
- **SAHI (Slicing Aided Hyper Inference)** — small-object detection at 4K.
- **Weighted Box Fusion (`ensemble-boxes`)** — better than NMS for ensembling.
- **Weights & Biases** — experiment tracking; free for academic use.
- **Hydra** — config management (so every notebook and script reads the same YAML).
- **DVC** — data version control; tracks dataset versions in git without bloating it.
- **MLflow** — model registry with staged promotion (Dev → Staging → Production).

**Inference / serving stack**
- **FastAPI + Uvicorn** — async Python web framework. Fast, typed, OpenAPI docs out of the box.
- **ONNX Runtime** — cross-platform inference; faster than vanilla PyTorch for serving.
- **TensorRT** (optional, x86 GPU) — NVIDIA's optimized runtime; 2–5× faster than ONNX RT.
- **Hailo Dataflow Compiler** — for the Pi 5 + Hailo-8L deployment target.
- **Redis** — task queue backend for async video processing.
- **Celery** — distributed task workers for long-running video jobs.
- **NVIDIA Triton Inference Server** (optional) — production-grade model server with multi-model scheduling. Use if you want to look extra polished.

**Frontend stack**
- **Next.js 14+ (App Router)** with **TypeScript** — modern React, server components, edge runtime.
- **Tailwind CSS** + **shadcn/ui** — utility-first styling + premium component primitives.
- **Framer Motion** (now `motion`) — page transitions, micro-interactions, staggered animations.
- **Three.js + react-three-fiber** — 3D scenes for the "drone view" widget on the landing page.
- **Recharts** — analytics charts (accuracy curves, altitude robustness curves).
- **Mapbox GL JS** or **Leaflet** — geotagged detection map (Wadi Rum + UAE focus).
- **TanStack Query** — server-state caching for detection results.
- **Zustand** — client state (live mode toggle, region selection).
- **next-themes** — dark/light mode.
- **next-intl** — internationalization (English + Arabic from day one).

**Real-time / streaming**
- **WebSockets** (via FastAPI) — for live screen-capture detection stream.
- **WebRTC + MediaSoup** (optional) — peer-to-peer screen share without server round-trip.
- **Server-Sent Events (SSE)** — simpler alternative for one-way streams.

**Simulation**
- **Unreal Engine 5.4+** with **Cosys-AirSim** plugin — photorealistic desert, programmatic drone flight, ground-truth labels for free.
- **Quixel Megascans** desert assets — free with UE5.
- **MetaHuman + Mixamo** — animated 3D humans placed at known coordinates.
- **PX4 SITL** (optional, for autopilot realism) — Software-in-the-Loop autopilot.

**Edge deployment**
- **Raspberry Pi OS 64-bit (Bookworm)**.
- **Hailo Tappas SDK** — runtime + pipelines.
- **GStreamer** — video pipeline glue on the Pi.
- **MAVLink** + **DroneKit-Python** / **PyMAVLink** — flight controller bridge.

**DevOps / infra**
- **Docker** + **Docker Compose** — reproducible local environment.
- **GitHub Actions** — CI/CD; auto-test, auto-build images, auto-deploy.
- **Pre-commit hooks** — Black, Ruff, MyPy, ESLint, Prettier.
- **Hosting**: backend on **Railway** or **Fly.io** (free academic tier), frontend on **Vercel** (free for hobby), model artifacts in **Hugging Face Hub** (free).
- **NGINX** — reverse proxy + TLS termination if self-hosting.
- **Prometheus + Grafana** — metrics and dashboards.

**Documentation**
- **MkDocs Material** — project docs site (hosted on GitHub Pages, free).
- **Mermaid** — diagrams embedded in markdown (sequence, component, state machine).
- **Jupyter Book** — turn the Phase 1 notebooks into a public-facing scientific report.

---

## Phase 0 — Foundation & Setup

**Goal:** Everyone on the team can clone the repo, run training, run the demo, and contribute code without friction.

**Duration:** 4–5 days.

**Deliverables:**
- Monorepo at `github.com/<team>/goldeneye` with the canonical structure below.
- `pyproject.toml` + `uv.lock` for reproducible Python env (`uv` is the fastest Python installer in 2026).
- `docker-compose.yml` to bring up the full local stack.
- Pre-commit hooks installed and passing.
- W&B / MLflow / DVC accounts set up and linked.

**Canonical repository layout:**

```
goldeneye/
├── README.md                       # 5-minute pitch + quickstart
├── pyproject.toml
├── uv.lock
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── ci.yml                  # lint + test on PR
│       ├── train-nightly.yml       # optional: scheduled retrains
│       └── deploy.yml              # auto-deploy on tag
├── data/                           # DVC-tracked, not in git
│   ├── raw/                        # SARD, real_data, synthetic_data, HERIDAL, doron_parson1
│   ├── interim/                    # converted to YOLO + 80/10/10 splits
│   ├── processed/                  # tiled, augmented, split
│   └── pseudo_labels/              # synthetic data pseudo-labels
├── notebooks/                      # Phase 1 experiment notebooks
│   ├── 01_eda_dataset_inventory.ipynb
│   ├── 02_label_unification.ipynb
│   ├── 03_synthetic_pseudo_labeling.ipynb
│   ├── 04_preprocessing_experiments.ipynb
│   ├── 05_baseline_yolo.ipynb
│   ├── 06_progressive_finetuning.ipynb
│   ├── 07_mixed_training.ipynb
│   ├── 08_model_zoo_comparison.ipynb
│   ├── 09_sahi_small_objects.ipynb
│   ├── 10_ensemble_wbf.ipynb
│   ├── 11_quantization_hailo.ipynb
│   ├── 12_cross_dataset_eval.ipynb
│   ├── 13_error_analysis.ipynb
│   ├── 14_altitude_robustness.ipynb
│   └── 15_degradation_robustness.ipynb
├── src/
│   ├── goldeneye/                  # main Python package
│   │   ├── data/
│   │   │   ├── converters/         # CSV→YOLO etc.
│   │   │   ├── splits.py
│   │   │   └── augment.py          # Albumentations pipelines
│   │   ├── models/
│   │   │   ├── yolov8.py
│   │   │   ├── rtdetr.py
│   │   │   ├── ensemble.py
│   │   │   └── registry.py
│   │   ├── training/
│   │   │   ├── progressive.py      # 4-stage curriculum
│   │   │   ├── mixed.py            # weighted-sampler approach
│   │   │   └── callbacks.py
│   │   ├── inference/
│   │   │   ├── sahi_predictor.py
│   │   │   ├── stream.py           # frame queue + worker
│   │   │   └── postproc.py         # NMS + temporal filter
│   │   ├── eval/
│   │   │   ├── matrix.py           # cross-dataset matrix
│   │   │   ├── altitude.py
│   │   │   └── degradation.py
│   │   └── utils/
│   ├── api/                        # FastAPI backend
│   │   ├── main.py
│   │   ├── routes/
│   │   ├── ws.py                   # WebSocket live stream
│   │   └── workers.py              # Celery tasks
│   └── frontend/                   # Next.js app
│       └── (Phase 4 layout)
├── configs/                        # Hydra YAMLs
│   ├── data/{sard,real,synthetic,train,wadi_rum}.yaml
│   ├── model/{yolov8s,yolov8m,yolov11,rtdetr}.yaml
│   ├── train/{stage1,stage2,stage3,stage4,mixed}.yaml
│   └── augment/{generic,desert_real,desert_synth,wadi_rum}.yaml
├── deploy/
│   ├── hailo/                      # ONNX → HEF compilation
│   ├── pi5/                        # Raspberry Pi deployment scripts
│   └── docker/                     # production Dockerfiles
├── simulation/
│   ├── airsim_settings.json
│   ├── flight_scripts/
│   └── unreal_project/             # UE5 project (git LFS)
├── docs/                           # MkDocs site
│   ├── index.md
│   ├── architecture.md
│   ├── data.md
│   ├── training.md
│   ├── inference.md
│   ├── simulation.md
│   ├── deployment.md
│   └── api.md
└── tests/                          # pytest
    ├── unit/
    ├── integration/
    └── e2e/
```

**Tasks:**

- `P0.1` Create the GitHub org/repo. Add team as maintainers. (Omar, 1h)
- `P0.2` Bootstrap with `uv init`, add deps, commit `pyproject.toml` + `uv.lock`. (Omar, 2h)
- `P0.3` Install pre-commit (Black, Ruff, MyPy, ESLint, Prettier, nbstripout for notebooks). (Suhaib, 1h)
- `P0.4` Set up DVC pointed at a free remote (Hugging Face Hub or Google Drive). Track `data/`. (Omar, 2h)
- `P0.5` Set up Weights & Biases project. Add WANDB_API_KEY to GitHub secrets. (Hamza, 1h)
- `P0.6` Set up MLflow either self-hosted on Railway or via Databricks Community Edition. (Hamza, 2h)
- `P0.7` Write `docker-compose.yml` that brings up: training-jupyter (GPU optional), api, redis, frontend, mlflow. (Suhaib, 4h)
- `P0.8` GitHub Actions CI: `pytest`, `ruff check`, `mypy`, build frontend. (Suhaib, 3h)
- `P0.9` Write a one-page `CONTRIBUTING.md` and a five-minute `README.md` quickstart. (Omar, 2h)

**Definition of done:** A new team member, given only the repo URL, can run `make setup && make train-stage1` and see a model training within 15 minutes.

---

## Phase 1 — Research & Experimentation (Notebooks)

**Goal:** Empirically discover the best combination of (preprocessing × dataset order × model × ensemble) for our actual data. Every claim in the final report is backed by a notebook.

**Duration:** 4 weeks (this is the longest phase by design).

**Owner:** Hamza (lead), Omar (eval), Suhaib (data tooling).

Each notebook below has a fixed structure:

```
1. Objective + hypothesis
2. Data loading
3. Experiment(s)
4. Quantitative results (table + chart)
5. Qualitative results (sample images / failure modes)
6. Conclusion + decision for the production pipeline
7. Promote chosen artifacts to MLflow registry
```

### Notebook 01 — EDA & dataset inventory

Reproduce and visualize the analysis done in section 0 of this doc. Cover:
- Image count, resolution histogram, channel statistics (RGB mean/std) per dataset.
- Bounding box size distribution (this drives the small-object decision).
- Class balance, positive/negative ratio.
- Altitude and degradation distribution (synthetic + real).
- Sample grid (8 randoms per dataset) so the reader can see what each set looks like.
- Identify duplicates with perceptual hashing (`imagehash` library).

**Output:** `reports/eda.html` (a generated standalone HTML page).

### Notebook 02 — Label format unification

Convert everything to YOLO format with a single class `0: person`. Specifically:
- `real_data/annotations.csv` (Label Studio JSON %) → YOLO normalized txt with 80/10/10 split.
- `SARD-Dataset-search-and-rescue/` → already YOLO with train/valid/test; verify and rebase paths.
- **`HERIDAL.yolov8/`** → already YOLO but only `train/` exists. Resplit **stratified by image-has-boxes-or-not** into 80/10/10 with `SEED=42` so positives and negatives are proportionally distributed across all three splits. Critical because of the 1,040/560 imbalance.
- `doron_parson1/` → already YOLO, single split. Resplit 80/10/10 with `SEED=42`.
- `synthetic_data/` → defer to Notebook 03 (needs pseudo-labels first).
- Generate `configs/data/*.yaml` files referenced by the training scripts.
- Sanity check: render 50 random bboxes per dataset onto the images and visually confirm.

### Notebook 03 — Synthetic data pseudo-labeling

The synthetic data has no boxes — only folder labels. Strategy:
1. Use the **best available off-the-shelf detector** as a teacher: YOLOv8x pretrained on COCO + a quick fine-tune on real_data (5 epochs).
2. Run teacher inference on every "with human" synthetic image at multiple confidence thresholds.
3. Filter: keep predictions with conf ≥ 0.5; reject images where teacher predicts zero humans (the synthetic image clearly has humans but they're tiny — flag for manual review).
4. For "without human" folder, assert teacher predicts zero; if not, save as "hard negative" examples.
5. Manually spot-check 200 random pseudo-labels. Quality threshold: ≥90% IoU agreement on a manual review subset.
6. Save final pseudo-labels under `data/pseudo_labels/synthetic/`.

**Alternative**: use **Grounding DINO** (text-prompted detector with prompt "person from above") as the teacher — slower but more accurate on aerial views.

### Notebook 04 — Preprocessing experiments

Sweep preprocessing combinations on a frozen base model (YOLOv8s, 20 epochs each, real_data only):

| Experiment | Preprocessing |
|---|---|
| baseline | resize 640, no augmentation beyond YOLO defaults |
| clahe | CLAHE on L-channel |
| clahe + denoise | CLAHE + bilateral filter |
| histogram_match | match to a "canonical desert" histogram |
| color_jitter_heavy | aggressive HSV |
| copy_paste | paste positive crops on background images |
| mosaic_off | no mosaic (control) |
| mosaic + mixup | both on |
| heat_haze_sim | wave-distortion augmentation |
| glare_sim | random bright patches |
| motion_blur | small kernel |
| all_desert | union of clahe + glare + motion_blur + copy_paste |

Report mAP@0.5 and FPS on validation. Pick the top-3 combinations to take forward.

### Notebook 05 — Baseline YOLO training

Train YOLOv8s, 80 epochs, on the **union** of SARD + real_data + train (with chosen preprocessing). This is the "naive baseline" that all later experiments must beat.

### Notebook 06 — Progressive fine-tuning curriculum

Implement the 4-stage curriculum, now using the **actual** datasets we have (revised v1.1 to include HERIDAL):

| Stage | Data | Epochs | lr0 | imgsz | Augmentation |
|---|---|---|---|---|---|
| 1 | **HERIDAL + SARD + doron_parson1** | 80 | 1e-3 | 768 (HERIDAL needs higher res for its small boxes) | generic SAR; include all 560 HERIDAL negatives + 571 SARD background images for hard-negative mining |
| 2 | synthetic_data (pseudo-labeled in NB03) | 50 | 1e-4 | 640 | aggressive sim-to-real (heavy HSV jitter, Gaussian noise, JPEG artifacts) |
| 3 | real_data | 50 | 3e-5 | 768 | desert real (top-3 from NB04: CLAHE + glare sim + motion blur) |
| 4 | Wadi Rum (when collected) | 20 | 1e-5 | 768 | red-sand HSV bias; copy-paste from real_data positives onto Wadi Rum backgrounds |

**Why HERIDAL is in Stage 1, not its own stage:** Stage 1 is the "general aerial human" foundation. HERIDAL + SARD + doron_parson1 together cover wilderness, mixed terrain, and drone-captured generic scenes — the right diversity to teach the model "person seen from above" without locking it to any one biome. Carving HERIDAL into a separate stage would either over-fit to forest features or under-utilize its small-object signal.

**Stage 1 image budget after this change:** 1,600 (HERIDAL) + 5,755 (SARD) + 616 (doron_parson1) = **7,971 images**, of which **1,131 are explicit negatives** (560 HERIDAL + 571 SARD). This is a healthy positive/negative balance that the model needs to learn what a person is NOT.

Track every checkpoint in MLflow. Evaluate each stage on every test set to build the cross-dataset matrix.

### Notebook 07 — Mixed training with weighted sampling

Train **once** on the union of all data with per-sample weights:
- Wadi Rum: 5× (when available)
- real_data: 3×
- SARD: 1×
- train/: 1×
- synthetic (high-conf pseudo-labels only): 0.5×
- synthetic (low-conf): 0.2×

Implement via Ultralytics custom dataloader with `WeightedRandomSampler`. Compare directly to NB06 on the same held-out test set.

### Notebook 08 — Model zoo comparison

Train each of the following from COCO pretrain on the **best preprocessing from NB04** + the **best curriculum from NB06/NB07**, 40 epochs each, identical eval:

| Model | Params | Why included |
|---|---|---|
| YOLOv8n | 3M | Edge floor; what fits on Pi 5 without Hailo |
| YOLOv8s | 11M | **Primary deployment candidate** |
| YOLOv8m | 26M | Higher-accuracy single model |
| YOLOv11s | 9M | Successor; check if better at same size |
| YOLOv11m | 20M | Higher-accuracy successor |
| RT-DETR-L | 32M | Transformer alternative; potential ensemble member |
| YOLO-NAS-S | 12M | NAS-designed; sometimes wins on small objects |
| RTMDet-S | 9M | Open-mmlab; another strong baseline |

Output: a Pareto plot of mAP@0.5 vs FPS, with the chosen production model highlighted.

### Notebook 09 — SAHI for small objects

Given the 4K resolution + ~68 px median bbox, SAHI is mandatory. Test:
- Tile sizes: 512, 640, 1024.
- Overlap ratios: 0.1, 0.2, 0.3.
- Patch postprocessing: NMS vs WBF.
- Sliced vs full-frame inference timing.

Report the configuration that maximizes mAP@0.5 on real_data test set while staying under 2× the unsliced inference time.

### Notebook 10 — Ensemble with Weighted Box Fusion

Build the headline accuracy number:
- Pick top-3 models from NB08.
- For each test image, run all 3 → collect predictions → fuse with `ensemble-boxes.weighted_boxes_fusion`.
- Hyperparameter-sweep WBF weights, IoU threshold, skip-box threshold.
- Optionally add Test-Time Augmentation (horizontal flip + multi-scale) to each ensemble member.
- Report ensemble vs best single model on every test set.

### Notebook 11 — Quantization + Hailo prep

- Export the chosen production model (YOLOv8s) to ONNX with opset 12 (Hailo requirement).
- Run Hailo Dataflow Compiler simulation in software (Hailo-8L emulator).
- Calibrate INT8 quantization with 500 images from real_data train split.
- Compare FP32 / FP16 / INT8 mAP@0.5 — quantify the quantization cost.
- Document the exact CLI commands and the resulting `.hef` (Hailo Executable Format) file size.

### Notebook 12 — Cross-dataset evaluation

The headline figure of the report. Train-on / test-on matrix (v1.1 — HERIDAL column added):

| Train ↓ / Test → | HERIDAL test | SARD test | doron_parson1 test | real_data test | synthetic test | Wadi Rum (later) |
|---|---|---|---|---|---|---|
| COCO base | | | | | | |
| HERIDAL only | | | | | | |
| SARD only | | | | | | |
| real_data only | | | | | | |
| Stage 1 (HERIDAL+SARD+doron) | | | | | | |
| Stage 1+2 | | | | | | |
| Stage 1+2+3 | | | | | | |
| Mixed (NB07) | | | | | | |
| Ensemble (NB10) | | | | | | |

Each cell: mAP@0.5 (and mAP@0.5:0.95 in a sub-table). This single matrix is what the panel will remember.

**Cross-domain story to highlight in the report:** the diagonal cells (train on X, test on X) should be high — that's basic competence. The **off-diagonal** cells are the story: a model trained only on HERIDAL forest data tested on UAE desert (real_data) tells you how much domain adaptation Shaheen's data actually buys, and vice versa. This is the experiment Shaheen never ran because they only had UAE data — your strongest scientific differentiation.

### Notebook 13 — Error analysis

For the production model on real_data test:
- Confusion patterns (false positives most commonly mistaken for what?)
- Top-50 worst predictions visualized with predicted vs ground-truth boxes.
- Failure mode taxonomy: (a) tiny target missed, (b) shadow misclassified, (c) vehicle misclassified, (d) clothing camouflage, (e) glare-blinded region.
- Recommendations to feed back into preprocessing / training data collection.

### Notebook 14 — Altitude robustness curve

The novelty. Both real and synthetic data are altitude-tagged. Plot:
- x-axis: altitude (20, 30, 40, 50, 60, 70, 80, 90 m)
- y-axis: mAP@0.5
- one line per model variant

This curve will be in the report. Almost certainly the curve will degrade above ~60 m as targets shrink below model receptive field. Use this as motivation for SAHI.

### Notebook 15 — Degradation robustness

Same plot but x-axis is degradation level (low / moderate / severe), and the lines are trained-with / trained-without synthetic data. Quantifies how much robustness the synthetic data buys you.

**Phase 1 definition of done:** All 15 notebooks committed, all results in W&B, the cross-dataset matrix is populated, the production model is in MLflow registry tagged `production-candidate`.

---

## Phase 2 — Production Training Pipeline

**Goal:** Turn the winning notebook combinations into a clean, reproducible, parameterized training pipeline that anyone can run with a single command.

**Duration:** 1 week.

**Deliverables:**
- `src/goldeneye/training/progressive.py` and `mixed.py` — fully parameterized via Hydra.
- `make train-production` runs the full winning pipeline end-to-end.
- Final model artifacts published to MLflow as version 1.0 and to Hugging Face Hub as a public release.
- A `MODEL_CARD.md` describing the model, intended use, limitations, training data, eval results, and ethics.

**Tasks:**
- `P2.1` Refactor the best notebook into `src/goldeneye/training/progressive.py`. (Hamza)
- `P2.2` Same for mixed training. (Hamza)
- `P2.3` Add Hydra configs for every stage. (Hamza)
- `P2.4` Add Weights & Biases logging callbacks. (Hamza)
- `P2.5` Add automatic MLflow model promotion (`Staging` → `Production` after eval gate). (Omar)
- `P2.6` Write `MODEL_CARD.md`. (Omar)
- `P2.7` Push the production weights to Hugging Face Hub under the team's org. (Suhaib)

**Definition of done:** `make train-production CONFIG=configs/train/progressive.yaml` produces the same numbers as Notebook 06 within ±0.5 mAP. CI runs a tiny smoke test (1 epoch, 50 images) on every PR.

---

## Phase 3 — Backend Inference Service

**Goal:** A production-grade FastAPI service that takes images, videos, or live frames and returns detections. Handles concurrency. Supports both ONNX and Hailo backends.

**Duration:** 1.5 weeks.

**Architecture:**

```
                       ┌──────────────────────────┐
                       │   Next.js Frontend        │
                       └────────────┬─────────────┘
                                    │ REST + WebSocket
                                    ▼
                       ┌──────────────────────────┐
                       │   FastAPI (Uvicorn)       │
                       │  ┌─────────────────────┐  │
   image / video  ──▶  │  │ /api/detect/image    │  │
                       │  │ /api/detect/video    │ ─┼──▶ Celery worker
                       │  │ /api/detect/stream   │  │     (Redis broker)
                       │  │ /ws/live             │  │
                       │  └─────────────────────┘  │
                       └────────────┬─────────────┘
                                    │
                                    ▼
                       ┌──────────────────────────┐
                       │ Inference engine          │
                       │  - ONNX Runtime (server)  │
                       │  - Hailo runtime (Pi)     │
                       │  - SAHI predictor         │
                       │  - WBF ensemble (optional)│
                       └──────────────────────────┘
```

**Endpoints:**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/detect/image` | Single image upload → JSON of detections + annotated image. |
| POST | `/api/detect/video` | Video upload → returns `job_id`; client polls or subscribes to SSE. |
| GET | `/api/jobs/{job_id}` | Job status + result. |
| GET | `/api/jobs/{job_id}/result.mp4` | Download annotated video. |
| GET | `/api/jobs/{job_id}/result.csv` | Detection CSV. |
| WS | `/ws/live` | Bidirectional WebSocket; client sends frames, server returns detections. |
| GET | `/api/models` | List available models with metadata. |
| POST | `/api/models/select` | Switch the active model. |
| GET | `/api/health` | Liveness + readiness probes. |
| GET | `/api/metrics` | Prometheus metrics. |

**Features:**
- Async-first; uses `asyncio` + `aiofiles` for non-blocking IO.
- Concurrent video processing via Celery workers.
- Pydantic v2 request/response schemas; OpenAPI auto-generated.
- Rate limiting per IP (with `slowapi`).
- CORS configured for the Next.js origin.
- Structured JSON logging (`structlog`).
- Prometheus instrumentation (latency p50/p95/p99, error rate, queue depth).

**Tasks:**
- `P3.1` Bootstrap FastAPI app with routes scaffolded. (Suhaib)
- `P3.2` Implement `/api/detect/image` with ONNX backend + SAHI. (Suhaib)
- `P3.3` Implement video Celery pipeline + job lifecycle. (Suhaib)
- `P3.4` Implement WebSocket live endpoint with backpressure. (Omar)
- `P3.5` Add model registry endpoint and runtime model switching. (Omar)
- `P3.6` Prometheus + Grafana dashboard. (Hamza)
- `P3.7` Write integration tests (pytest + httpx async). (Suhaib)

**Definition of done:** `docker compose up` launches the API; Postman collection in `docs/api/postman.json` passes; load test (Locust, 50 concurrent users) holds <500 ms p95 latency on image endpoint.

---

## Phase 4 — Modern Frontend (Image / Video / Live)

**Goal:** A polished, animated, modern web app that does the three modes you asked for, plus more. Must look like a 2026 product, not a 2018 demo.

**Duration:** 2 weeks.

**Design language:**
- **Aesthetic:** glassmorphism + subtle gradients on a deep neutral background. Inspired by Linear, Vercel, Stripe.
- **Color palette:** deep desert sand (`#1a1410`), pale sand (`#e8dcc4`), GoldenEye amber (`#d4a64a`), alert red (`#e25555`), success green (`#5ad48a`).
- **Typography:** Inter for UI, JetBrains Mono for technical text, Tajawal for Arabic.
- **Motion:** Framer Motion page transitions (200–300 ms ease-out), staggered list reveals, springy hover states (no bouncy excess).
- **Imagery:** custom illustrations of a falcon-shaped drone for the hero; subtle desert dune SVG patterns as section dividers.

**Pages:**

1. **Landing (`/`)** — hero with animated 3D drone (Three.js) flying over a low-poly desert; pitch in one sentence; CTA to "Try a Detection." Below the fold: live counter of "humans detected this month" (fake until real), tech-stack ribbon, team section.
2. **Detect Image (`/detect/image`)** — drag-and-drop area; image preview; detection overlay with animated bounding boxes (fade in + slight scale); confidence chip per detection; download annotated image; toggle: full-frame vs SAHI inference.
3. **Detect Video (`/detect/video`)** — upload zone; processing job card with progress ring; live SSE updates ("processing frame 1247/3600"); when done, in-browser annotated video player with detection timeline scrubber.
4. **Live (`/live`)** — three sub-modes: webcam, screen-share, "load simulator." Screen-share uses `navigator.mediaDevices.getDisplayMedia`. Frames pushed via WebSocket. Right-side panel: detection count, FPS, confidence histogram, GPS-like coordinates (from simulator). Toggle to record session as MP4.
5. **Mission Map (`/map`)** — Mapbox map of UAE + Jordan; draw a polygon to define a search area; simulated mission planning; saved detections from `/live` and `/detect/video` shown as pins.
6. **Analytics (`/analytics`)** — public dashboard of model performance: altitude robustness curve, degradation curve, cross-dataset matrix, training curves from W&B (embedded iframe). Recharts.
7. **About (`/about`)** — team, supervisor, university, Shaheen collaboration credit, methodology summary, link to MkDocs docs.
8. **Docs (`/docs/*`)** — MkDocs Material site served from same domain via a `next.config.js` rewrite. So `/docs` is the full project documentation.

**Cross-cutting:**
- Dark/light mode toggle (default dark; the app looks more premium dark).
- English / Arabic language toggle. Arabic uses Tajawal; layout flips to RTL via `dir="rtl"` on `<html>`.
- Keyboard shortcuts: `1/2/3` to switch modes, `?` for help, `g` then any letter for navigation.
- WCAG 2.1 AA accessibility: proper alt text, ARIA labels, focus rings, prefers-reduced-motion respected.
- 404 page with a tasteful animated falcon flying past.

**Special touches that elevate it from "student project" to "looks like a startup":**
- Custom cursor on the live mode (`mix-blend-mode: difference` over the video).
- Detection boxes pulse subtly when first appearing (`framer-motion` keyframes).
- "Loading" states use animated skeleton placeholders that match the final layout (no spinners).
- Buttons have a tiny haptic-style "press" animation (scale 0.97 on click).
- The landing-page hero drone fires a "scan" beam at random intervals — purely cosmetic but memorable.
- Detection events trigger a soft audio cue (toggle-able). Mute by default.
- Confetti animation when the demo finds someone in a video. Disabled with `prefers-reduced-motion`.

**Tasks:**
- `P4.1` Bootstrap Next.js 14 app, install shadcn/ui, configure Tailwind theme + `motion`. (Omar)
- `P4.2` Build the landing page hero with Three.js drone. (Omar)
- `P4.3` Build `/detect/image` end-to-end against the API. (Hamza)
- `P4.4` Build `/detect/video` with SSE progress. (Hamza)
- `P4.5` Build `/live` with screen-share + WebSocket. (Suhaib)
- `P4.6` Build `/map` with Mapbox. (Omar)
- `P4.7` Build `/analytics` with Recharts. (Hamza)
- `P4.8` i18n setup (next-intl), Arabic translations. (Omar)
- `P4.9` Light/dark toggle + theme system. (Omar)
- `P4.10` Accessibility audit + reduced-motion path. (Suhaib)
- `P4.11` Lighthouse > 95 in all four categories. (Suhaib)

**Definition of done:** Vercel preview deploys on every PR; Lighthouse score ≥ 95 across the board; all three primary modes work end-to-end against staging API.

---

## Phase 5 — Simulation Environment

**Goal:** A drone flying over a photoreal desert scene with placed human models, with the model running inference in real time on the simulated camera feed. Quantitatively measure detection accuracy in simulation.

**Duration:** 2 weeks.

**Stack:** Unreal Engine 5.4 + Cosys-AirSim + Quixel Megascans + Mixamo humans.

**Architecture:**

```
Unreal Engine 5 (desert scene + drone)
    │
    ├── AirSim Python API
    │       │
    │       ├── Flight script (lawn-mower pattern)
    │       │       ↓
    │       │   Capture RGB frame + ground-truth bbox via segmentation
    │       │       ↓
    │       │   Push to local WebSocket (port 8765)
    │       │
    │       └── Push to /ws/live on backend
    │               ↓
    │           YOLOv8 inference (SAHI)
    │               ↓
    │           Compare predicted vs ground-truth → log to MLflow
    │
    └── On-screen overlay (UMG widget): detections rendered back into the UE scene
```

**Scenes to build:**
1. **UAE Empty Quarter** — golden dunes, sparse vegetation. (Mimics Shaheen test environment.)
2. **Wadi Rum** — red sandstone cliffs + red sand floor. (Your unique novelty.)
3. **Mixed terrain** — rocky plateau with shadow areas. (Stress test.)

**Mission scripts (Python via AirSim API):**
- `mission_lawnmower.py` — standard pattern at fixed altitude.
- `mission_spiral.py` — outward spiral from a "last known location."
- `mission_random_walk.py` — for collecting synthetic data.
- `mission_evaluation.py` — flies a fixed deterministic path with seeded human placement; outputs per-frame predicted vs ground-truth for the evaluation report.

**Output artifacts:**
- A pre-recorded 5-minute "demo flight" video (4K) that runs on the landing page and in the report.
- A live mode you can demo at the viva: open UE5, hit play, the frontend shows the detections in real time.
- A simulation eval CSV: for every frame, ground-truth human positions vs detected positions vs miss/hit/false-positive.
- A quantitative simulation accuracy result added to the report.

**Tasks:**
- `P5.1` Install UE5.4 + Cosys-AirSim. (Omar — UE5 install is heavy, alloc one machine to it)
- `P5.2` Build UAE Empty Quarter scene. (Omar)
- `P5.3` Build Wadi Rum scene (Quixel red sandstone). (Omar)
- `P5.4` Drop and animate 15 Mixamo humans at known coordinates per scene. (Suhaib)
- `P5.5` Write the four mission scripts. (Hamza)
- `P5.6` Wire AirSim frames → frontend WebSocket. (Hamza)
- `P5.7` Render a 4K demo flight video. (Omar)
- `P5.8` Run `mission_evaluation.py` and produce the simulation accuracy table. (Hamza)

**Definition of done:** A judge can sit at a laptop, click "Start Simulation" in the frontend, see a drone fly over a desert in UE5, and watch live detections appear on a panel. The recorded demo flight plays in the landing-page hero.

---

## Phase 6 — Edge Deployment (Hailo + Pi 5)

**Goal:** The same model running on the actual target hardware (Raspberry Pi 5 + Hailo-8L AI Kit) at ≥30 FPS on a 1080p camera feed.

**Duration:** 1.5 weeks.

**Tasks:**
- `P6.1` Set up a Pi 5 + Hailo-8L workstation. Install Raspberry Pi OS 64-bit, Hailo SDK, Tappas. (Suhaib)
- `P6.2` Compile production ONNX → `.hef` via Hailo Dataflow Compiler. (Suhaib, with Hamza)
- `P6.3` Validate INT8 accuracy on real_data test set (from Notebook 11). (Hamza)
- `P6.4` Build a GStreamer pipeline: camera → preprocessing → Hailo inference → overlay → display + telemetry. (Suhaib)
- `P6.5` Add a UART link to a flight controller emulator (no real drone yet). Send mock GPS, log "Confirmed Find" events. (Omar)
- `P6.6` Stress test: 60 min continuous run, monitor thermals and FPS. (Hamza)
- `P6.7` Record a tabletop demo video: camera over a printed desert image with toy humans, Hailo runs at 60+ FPS. (Suhaib)

**Definition of done:** A standalone Pi 5 with Hailo running a live detection display, fully offline, sustained for 60 minutes with documented FPS and thermals.

---

## Phase 7 — Testing, Validation, Monitoring

**Goal:** Confidence that nothing regresses. Visible system health.

**Duration:** Ongoing; ~1 week of dedicated effort.

**Testing layers:**
- **Unit tests** (pytest) — data converters, NMS/WBF, SAHI helpers, label parsing.
- **Integration tests** — API endpoints with a test ONNX model; database/Redis interactions.
- **End-to-end tests** (Playwright) — frontend flows: upload image, see boxes, etc.
- **Model regression tests** — every PR runs the model on a fixed 50-image "regression set" and fails CI if mAP drops >1%.
- **Load tests** (Locust) — 50–200 concurrent users hitting `/detect/image`.
- **Smoke tests** in production — synthetic image hits the deployed endpoint every 5 min via UptimeRobot.

**Monitoring:**
- **Prometheus** scrapes FastAPI metrics: request rate, latency percentiles, errors, model inference time, queue depth, model version.
- **Grafana** dashboard with the above plus alerts.
- **Sentry** for frontend + backend error tracking.
- **W&B Sweeps** for any ongoing training experiments — visible from the analytics page.

**Definition of done:** Green CI badge on README, Grafana dashboard URL in docs, regression set never drops >1%.

---

## Phase 8 — Documentation & Knowledge Base

**Goal:** The project is self-documenting. Future students (or you re-reading it next year) understand every decision.

**Duration:** Ongoing; ~5 days of focused writing.

**Documentation surface:**
- **MkDocs Material site** at `docs/`, deployed to GitHub Pages. Sections:
  - **Overview** — pitch, screenshots, links.
  - **Architecture** — diagrams (Mermaid), data flow, request lifecycle.
  - **Data** — every dataset documented (source, license, stats, preprocessing applied).
  - **Training** — how to reproduce the production model end-to-end.
  - **Inference** — API spec, ONNX/Hailo runtime details.
  - **Simulation** — how to launch UE5, run a mission, evaluate.
  - **Deployment** — Docker, CI/CD, Pi 5 deployment.
  - **Decision log** — chronological list of every nontrivial decision and *why*.
  - **Glossary** — mAP, IoU, NMS, WBF, SAHI, HEF, TOPS, MAVLink — all defined.
- **Jupyter Book** rendering of Phase 1 notebooks as a public scientific report, deployed to GitHub Pages under `/research/`.
- **API docs** auto-generated from FastAPI's OpenAPI; embedded at `/docs/api`.
- **Code docs** from docstrings via Sphinx + MyST.
- **MODEL_CARD.md** and **DATASETS_CARD.md** at repo root.
- **Decision Records (ADRs)** under `docs/adr/` — one markdown per major decision.

**Definition of done:** Anyone with the URL can read the project's full story in 30 minutes without opening the codebase.

---

## Phase 9 — Deployment & DevOps

**Goal:** A public URL works.

**Duration:** ~1 week of integration.

**Topology:**

```
                    GitHub
                       │ push to main
                       ▼
                GitHub Actions
                       │ build + test
                       ├──────────────┬────────────────┐
                       ▼              ▼                ▼
                   Vercel         Railway/Fly       HuggingFace
                 (frontend)        (api+redis)        (weights)
                       │              │
                       │  REST + WS   │
                       └──────────────┘
```

- **Frontend:** Vercel; CDN, HTTPS, preview deploys per PR, free.
- **Backend:** Railway (recommended) or Fly.io. Small instance for the API + Redis. Celery worker scaled to 1 for student budget.
- **Model artifacts:** Hugging Face Hub public release (free).
- **Domain:** `goldeneye-sar.com` or a `.tech` student domain (free for students via GitHub Student Pack).
- **TLS:** automatic via Vercel/Railway/Cloudflare.
- **Logs:** Railway native + Sentry.
- **CI/CD:** GitHub Actions:
  - On PR: lint + test + frontend build.
  - On merge to `main`: deploy frontend + API.
  - On tag (`v1.0`): push Docker images, publish release notes, mirror weights to HF Hub.
- **Cost:** $0 if you stay within free tiers; ~$10/mo if you want a dedicated GPU instance.

**Definition of done:** Public URL works, viva can be presented over Wi-Fi if needed.

---

## Phase 10 — Capstone Deliverables & Defense

**Goal:** Excellent grade and a portfolio piece you can show employers for the next 5 years.

**Duration:** Final 2 weeks.

**Deliverables:**

- **Final technical report (DOCX)** — fully populated, every section from your rubric covered. Cross-dataset matrix and altitude curve are the centerpiece figures. Uses the `docx` skill for clean rendering.
- **Updated slide deck (PPTX)** — incorporating every fix from `GoldenEye_Review_and_Shaheen_Integration.md` plus new slides for results.
- **Hardware prototype** — Pi 5 + Hailo-8L in a 3D-printed enclosure; works at viva.
- **Software repository** — public GitHub link; clean README.
- **System validation** — recorded video of: (a) UE5 simulation flight with detections, (b) Pi 5 tabletop demo, (c) frontend in action across all three modes.
- **Model card + data card** — published alongside the model on Hugging Face.
- **5-minute pitch video** — for the rector's office, the program brochure, future capstone classes.

**Defense preparation:**
- One full dry-run with Dr. Al-Ouran.
- One adversarial dry-run where teammates try to break each other's claims.
- Anticipated questions document with rehearsed answers (esp. on the Shaheen relationship, ethical use, data privacy, the gap between 95% mAP and 100%).

---

## Cross-cutting features beyond what you mentioned

You said to be comprehensive and add features. Here is everything I'd add that isn't in your prompt:

### A. Multi-class detection
Add classes beyond `person`: `vehicle`, `tent`, `signal_fire`, `signal_panel` (orange/white panels used by lost hikers), `livestock` (to reduce false positives). Multi-class training is essentially free if you can find the labels; the synthetic data already separates with/without and can be extended.

### B. Multi-object tracking + re-identification
Across frames, give each detection an ID using **ByteTrack** or **BoT-SORT** (built into Ultralytics). A "found" person who walks gets one ID, not 30 separate detections. Big visual improvement on the live mode.

### C. Heatmap visualization
After processing a video, render a heatmap of "where the model was most confident" overlaid on the flight path. Helps operators see scan coverage and gaps.

### D. Confidence calibration
Raw model confidence is poorly calibrated. Apply **temperature scaling** on a validation set so that a "90% confidence" detection really means 90% precision empirically. Earned trust from operators.

### E. Active learning loop
The backend logs every detection with confidence. A nightly job flags low-confidence detections (0.3 < conf < 0.5) for human review through a tiny labeling UI. Reviewed labels feed back into the next training run. Closes the loop.

### F. Geotagged detection map
Detections from `/live` and the simulator carry GPS coordinates. Pin them on a Mapbox map of Wadi Rum / UAE. Cluster nearby detections. Export as KML for rescue teams.

### G. Mission planning UI
On the same map, the user draws a polygon → backend generates an optimal lawn-mower flight path → mission can be played back in simulation. A taste of the operational planning side, without needing a real drone.

### H. Auto-report PDF generation
End of a mission: backend generates a PDF with map snapshot, detection list with thumbnails, flight stats, confidence breakdown. Branded with the team logo. Uses the `pdf` skill.

### I. Voice alerts
Text-to-speech voice ("Person detected, 23 meters bearing east, confidence 87%") on the live mode. Toggle-able. Helps the operator look away from screen.

### J. Mobile companion app
React Native (Expo) app that mirrors the live mode read-only. Operator can be ten meters from the laptop carrying a tablet. Easy to ship in 3 days once the WebSocket infra is there.

### K. Federated learning placeholder
Architectural placeholder: each university running GoldenEye contributes gradient updates without sharing raw images. Use the **Flower** framework. Mention it as future work; even a stub design wins points.

### L. A/B testing for models
Backend supports multiple model versions in parallel. The user can flip between "Model A (production)" and "Model B (candidate)" and compare results side by side on the same image. Earns research-rigor points.

### M. Adversarial robustness check
Run **FGSM** and **PGD** adversarial perturbations on a held-out set and report how robust the model is. Mostly academic, but a panel question-stopper.

### N. Energy profiling
On the Pi 5, profile energy per inference (using a USB power meter or the Pi's onboard power readout). Report joules/detection. Ties back to the "less than $5 per charge" claim in the original report.

### O. Synthetic data augmentation generator
A script that takes any background image + person crops and generates new training samples on demand. Useful for adding red-sand Wadi Rum variants without flying.

### P. Privacy and ethics surface
Faces in real_data are visible. Add an automatic face-blurring step on any image returned by the public API. Document the ethics policy in `docs/ethics.md`. Talk about consent in field data collection. Panels increasingly ask about this.

### Q. Internationalization (Arabic UI)
Mentioned in Phase 4 but worth calling out: an Arabic UI for a regional SAR product is not optional, it's expected. Tajawal font, RTL layout, `next-intl`.

### R. Onboarding tour
First-time visitors get a guided tour via **Driver.js** that walks them through the three modes in 30 seconds. Skipable.

### S. Public API key system
If you want to let outside developers try the API (good for portfolio), add API key generation + rate limits. Postgres + simple admin UI.

### T. Model versioning in the URL
`/detect/image?model=yolov8s-stage4-v1.2` lets users pin a specific model version for reproducibility. Implemented via the `/api/models` registry.

### U. Carbon footprint estimate
Use the **CodeCarbon** library during training to measure CO2 emitted. Report it in `MODEL_CARD.md`. Modern ML expectation.

### V. Reproducibility certificate
A `make verify-reproducibility` target that retrains the model on a fixed seed and confirms within ±0.3 mAP. CI runs it weekly.

### W. Data lineage graph
Mermaid diagram in docs showing how data flows from raw sources through converters → splits → training. Helps anyone reading later.

### X. Stakeholder Slack notifications
A Slack incoming webhook from GitHub Actions: every successful production deploy posts a screenshot + version + accuracy to a `#capstone-deploys` channel. Looks professional.

---

## Risk register

| Risk | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Synthetic data pseudo-labels are too noisy | High | High | Manual review of 200 samples; use Grounding DINO if YOLO teacher is weak | Hamza |
| Hailo INT8 quantization drops accuracy too much | Med | High | Mixed-precision; calibration set tuning; fallback to FP16 on Pi 5 GPU | Suhaib |
| Wadi Rum data never gets collected | Med | Med | Color-transfer Shaheen UAE images to red-sand domain as fallback | Omar |
| UE5 simulation is too heavy for laptops | Med | Med | Lower scene fidelity; provide pre-recorded video as fallback | Omar |
| 4K SAHI inference is too slow on Pi 5 | Med | Med | Run SAHI only on regions of interest; lower tile resolution | Suhaib |
| Frontend over-engineered, ships late | Med | Med | Aggressive cut list: map and analytics pages can be Phase 10 stretch | Omar |
| Model overfits to SARD (largest labeled set) | Med | Med | Per-dataset weighting in NB07; per-dataset eval matrix | Hamza |
| Free-tier hosting throttles demo at viva | Low | High | Pre-record demo video; have local fallback laptop | All |
| Team member unavailable (illness, exams) | Med | Med | Documentation-first; nothing lives only in one head | All |
| Hailo HAT supply delay | Low | Med | Order early; have a CPU-only Pi 5 fallback path | Suhaib |

---

## 12-week timeline

Assumes Fall 2025 start, capstone defense end of Spring 2026. Adjust to your calendar.

| Week | Phase(s) | Headlines |
|---|---|---|
| 1 | P0 | Repo, env, CI/CD, DVC + W&B + MLflow live |
| 2 | P1 (NB01–03) | EDA, label unification, pseudo-labeling |
| 3 | P1 (NB04–05) | Preprocessing sweep, baseline |
| 4 | P1 (NB06–07) | Progressive vs mixed training |
| 5 | P1 (NB08–10) | Model zoo, SAHI, ensemble |
| 6 | P1 (NB11–15) + Wadi Rum field trip | Hailo prep, full eval, robustness curves, collect Wadi Rum |
| 7 | P2 + P3 start | Production training pipeline; FastAPI scaffold |
| 8 | P3 + P4 start | API complete; Next.js scaffold and image mode |
| 9 | P4 + P5 start | Video + live modes; UE5 scenes |
| 10 | P5 + P6 | Simulation eval + Pi 5/Hailo on-device |
| 11 | P7 + P8 + P9 | Tests, docs, public deployment |
| 12 | P10 | Report, deck, video, defense dry-runs |

---

## What to do this week (Week 1)

1. Create the GitHub repo and commit this `MASTER_PLAN.md` at the root.
2. `uv init`, add the dependencies in the next list, commit `uv.lock`.
3. Set up W&B (free academic) and DVC pointed at Hugging Face Hub.
4. Open the Phase 1 notebooks scaffolded in `notebooks/` (templates in `Capstone/notebooks/`).
5. Run Notebook 01 against the actual data. Commit results.
6. Reach out to the Shaheen team for their training script if not already shared — useful as a reproduction baseline.

---

## Initial `pyproject.toml` dependency list

```toml
[project]
name = "goldeneye"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    # core ML
    "torch>=2.4",
    "torchvision",
    "ultralytics>=8.3",
    "transformers",          # for RT-DETR via HF
    "albumentations",
    "opencv-python-headless",
    "sahi",
    "ensemble-boxes",
    "onnx",
    "onnxruntime-gpu; platform_machine=='x86_64'",
    "onnxruntime; platform_machine!='x86_64'",
    # tracking
    "wandb",
    "mlflow",
    "dvc[s3]",
    # config / data
    "hydra-core",
    "omegaconf",
    "pydantic>=2",
    "pandas",
    "numpy<2",
    # api
    "fastapi",
    "uvicorn[standard]",
    "celery[redis]",
    "redis",
    "structlog",
    "slowapi",
    "prometheus-fastapi-instrumentator",
    # tooling
    "rich",
    "typer",
    "tqdm",
    "imagehash",
    "codecarbon",
    # frontend bridge utilities
    "websockets",
    "mss",
    # tests
    "pytest",
    "pytest-asyncio",
    "httpx",
    "playwright",
    "locust",
]

[project.optional-dependencies]
dev = [
    "ruff",
    "black",
    "mypy",
    "pre-commit",
    "nbstripout",
    "ipykernel",
    "jupyter",
    "jupyter-book",
    "mkdocs-material",
]
```

---

## Closing notes

Three things to keep in mind as you execute:

1. **Notebook 01 first, everything else after.** No commitments to architecture until you've stared at your actual data. The dataset reality check in §0 already shifted the plan; running NB01 yourself will shift it further.
2. **Beat Shaheen on what only you can beat them on.** Don't try to beat them on "98% accuracy on UAE desert" — they have a head start, and accuracy without a defined metric isn't comparable anyway. Beat them on (a) cross-environment generalization (UAE → Wadi Rum), (b) altitude robustness curve, (c) degradation robustness curve, (d) actually deployable edge stack with Hailo numbers. These are concrete, measurable, novel.
3. **Velocity comes from boring infra.** The team that wins this capstone is the team that gets W&B + MLflow + CI running in Week 1 and never has to think about it again, so they can spend Weeks 2–11 doing actual research. Resist the urge to skip Phase 0.

Tell me which phase to drill into next — I can generate the Hydra configs, the data converter, the FastAPI scaffold, the Next.js scaffold, the UE5 setup guide, or the Hailo compilation walkthrough.
