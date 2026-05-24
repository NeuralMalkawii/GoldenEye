# GoldenEye Capstone — Review, Gaps, and How to Leverage Shaheen

**Reviewer note for:** Omar Malkawi, Hamza Jad Allah, Suhaib Alajami
**Supervisor:** Dr. Rami Al-Ouran
**Date:** 2026-05-21

This document reviews the current `report (1).docx` and `GoldenEye (1).pptx` against the AUS Shaheen project, identifies what is strong, what is missing, and lays out a concrete plan for using the dataset Shaheen shared with you. Treat it as a punch list you can work through with the team.

---

## 1. What is already strong

A few things in the current submission are genuinely good and you should not water them down:

- **Clear positioning around "signal-denied, edge-only" operation.** This is a real differentiator. Shaheen's article emphasizes detection accuracy and a new transmission method, but offline autonomy is not their headline claim. Keep this as your north star.
- **Geographic framing across UAE, Saudi Rub al Khali, and Jordan's Wadi Rum.** The Wadi Rum red-sand angle is original and gives Jordan-specific motivation that Shaheen does not cover.
- **Explicit treatment of thermal crossover and domain adaptation.** These are the right problems to name, and most student projects miss them entirely.
- **Modular Intelligent Payload framing.** Platform-agnostic, 500 g, mountable on any UAV — a sensible scope decision for a single-semester capstone.
- **Strong hardware stack on paper.** Pi 5 + Hailo-8L + Camera Module 3 Wide is a credible, current-generation edge AI stack.
- **Slide 10 benchmark table.** The comparison of Faster R-CNN, RetinaNet, YOLOv5, YOLOv8, DCS-YOLOv8, EfficientDet with mAP and inference time is exactly the kind of evidence a panel wants. Keep it and mirror it in the report (see gap list).
- **Reference list is broad and current.** Twenty-plus relevant sources, including Shaheen, MBZIRC, SARD, Caltech RGB-T. Few capstone proposals reach this depth.

---

## 2. Gaps and concrete additions

These are the items I would add or fix before the next review. Ordered by impact.

### 2.1 The Gantt chart and Project Tasks table are empty
Table 0 in the report (Phase 1 and Phase 2 task rows) and Figure 1 (Gantt Chart) contain no data. This is the single most visible gap because the rubric explicitly assesses "develop a detailed project timeline." Fill it in with at minimum: task ID, name, owner, start/end date, duration, dependencies. Even a five-row Phase 1 + five-row Phase 2 is fine for a first pass.

### 2.2 No explicit "Relationship to Shaheen" section
Shaheen is cited in your related work, but the report does not say what is the same, what is different, and what you are extending. A panel reading both will assume re-implementation unless you tell them otherwise. Add a subsection (e.g. 1.4.1 "Building on Shaheen") with a small table:

| Dimension | Shaheen (AUS) | GoldenEye (HTU) |
|---|---|---|
| Geography | UAE deserts | UAE + Wadi Rum (red sand) |
| Dataset | 7,500 real + 90,000 synthetic, UAE | Shaheen base + Jordan-specific Wadi Rum extension |
| Accelerator | Compact custom, <1 W | Hailo-8L AI Kit, 13 TOPS |
| Detection model | (article does not specify) | YOLOv8 |
| Transmission | Custom protocol for desert conditions | Edge-first, offline-tolerant, GPS log + RTB |
| Validation stage | Lab + real desert trials done | Capstone proof-of-concept (simulation + controlled trials) |
| Contribution | First regional desert SAR dataset | Cross-environment generalization, Hailo edge acceleration, Wadi Rum domain |

This converts Shaheen from a competitor into the foundation you are standing on, which is exactly the right framing now that they've shared their data with you.

### 2.3 Dataset plan is underspecified
The report mentions SARD and Caltech RGB-Thermal in passing but never says how many images, what classes, how train/val/test split, what augmentations. Add a Dataset section that names the four sources you actually have:

1. **Shaheen UAE dataset** — 7,500 real images + 90,000 synthetic (whatever subset they shared with you).
2. **HTU Wadi Rum collection** — your own flights, target N images, varied clothing/pose/time-of-day.
3. **SARD / SARD-2** — public wilderness SAR baseline.
4. **Caltech Aerial RGB-Thermal** — for thermal crossover analysis.

Spell out the split, the labeling tool (Roboflow, CVAT, Label Studio), and the inter-annotator agreement check. Panels love that detail.

### 2.4 No formal evaluation plan
You target ">95% mAP" but never define the test set, IoU threshold, confidence threshold, or the comparison baseline. Add a one-page Evaluation Plan covering:

- Primary metric: mAP@0.5 (and mAP@0.5:0.95 if Hailo runtime supports it).
- Secondary metrics: precision, recall, F1, FPS on Pi 5 + Hailo, false-positive rate per minute of flight, GPS accuracy of logged finds vs ground truth.
- Three test conditions: (a) held-out Shaheen UAE, (b) held-out Wadi Rum, (c) cross-environment (train UAE → test Wadi Rum and vice versa) — this last one is your strongest scientific claim.
- Baselines: YOLOv5n, YOLOv8n out-of-the-box (no fine-tune), and a Shaheen reproduction if feasible.

### 2.5 Power budget is missing and the <1 W claim is implicitly carried over from Shaheen
A Raspberry Pi 5 under load draws roughly 5–10 W, and the Hailo-8L adds about 2.5 W. With camera and cooling the realistic envelope is 8–15 W for the payload. State this honestly and contrast it with Shaheen's <1 W figure (their figure is the inference accelerator, not the whole system). Then explain why your power budget is acceptable given the carrier UAV class and expected mission duration.

### 2.6 Communications / telemetry subsystem is vague
The report says "communication may be intermittent" but never specifies the link. Choose and document:
- Primary: MAVLink over 915 MHz/433 MHz SiK telemetry (region-dependent for Jordan — check CARC rules).
- Backup: store-and-forward over LoRa for GPS coordinates only when out of telemetry range.
- Optional: 4G/LTE fallback for areas with cell coverage.

Shaheen explicitly built a new transmission method. You should at least be specific about yours, even if you use off-the-shelf parts.

### 2.7 Flight controller and carrier UAV undefined
The Discussion section says "any UAV capable of carrying 500 g" but you'll need to test against a specific one. Pick a target platform (Holybro X500 v2, Pixhawk 6C; or a DJI with Onboard SDK; or a Tarot 680 frame) and document it. This is not a violation of platform-agnostic — it is the test article.

### 2.8 No risk register
Capstones get marked down for not anticipating failure. Add a risk table covering at least: dataset insufficient for Wadi Rum, Hailo runtime incompatibility with YOLOv8 export, drone-pilot availability, weather/sandstorm test delays, regulatory approval for flight tests in Jordan, supply-chain delay on Hailo HAT. For each: probability, impact, mitigation, owner.

### 2.9 No safety and regulatory analysis
Jordan's Civil Aviation Regulatory Commission (CARC) governs UAS operations. Briefly state which class your payload+drone falls under, where you plan to fly, whether BVLOS is needed, and your safety procedures (geofence, RTL on low battery, fail-safe behavior, recovery plan if AI HAT overheats).

### 2.10 No simulation / SITL plan
Real flight tests are expensive and slow at proposal stage. Plan for PX4 SITL or ArduPilot SITL with Gazebo or AirSim to validate the autonomy stack before strapping it to a real airframe. Even better, use AirSim's photoreal deserts to generate additional synthetic data for free.

### 2.11 Bill of Materials and budget
Capstone panels want to see cost reality. Add a simple BoM with line-item prices and a total. Pi 5 (~$80), Hailo AI Kit (~$70), Camera Module 3 Wide (~$35), 3D-print materials, carrier drone or rental, batteries, telemetry radios.

### 2.12 Web dashboard is mentioned but not designed
The Discussion section names a "web-based dashboard hosted on the Raspberry Pi." Decide: what does it show? Live MJPEG stream? Detection log? GPS coords? Mission control buttons? Even a wireframe would help.

### 2.13 Heading style noise in the docx
A large block of the requirements section (paragraphs 103–141) is styled as Heading 2. They should be body text under proper section headings. Easy fix, but it makes the doc look chaotic now.

### 2.14 Deck cleanup items
- Slides 19–23 are duplicates of "System Architecture Diagrams." Either consolidate or give each a distinct title (e.g. "Component Diagram", "Sequence Diagram", "Deployment Diagram", "State Machine").
- Slide 6: "less than ___ per charge vs 4000/hr" — the per-charge cost is missing a number. Insert "less than $5".
- Slide 27 (Tools/Frameworks) has only images — no readable text content. Add a paragraph naming the stack: Python 3.11, PyTorch/Ultralytics, Hailo Dataflow Compiler, OpenCV, DroneKit, MAVProxy, Roboflow.
- Slide 31 (Scope & Limitations) is good — consider explicitly listing "training on Shaheen-provided UAE data" under In Scope so the panel sees the collaboration.
- Page-number "9" appears on slides 9 and 10 both — fix duplicates.

---

## 3. How to use the Shaheen data they shared with you

This is the part that turns the project from "another desert SAR project" into a credible research contribution. Specific uses, in order of value:

### 3.1 Transfer-learning base
Train YOLOv8 on the Shaheen UAE dataset first (their 7,500 real + 90,000 synthetic), then fine-tune on your Jordan/Wadi Rum captures. This is the standard pretrain → fine-tune recipe and it is exactly what the dataset is for. Expected effect: you reach competitive accuracy with a much smaller HTU collection effort, because the model already knows what humans look like from above in arid terrain.

### 3.2 Cross-environment generalization study (your strongest scientific claim)
Run the experiment matrix:

| Train set | Test set | What it shows |
|---|---|---|
| Shaheen UAE | Shaheen UAE (held-out) | You can reproduce their result |
| Shaheen UAE | HTU Wadi Rum | Generalization gap (probably big, due to red sand) |
| Shaheen UAE + HTU Wadi Rum | HTU Wadi Rum | Improvement from domain adaptation |
| Shaheen UAE + HTU Wadi Rum | Both test sets | True cross-environment robustness |

No published work has done this for desert SAR specifically. This single experiment can carry the contribution narrative of the entire capstone.

### 3.3 Reproduce Shaheen as a baseline
Train (or report) the Shaheen model on Shaheen's own test split as your accuracy floor. Then show GoldenEye matches or exceeds it on the same data. This protects you against the panel asking "why not just use Shaheen?"

### 3.4 Use Shaheen's synthetic data pipeline as a template
They generated 90,000 synthetic images. If they shared the generation method (not just the images), reuse it to produce Wadi Rum red-sand variants — change sand albedo, add Wadi Rum's characteristic sandstone cliffs, vary clothing for Bedouin/tourist mixes. This is fast, cheap, and gives you a Wadi Rum-specific synthetic set without weeks of flying.

### 3.5 Hard-negative mining
The Shaheen dataset, being large, will contain plenty of "things that look like humans but aren't" — rocks, shrubs, shadows, vehicle wreckage. Mine these as hard negatives during fine-tuning to drop your false-positive rate. Your 5-frame confirmation state machine helps, but cleaner detections help more.

### 3.6 Cite and credit clearly
Add a paragraph in Acknowledgments thanking the Shaheen team for sharing data. Add Yousef Irshaid, Malik Hader, Adham Elmosalamy, Ahmad Alsaleh, and Dr. Mohamed Alhajri by name. This is good ethics and good story: it shows your project is part of a regional research conversation, not a closed silo. Also reach out about co-authorship or joint publication if results are strong — it is normal in this domain.

### 3.7 Quantify the data composition in the deck
A donut chart on a new slide showing dataset composition (e.g. 7,500 Shaheen real + 90,000 Shaheen synthetic + N HTU Wadi Rum + M SARD + K Caltech-T) immediately communicates scale and collaboration. Panels respond well to this visual.

---

## 4. Suggested new sections to add to the report

In suggested order of insertion:

1. **1.4.1 Building on Shaheen** — relationship table from §2.2 above.
2. **1.5.1 Power Budget** — realistic Pi 5 + Hailo + camera numbers and justification.
3. **1.5.2 Communications and Telemetry** — MAVLink + LoRa fallback specifics.
4. **1.5.3 Carrier UAV Platform** — chosen test airframe and flight controller.
5. **1.8 Dataset** — four-source breakdown, labeling, splits, augmentations.
6. **1.9 Evaluation Plan** — metrics, conditions, baselines.
7. **1.10 Simulation Strategy** — SITL + Gazebo/AirSim plan.
8. **1.11 Risk Register** — table with mitigation per risk.
9. **1.12 Safety and Regulatory Compliance** — CARC rules, fail-safes.
10. **1.13 Bill of Materials and Budget** — line items + total.
11. **Acknowledgments** — Shaheen team credit.

---

## 5. Suggested new slides to add to the deck

1. **"Building on Shaheen"** — relationship table.
2. **Dataset composition donut** — visual of the four sources.
3. **Cross-environment experiment** — the train/test matrix as a 2x2.
4. **Power budget bar chart** — Pi 5 / Hailo / camera / total vs Shaheen's <1 W claim, with honest framing.
5. **Risk register top 5** — small slide listing top risks and mitigations.
6. **BoM and timeline** — a tight slide with the empty Gantt filled in.

---

## 6. Quick wins for this week

If you only have a few hours before the next review, do these in order:

1. Fill in the Gantt chart and Phase 1 / Phase 2 task table — biggest visible rubric hit.
2. Add the "Building on Shaheen" subsection (one paragraph + the comparison table).
3. Add the Dataset section naming the four sources and counts.
4. Fix the heading style noise in paragraphs 103–141.
5. Consolidate slides 19–23 and fix the page-number duplication.
6. Add the missing "$5" on slide 6.
7. Add a paragraph in Acknowledgments crediting the Shaheen team.

Those seven items will materially improve the impression without requiring new experiments.

---

## 7. One thing to be careful about

Shaheen is published, awarded, and from your region. Two failure modes to avoid:

- **Sounding derivative.** Do not let your report read like a re-implementation. Lead with what only you can do — Wadi Rum's red-sand domain, true edge-only autonomy with Hailo, cross-environment generalization study. Shaheen's contribution was the dataset; yours is the system that uses it across environments.
- **Sounding hostile or competitive.** They shared their data with you. Treat them as collaborators in every public artifact. The framing "we extend the foundational work of AUS's Shaheen team to Jordan's terrain and to true edge-only operation" wins every time.

---

If you want, I can take any of the above and draft the actual text for the report (e.g. the "Building on Shaheen" subsection, the Risk Register table, or the filled-in Gantt as a placeholder) so you can paste it straight into the docx. Tell me which sections to draft.
