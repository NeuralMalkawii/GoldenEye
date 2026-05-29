# Model Card — GoldenEye best.onnx

## Model details

| Field | Value |
|---|---|
| **Architecture** | YOLOv8n |
| **Parameters** | 3,005,843 |
| **Layers** | 73 |
| **GFLOPs** | 8.1 |
| **Input** | 640 × 640 RGB, normalized [0, 1], NCHW float32 |
| **Classes** | 1 — `human` |
| **Runtime** | ONNX Runtime |
| **Inference latency** | 2.7 ms/image on Tesla T4 GPU |
| **License** | Academic use only |

## Intended use

Aerial human detection for search-and-rescue (SAR) operations in desert
environments. Designed to assist rescue operators by automatically identifying
possible human targets in aerial imagery. Intended for future edge deployment on a
Raspberry Pi 5 with AI acceleration.

**In scope**
- Aerial drone-view imagery of desert terrain (Middle Eastern desert environments)
- Daylight conditions
- Demonstration via the GoldenEye web interface (image upload, video upload, live stream)

**Out of scope**
- Real-time production SAR without human oversight
- Night-time or thermal imaging (the model was not trained on thermal)
- Non-desert environments without fine-tuning

## Training data

The final model was fine-tuned on a **private desert search-and-rescue dataset**
obtained from the Shaheen project. The dataset is designed for Middle Eastern
desert environments and is organised in YOLO format. It is split into training,
validation, and testing subsets.

## Training configuration

| Parameter | Value |
|---|---|
| Epochs | 100 |
| Image size | 640 |
| Batch size | 16 |
| Optimizer | AdamW |
| Initial learning rate | 0.001 |
| Weight decay | 0.0005 |
| Patience (early stop) | 20 |
| Framework | Ultralytics YOLO |
| Training environment | Kaggle GPU (Tesla T4) |

Data augmentation: colour, scale, translation, horizontal flip, mosaic, mixup.

## Evaluation results

### Validation set (706 images, 343 human instances)

| Metric | Value |
|---|---|
| Precision | 0.988 |
| Recall | 0.990 |
| mAP@0.5 | 0.994 |
| mAP@0.5–95 | 0.650 |
| Inference time | 3.0 ms/image |

### Test set (1,411 images, 688 human instances, 763 background images)

| Metric | Value |
|---|---|
| Precision | 0.975 |
| Recall | 0.985 |
| F1 score | 0.980 |
| **mAP@0.5** | **0.979** |
| mAP@0.5–95 | 0.626 |
| Preprocessing time | 0.6 ms/image |
| Inference time | 2.7 ms/image |
| Postprocessing time | 0.5 ms/image |
| Total processing time | 3.8 ms/image |

Confidence threshold: 0.25 · NMS IoU threshold: 0.45

## Limitations

- **Bounding-box localisation:** mAP@0.5 of 0.979 with mAP@0.5–95 of 0.626 shows that the model detects humans reliably but precise box alignment is harder under stricter IoU thresholds. This is expected for small aerial targets where a few pixels of shift cause a large IoU drop.
- **Dataset dependency:** The model was fine-tuned on a single private desert dataset. Generalisation to other desert regions, altitudes, lighting conditions, and clothing types is not guaranteed.
- **Embedded benchmarks separate:** The reported 2.7 ms inference time is GPU-side (Tesla T4). Raspberry Pi 5 performance must be measured separately and should not be inferred from the GPU number.
- **Single class:** The model outputs only the `human` class. It does not distinguish between adults, children, or animals.

## Ethical considerations

- This system is a detection aid only. All SAR decisions must be made by qualified human operators.
- The model was evaluated on desert imagery only; operators must not rely on it in untested terrain without validation.
- No personally identifiable information is stored. The model detects presence, not identity.

## Acknowledgments

The private desert dataset used for fine-tuning was obtained from the **Shaheen
project**. Their contribution is gratefully acknowledged.

## Citation

```bibtex
@misc{goldeneye2026,
  title  = {GoldenEye: Aerial Human Detection for Desert Search and Rescue},
  author = {Jad Allah, Hamza and Alajami, Suhaib and Malkawi, Omar},
  year   = {2026},
  note   = {HTU Capstone, supervised by Dr. Rami Al-Ouran}
}
```
