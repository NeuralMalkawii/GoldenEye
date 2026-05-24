# Report Content — Missing Sections

Copy these sections into **Capstone Project 2 Template.docx** at the locations indicated.
All placeholder values in `[brackets]` need to be updated with real data when available.

---

## §1.4.1 Building on the Shaheen Project

The GoldenEye project builds directly on the Shaheen project from the American University of Sharjah (AUS). The relationship is as follows:

| Aspect | Shaheen (AUS) | GoldenEye (HTU) |
|---|---|---|
| **Primary environment** | UAE Empty Quarter only | UAE Empty Quarter + Jordan Wadi Rum |
| **Model** | YOLOv8n trained on UAE data | Same model, evaluated on new domains |
| **Dataset** | Shaheen Real (7,056) + Synthetic (59,820) | Shaheen data + SARD + HERIDAL + Doron |
| **Cross-domain evaluation** | Not performed | Cross-environment matrix (UAE → Wadi Rum) |
| **Altitude robustness** | Not characterized | Robustness curve from 20 m to 100 m |
| **Degradation study** | Not performed | Blur, noise, compression robustness |
| **Deployment** | Not deployed | Full-stack web + Raspberry Pi 5 + Hailo-8L |
| **Inference system** | Python scripts only | FastAPI + ONNX Runtime + WebSocket |

**Novel scientific contributions** that Shaheen — with only UAE data — could not run:

1. Cross-environment generalization study (UAE desert → Wadi Rum red-sand domain)
2. Altitude robustness curve
3. Degradation robustness evaluation under real-world image quality degradation

**Acknowledgment:** The training data and pre-trained model weights used in this project were contributed by the Shaheen team: Yousef Irshaid, Malik Hader, Adham Elmosalamy, Ahmad Alsaleh, and Dr. Mohamed Alhajri. Their work forms the foundation that GoldenEye builds upon.

---

## §1.5.1 Power Budget

The GoldenEye payload must operate from a UAV battery. The following power budget is estimated for the Pi 5 + Hailo-8L configuration:

| Component | Idle (W) | Peak load (W) |
|---|---|---|
| Raspberry Pi 5 (4 GB) | 2.7 | 8.0 |
| Hailo-8L AI Kit | 0.5 | 2.5 |
| Camera Module 3 Wide | 0.3 | 0.5 |
| Telemetry module (SiK 915 MHz) | 0.3 | 0.6 |
| Voltage regulation overhead | 0.5 | 1.0 |
| **Total** | **4.3** | **12.6** |

At maximum load: **~12.6 W** at 5V USB-C. A 5,000 mAh 5V powerbank delivers approximately **90–100 minutes** of sustained operation. UAV integration will use a dedicated 5V/3A BEC (Battery Elimination Circuit) from the main LiPo.

---

## §1.5.2 Communications and Telemetry

The system uses a layered communication architecture:

| Layer | Technology | Purpose |
|---|---|---|
| Primary uplink | Wi-Fi 802.11ac (2.4/5 GHz) | High-bandwidth video streaming to GCS, <100 m range |
| Telemetry | MAVLink over 915 MHz SiK radio | Flight controller data, detection events, GPS coordinates |
| Fallback | LoRa 868/915 MHz | Store-and-forward GPS beacon, works beyond visual range |
| Optional | 4G/LTE USB dongle | Remote operation when cellular coverage exists |

Detection events (GPS coordinates, confidence, timestamp) are transmitted over MAVLink as custom MAVLink messages to the Ground Control Station (GCS).

---

## §1.5.3 Carrier UAV Platform

For development and testing, the following platform is selected:

**Holybro X500 v2 Quadrotor** with Pixhawk 6C flight controller.

| Parameter | Value |
|---|---|
| Frame | X500 v2 (500 mm wheelbase) |
| Max takeoff weight | 2.0 kg |
| Payload capacity | ~500 g (GoldenEye payload: ~320 g) |
| Flight time (with payload) | ~18–22 minutes |
| Flight controller | Pixhawk 6C (PX4 firmware) |
| BVLOS capable | No (line-of-sight operation only) |

An alternative platform (DJI Matrice 300 RTK with Onboard SDK) is available via university equipment for Phase 6 validation.

---

## §1.8 Dataset

### 1.8.1 Dataset composition

| Dataset | Source | Split | Images | Resolution | Labels | Domain |
|---|---|---|---|---|---|---|
| SARD | Roboflow export | 70/20/10 | 5,755 | 640×640 (pre-tiled) | `human` | General SAR |
| Shaheen Real | AUS / Label Studio | 70/10/20 | 7,056 | 3840×2160 (4K) | `human` | UAE desert |
| Shaheen Synthetic | AUS | No splits* | 59,820 | Mixed | Class folders only | Sim-to-real |
| HERIDAL | Roboflow export | 80/10/10† | 1,600 | 4000×3000 (12 MP) | `person` | Wilderness |
| Doron | Roboflow export | 80/10/10† | 616 | 4000×2250 | `person` | Aerial DJI |
| **Total** | | | **74,847** | | | |

*Shaheen Synthetic: no bounding boxes — only classification by folder (`with_human` / `without_human`). Pseudo-labeling required before use in detection training (Phase 2).
†HERIDAL and Doron: only `train/` split provided; resplit required.

### 1.8.2 Annotation format

All detection datasets use YOLO-format annotation (normalized `x_center y_center width height` per line). Shaheen Real uses Label Studio CSV/JSON export and requires format conversion.

### 1.8.3 Label unification

Different datasets use different class names (`human`, `person`). All are unified to a single class `person` (class index 0) before training.

### 1.8.4 Dataset statistics (Shaheen Real — primary evaluation set)

- Median bounding box size: 68 × 67 pixels (in 3840 × 2160 frame)
- Relative size: ~1.7% of frame area → **small-object detection challenge**
- Altitude range: 20 m – 95 m
- Images with zero humans (hard negatives): 706 out of 7,056 (10%)

---

## §1.9 Evaluation Plan

### 1.9.1 Test sets

Three test conditions are defined:

| Condition | Dataset | # Images | Purpose |
|---|---|---|---|
| A — In-domain | Shaheen real_data test split | 1,411 | Primary accuracy benchmark |
| B — Cross-environment | [Wadi Rum field data — pending] | TBD | Generalization to red-sand domain |
| C — Degraded | Shaheen test images with synthetic degradation | 1,411 × 4 | Robustness under real-world conditions |

### 1.9.2 Metrics

| Metric | Definition | Target |
|---|---|---|
| mAP@0.5 | Mean average precision at IoU=0.50 | ≥ 0.95 |
| Precision | TP / (TP + FP) at confidence ≥ 0.25 | ≥ 0.95 |
| Recall | TP / (TP + FN) at confidence ≥ 0.25 | ≥ 0.95 |
| FPS (CPU) | Frames per second on Intel i7 | ≥ 20 |
| FPS (Hailo-8L) | Frames per second on Pi 5 + Hailo | ≥ 15 (target) |
| False positive rate | FP / total negative images | ≤ 0.05 |

### 1.9.3 Altitude robustness curve

Images from the Shaheen dataset are grouped by altitude tag (20, 30, 40, 50, 60, 70, 80, 95 m). mAP@0.5 is computed per altitude group to characterize detection performance vs. altitude.

### 1.9.4 Degradation robustness study

The Shaheen synthetic dataset encodes image quality variations. The following degradations are evaluated:

| Degradation | Levels tested |
|---|---|
| Gaussian blur | σ = 0, 1, 2, 3 px |
| Gaussian noise | σ = 0, 10, 20, 30 |
| JPEG compression | Q = 95, 75, 50, 25 |
| Combined | Moderate blur + noise |

### 1.9.5 Baseline comparison

| Model | mAP@0.5 (Shaheen test) | Inference (CPU ms) | Size (MB) |
|---|---|---|---|
| YOLOv8n (GoldenEye) | **0.979** | **42** | **11.7** |
| YOLOv8s | [TBD] | ~80 | ~22 |
| Faster R-CNN | ~0.850* | ~200 | ~160 |
| RetinaNet | ~0.840* | ~180 | ~145 |
| YOLOv5n | ~0.940* | ~38 | ~4 |

*Estimates from Shaheen paper; not re-evaluated.

---

## §1.10 Simulation Strategy

### Hardware requirement

Phase 5 requires a workstation with an NVIDIA GPU (≥ 8 GB VRAM) for Unreal Engine 5.4 rendering. This hardware is not currently available. The simulation phase is deferred.

### Planned approach (when hardware is available)

**Stack:** Unreal Engine 5.4 + Cosys-AirSim + Quixel Megascans desert assets + Mixamo human characters.

**Scenes:**
1. UAE Empty Quarter — golden dunes, 10 AM lighting
2. Wadi Rum — red sandstone + red sand (unique to GoldenEye)
3. Mixed terrain — rocky plateau with shadow areas

**Integration:** AirSim Python API captures RGB frames → sent to `/ws/live` WebSocket → YOLOv8n inference → detection overlay displayed in frontend `/live` page.

---

## §1.11 Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Wadi Rum field data collection impossible (access, weather, permits) | Medium | High | Use synthetic Wadi Rum scenes from UE5 as proxy; clearly state limitation |
| R2 | Hailo Dataflow Compiler incompatible with ONNX opset 20 | Medium | Medium | Re-export from `.pt` weights with opset 12; validate INT8 accuracy |
| R3 | Raspberry Pi 5 + Hailo-8L unavailable for Phase 6 | Low | Medium | Demonstrate on CPU; document expected performance from Hailo benchmarks |
| R4 | Redis not available in Railway free tier | Low | Medium | Use Redis Cloud free tier (30 MB) as alternative |
| R5 | mAP regression after fine-tuning on new data | Low | High | Lock current model as production baseline; only replace on validated improvement |
| R6 | UAV pilot availability for field test | Medium | Low | Tabletop demo (camera over printed desert image) as fallback |
| R7 | Jordan CARC regulatory approval for BVLOS | High | Medium | Restrict to visual line-of-sight (VLOS) operation; file Class C notification |

---

## §1.12 Safety and Regulatory Compliance

### Jordan CARC requirements

Jordan's Civil Aviation Regulatory Commission (CARC) classifies UAV operations under JCAA regulations:

- **Open category:** UAVs <250 g — no permit required. Not applicable (payload >250 g).
- **Specific category:** UAVs 250 g – 25 kg, VLOS, within populated/controlled areas. **Applicable.**
  - Requirement: operational authorization from CARC
  - Pilot: certified remote pilot (JCAA Remote Pilot Certificate)
  - Insurance: third-party liability coverage required

### Operational safety procedures

| Procedure | Implementation |
|---|---|
| Geofence | PX4 geofence: radius 200 m, max altitude 100 m |
| Return-to-launch (RTL) | Automatic on signal loss > 3 s |
| Fail-safe | Motor cut at altitude < 2 m if RTL fails |
| Pre-flight check | Battery, motor, GPS lock, link quality checklist |
| Recovery | Bright orange landing pad; audible buzzer on landing |
| Personnel exclusion zone | Minimum 30 m radius during flight |

---

## §1.13 Bill of Materials and Budget

| Item | Supplier | Unit cost (USD) | Qty | Total (USD) |
|---|---|---|---|---|
| Raspberry Pi 5 (4 GB) | Raspberry Pi Ltd | $80 | 1 | $80 |
| Hailo-8L AI Kit for Pi 5 | Hailo | $70 | 1 | $70 |
| Camera Module 3 Wide | Raspberry Pi Ltd | $35 | 1 | $35 |
| SiK 915 MHz telemetry pair | Holybro | $40 | 1 | $40 |
| 3D-printed enclosure | In-house (PLA filament) | $8 | 1 | $8 |
| 5V/3A BEC module | Generic | $5 | 2 | $10 |
| Holybro X500 v2 frame + ESCs | Holybro | $200 | 1 | $200 |
| Pixhawk 6C | Holybro | $120 | 1 | $120 |
| 4S 5000 mAh LiPo | Generic | $45 | 2 | $90 |
| DJI Matrice 300 RTK (university) | Available via HTU | $0 (borrowed) | 1 | $0 |
| **Total** | | | | **$653** |

---

## §Gantt Chart — Project Timeline

| Phase | Task | Owner | Start | End | Duration | Status |
|---|---|---|---|---|---|---|
| Pre-work | Repo scaffold, pyproject.toml, Docker | Omar | 2025-09-01 | 2025-09-07 | 1 week | ✅ Done |
| Phase 3 | FastAPI backend + ONNX engine | Omar | 2025-09-08 | 2025-09-21 | 2 weeks | ✅ Done |
| Phase 4 | Next.js frontend (7 pages) | Omar | 2025-09-22 | 2025-10-05 | 2 weeks | ✅ Done |
| Phase 7 | Testing (pytest + Playwright) | Hamza | 2025-10-06 | 2025-10-12 | 1 week | ✅ Done |
| Phase 9 | Deployment (Vercel + Railway) | Suhaib | 2025-10-13 | 2025-10-19 | 1 week | 🔄 In progress |
| Phase 8 | Docs (MkDocs + Model Card) | Omar | 2025-10-13 | 2025-10-19 | 1 week | 🔄 In progress |
| Phase 10 | Report + slides + poster | All | 2025-10-20 | 2025-11-10 | 3 weeks | 🔄 In progress |
| Phase 5 | UE5 simulation | Hamza | TBD (hardware) | TBD | 2 weeks | ⏳ Deferred |
| Phase 6 | Pi 5 + Hailo-8L edge | Suhaib | TBD (hardware) | TBD | 1.5 weeks | ⏳ Deferred |
| Defense | Viva + showcase | All | [Date TBD] | [Date TBD] | 1 day | ⏳ Pending |

---

## §Acknowledgments

The GoldenEye project is supervised by **Dr. Rami Al-Ouran**, Department of Computer Engineering, Hashemite University of Technology (HTU), Jordan.

The detection model (`best.onnx`) and training datasets (Shaheen Real and Shaheen Synthetic) were contributed by the **Shaheen project** at the American University of Sharjah (AUS):

> Yousef Irshaid, Malik Hader, Adham Elmosalamy, Ahmad Alsaleh, and Dr. Mohamed Alhajri

Their open contribution made the GoldenEye system possible. All Shaheen datasets and weights are used with permission for academic purposes only.

Additional datasets used:
- **SARD** (Search and Rescue Dataset) — public benchmark
- **HERIDAL** — Josip Juraj Strossmayer University of Osijek
- **Doron** — open aerial dataset

---

## Presentation notes — new slides to add

The following slides address gaps identified in the existing GoldenEye deck:

### Slide: Building on Shaheen

Use a side-by-side comparison table (same as §1.4.1 above). Title: "Standing on Shaheen's Shoulders."

### Slide: Dataset composition donut

Donut chart proportions:
- Shaheen Synthetic: 59,820 (80%)
- Shaheen Real: 7,056 (9.4%)
- SARD: 5,755 (7.7%)
- HERIDAL: 1,600 (2.1%)
- Doron: 616 (0.8%)

Caption: "74,847 images across 5 datasets. Shaheen Synthetic dominates — pseudo-label quality is the biggest training variable."

### Slide: Cross-environment experiment matrix

Table showing planned test conditions A, B, C (from §1.9 above) with current result for condition A (mAP=0.979) and "Pending" for B and C.

### Slide: Power budget bar chart

Horizontal stacked bar: Pi 5 (8W) + Hailo (2.5W) + Camera (0.5W) + Telemetry (0.6W) + overhead (1W) = 12.6W peak. Compare to "target UAV LiPo capacity: ~90 min at 12.6W."

### Slide: Risk register top 5

Table of R1–R5 from §1.11 with traffic-light RAG status column.

### Fix existing slides

- **Slide 6:** Add "$5" next to the BEC module reference.
- **Slides 9 & 10:** Fix duplicate page number "9" — renumber slide 10 correctly.
- **Slides 19–23:** Give each system architecture slide a distinct title (e.g., "Hardware Layer", "Software Layer", "Network Layer", "Data Flow", "Deployment").
- **Slide 27:** Add text below the stack images naming each tool.
- **Paragraphs 103–141 in report:** Change heading style from "Heading 2" back to "Normal" body text.
