# Model Card — GoldenEye best.onnx

## Model details

| Field | Value |
|---|---|
| **Architecture** | YOLOv8n (nano) |
| **Export format** | ONNX opset 20 |
| **File size** | 11.7 MB |
| **Input** | 640 × 640 RGB, normalized [0, 1], NCHW float32 |
| **Output** | `[1, 5, 8400]` — cx, cy, w, h, confidence per anchor |
| **Classes** | 1 — `person` |
| **Runtime** | ONNX Runtime 1.18+ (CPU or CUDA) |
| **Inference latency** | ~42 ms on CPU (Intel i7) |
| **License** | Academic use only — see below |

## Intended use

Aerial human detection for Search & Rescue (SAR) operations in desert environments. Designed for offline/edge deployment on Raspberry Pi 5 + Hailo-8L, and for demonstration via web interface.

**In scope:**
- Aerial imagery from UAVs at 20–100 m altitude
- Desert terrain (UAE Empty Quarter, Jordan Wadi Rum)
- Daylight, clear weather conditions

**Out of scope:**
- Real-time production SAR without human oversight
- Night-time or thermal imaging (model was not trained on thermal)
- Non-desert environments without fine-tuning
- Crowd counting or re-identification

## Training data

The model was trained on five datasets totalling ~74,847 images:

| Dataset | Images | Domain | Role |
|---|---|---|---|
| SARD | 5,755 | General SAR, 640×640 | Baseline pre-training |
| Shaheen Real (AUS) | 7,056 | UAE desert 4K, 20–95 m altitude | Primary fine-tuning source |
| Shaheen Synthetic (AUS) | 59,820 | Sim-to-real, degradation × altitude | Augmentation / hard negatives |
| HERIDAL | 1,600 | Wilderness 12 MP (Croatia) | Cross-domain diversity |
| Doron | 616 | Aerial DJI | Additional positive samples |

Training procedure: YOLOv8n pre-trained on SARD, then fine-tuned on Shaheen real_data. Conducted by the Shaheen team at the American University of Sharjah.

## Evaluation results

Evaluated on the Shaheen `real_data` held-out test split (1,411 images, 4K resolution):

| Metric | Value |
|---|---|
| **mAP@0.5** | **0.979** |
| Precision | 0.975 |
| Recall | 0.985 |
| Inference latency (CPU) | ~42 ms/frame |
| Inference latency (Hailo-8L) | TBD (hardware pending) |

Confidence threshold: 0.25 · NMS IoU threshold: 0.45

## Limitations and biases

- **Domain bias:** Trained predominantly on UAE desert imagery. Performance may degrade in non-desert environments (forest, urban, snow) without fine-tuning.
- **Small-object sensitivity:** Bounding boxes at high altitude (>80 m) are very small (~10 px). SAHI tiling is recommended for production high-altitude use.
- **No cross-environment validation yet:** Wadi Rum red-sand domain evaluation is planned (Phase 5 simulation + field collection).
- **Single class:** The model outputs `person` only. It cannot distinguish between adults, children, or animals.
- **No false-positive rate on negatives:** Systematic FPR characterization on the Shaheen `without_human` split is planned for Phase 7.

## Ethical considerations

- This system is a detection aid only. All SAR decisions must be made by qualified human operators.
- The model was evaluated only in desert environments; operators must not rely on it in untested terrain without validation.
- No personally identifiable information is stored. The model detects presence, not identity.

## Acknowledgments

The base model weights and training data were contributed by the **Shaheen project team** at the American University of Sharjah:

> Yousef Irshaid, Malik Hader, Adham Elmosalamy, Ahmad Alsaleh, Dr. Mohamed Alhajri

GoldenEye extends Shaheen's work with cross-environment evaluation, altitude robustness analysis, degradation robustness study, and a full-stack web + edge deployment system.

## Citation

```bibtex
@misc{goldeneye2026,
  title     = {GoldenEye: Edge-Deployable Human Detection for Desert SAR},
  author    = {Malkawi, Omar and Jad Allah, Hamza and Alajami, Suhaib},
  year      = {2026},
  note      = {HTU Capstone 2026, supervised by Dr. Rami Al-Ouran},
  url       = {https://github.com/neuralmalkawii/GoldenEye}
}
```
