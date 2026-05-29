import { Navbar } from "@/components/Navbar";

const specs = [
  ["University",        "AlHussein Technical University"],
  ["Supervisor",        "Dr. Rami Al-Ouran"],
  ["Academic year",     "Spring 2025 / 2026"],
  ["Model",             "YOLOv8n"],
  ["Parameters",        "3,005,843"],
  ["GFLOPs",            "8.1"],
  ["Layers",            "73"],
  ["Input size",        "640 × 640 px"],
  ["Class",             "Single class — human"],
  ["Test precision",    "0.975"],
  ["Test recall",       "0.985"],
  ["Test F1",           "0.980"],
  ["Test mAP@0.5",      "0.979"],
  ["Test mAP@0.5–95",   "0.626"],
  ["Inference time",    "2.7 ms / image (Tesla T4 GPU)"],
];

type Section = {
  id: string;
  label: string;
  title: string;
  body: React.ReactNode;
};

const sections: Section[] = [
  {
    id: "overview",
    label: "01 — Overview",
    title: "What is GoldenEye?",
    body: (
      <>
        <p>
          GoldenEye is an AI-based, aerial drone-view human-detection system aimed at
          assisting search-and-rescue operations in desert environments. It is designed
          for top-down and high-oblique perspectives — the kind of view a UAV camera
          produces — and helps rescue teams visualise vast open desert areas more
          quickly than ground search alone.
        </p>
        <p>
          The system uses a YOLOv8n object-detection model that takes an image or video
          frame and produces a bounding box and confidence score for each detected
          person. It does not replace rescue teams or decision-making; it acts as an
          intelligent support tool that automatically highlights possible human targets
          from aerial imagery.
        </p>
        <p>
          The project was developed as a senior capstone at AlHussein Technical
          University under the supervision of Dr. Rami Al-Ouran. The implementation
          builds on a problem identified in Capstone 1: ground search-and-rescue in
          desert and remote areas is slow, expensive, and difficult due to terrain,
          visibility, area size, and weak communications.
        </p>
      </>
    ),
  },
  {
    id: "dataset",
    label: "02 — Dataset",
    title: "Training data",
    body: (
      <>
        <p>
          The final model was fine-tuned on a <strong>private desert search-and-rescue
          dataset</strong> obtained from the Shaheen project. The dataset is designed
          for Middle Eastern desert environments and contains aerial images with
          desert backgrounds, varied human appearances and clothing colours, and
          different poses and movement conditions.
        </p>
        <p>
          The data is organised in YOLO format — each image has an associated label
          file containing bounding-box annotations for the <em>human</em> class — and
          is split into training, validation, and testing subsets. The validation
          set is used to select the best model weights; the test set is used for the
          final performance evaluation. The presence of background images (no
          humans) is important because it tests whether the model produces false
          detections when no person is present.
        </p>
        <p>
          Data augmentation applied during training includes colour, scale, and
          translation changes, horizontal flipping, mosaic augmentation, and mixup.
          These help the model generalise to different desert lighting conditions,
          human positions, and visual variations.
        </p>
      </>
    ),
  },
  {
    id: "model",
    label: "03 — Model",
    title: "YOLOv8n",
    body: (
      <>
        <p>
          The detection model is YOLOv8n — the smallest YOLOv8 variant. It was chosen
          after baseline experiments compared multiple YOLO sizes on a public
          search-and-rescue dataset. YOLOv8n was selected because it provides a
          strong balance between accuracy, inference speed, model size, and
          suitability for edge deployment. Larger YOLO models can deliver slightly
          better accuracy but are usually too computationally expensive for embedded
          targets.
        </p>

        <h3>Training configuration</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <tbody>
              {[
                ["Epochs",                "100"],
                ["Image size",            "640"],
                ["Batch size",            "16"],
                ["Optimizer",             "AdamW"],
                ["Initial learning rate", "0.001"],
                ["Weight decay",          "0.0005"],
                ["Patience (early stop)", "20"],
                ["Framework",             "Ultralytics YOLO"],
                ["Training environment",  "Kaggle GPU (Tesla T4)"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td><strong>{k}</strong></td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "evaluation",
    label: "04 — Evaluation",
    title: "Validation and test results",
    body: (
      <>
        <p>
          The best model was selected based on validation performance, then evaluated
          on the unseen test set. The difference between validation and test
          performance is small, which indicates that the model generalised well and
          did not show severe overfitting.
        </p>

        <h3>Validation set (706 images, 343 human instances)</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <tbody>
              {[
                ["Precision",   "0.988"],
                ["Recall",      "0.990"],
                ["mAP@0.5",     "0.994"],
                ["mAP@0.5–95",  "0.650"],
                ["Inference",   "3.0 ms / image"],
              ].map(([k, v]) => (
                <tr key={k}><td><strong>{k}</strong></td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Test set (1,411 images, 688 human instances, 763 background images)</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <tbody>
              {[
                ["Precision",         "0.975"],
                ["Recall",            "0.985"],
                ["F1 score",          "0.980"],
                ["mAP@0.5",           "0.979"],
                ["mAP@0.5–95",        "0.626"],
                ["Preprocessing",     "0.6 ms / image"],
                ["Inference",         "2.7 ms / image"],
                ["Postprocessing",    "0.5 ms / image"],
                ["Total",             "3.8 ms / image"],
              ].map(([k, v]) => (
                <tr key={k}><td><strong>{k}</strong></td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>
          The high recall is particularly important for a search-and-rescue
          application — missing a person is more critical than producing an
          occasional false alarm. The lower mAP@0.5–95 reflects the difficulty of
          tight bounding-box localisation on small aerial targets, where a few pixels
          of shift cause a large IoU drop. Note that the 2.7 ms inference time
          represents GPU-side evaluation on a Tesla T4 and is not a Raspberry Pi
          number — embedded benchmarking is reported separately.
        </p>
      </>
    ),
  },
  {
    id: "inference",
    label: "05 — Inference",
    title: "Inference workflow",
    body: (
      <>
        <p>
          The inference application uses the trained YOLOv8n model to process input
          frames and display detection results. Each frame passes through the
          following pipeline:
        </p>
        <ol>
          <li>Receive an image or video frame from the user interface.</li>
          <li>Preprocess: resize and normalise to the 640 × 640 input expected by YOLOv8n.</li>
          <li>Run YOLOv8n inference via ONNX Runtime.</li>
          <li>Apply confidence filtering and non-maximum suppression to remove weak or duplicate boxes.</li>
          <li>Draw the bounding boxes around detected humans.</li>
          <li>Display the confidence score for each detection.</li>
        </ol>
        <p>
          The same pipeline is used by all three input modes — image upload, video
          upload, and the live WebSocket stream (camera or screen share).
        </p>
      </>
    ),
  },
  {
    id: "api",
    label: "06 — API",
    title: "Backend service",
    body: (
      <>
        <p>
          The backend is a FastAPI application that exposes the trained model through
          a small set of endpoints. The ONNX model is loaded once at startup and kept
          in memory.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["POST",  "/api/detect/image",            "Upload an image → JSON detections + annotated image"],
                ["POST",  "/api/detect/video",            "Upload a video → job_id; processed asynchronously"],
                ["GET",   "/api/jobs/{job_id}",           "Poll job status and progress"],
                ["GET",   "/api/jobs/{job_id}/result.mp4", "Download the annotated output video"],
                ["GET",   "/api/jobs/{job_id}/result.csv", "Download the per-frame detection CSV"],
                ["WS",    "/ws/live",                    "Stream camera or screen-share frames → JSON detections"],
                ["GET",   "/api/health",                  "Liveness + readiness check"],
              ].map(([m, p, d]) => (
                <tr key={p}>
                  <td><code>{m}</code></td>
                  <td><code>{p}</code></td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "deployment",
    label: "07 — Deployment",
    title: "Target hardware",
    body: (
      <>
        <p>
          The project goal is to run human detection close to the drone camera
          without depending entirely on cloud processing. YOLOv8n was selected for
          its small footprint (~3 million parameters) which makes it well-suited
          to embedded deployment.
        </p>
        <p>
          The target deployment hardware is a <strong>Raspberry Pi 5 with AI
          acceleration</strong>. The Pi acts as the main controller responsible for
          frame handling and application execution; the AI accelerator is the target
          for optimised inference. The detection output — human label, confidence
          score, and bounding box — supports rescue operators through visual alerts
          and screenshots, with optional GPS logging considered as future work.
        </p>
        <p>
          The quantitative model evaluation reported here was performed on a Kaggle
          Tesla T4 GPU. Embedded performance numbers (FPS, latency, CPU/memory use,
          temperature, stability) on the Raspberry Pi require separate benchmarking
          and should not be inferred from the GPU results.
        </p>
      </>
    ),
  },
  {
    id: "future",
    label: "08 — Future work",
    title: "Limitations and improvements",
    body: (
      <>
        <p>
          The project achieved strong results but several limitations remain. The
          main technical weakness is bounding-box localisation accuracy — the
          mAP@0.5–95 score of 0.626 shows that the model detects humans reliably
          but does not always produce highly precise box alignment under stricter
          IoU thresholds. This is expected in aerial human detection where targets
          are small.
        </p>
        <p>Recommended future improvements:</p>
        <ul>
          <li>Train and evaluate with larger input image sizes (e.g. 960 or 1280) to improve small-object detection.</li>
          <li>Add more real-world data from different Middle Eastern desert regions, altitudes, camera angles, and lighting conditions.</li>
          <li>Run a separate embedded benchmark on Raspberry Pi 5 measuring FPS, latency, CPU/memory usage, and temperature during continuous operation.</li>
          <li>Add GPS coordinate logging so that each detection records a frame, timestamp, confidence, and location.</li>
          <li>Improve interface error handling for invalid input sources, missing camera permissions, and long-duration operation.</li>
          <li>Conduct controlled field testing with real drone footage in operational SAR conditions.</li>
        </ul>
      </>
    ),
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 page-enter">
        <div className="max-w-7xl mx-auto px-6 py-12">

          {/* Header */}
          <div className="mb-10">
            <p className="font-data mb-2" style={{ fontSize: "0.7rem", color: "var(--bronze)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              About GoldenEye
            </p>
            <h1 className="font-display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: "var(--sand)", fontOpticalSizing: "auto" }}>
              Aerial human detection for desert SAR
            </h1>
            <p style={{ marginTop: "0.75rem", color: "var(--sand-dim)", fontSize: "1rem", maxWidth: "60ch", lineHeight: 1.7 }}>
              A technical reference for the GoldenEye system — the problem, the
              dataset, the model, the inference workflow, and the evaluation results.
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-10">

            {/* Sticky TOC (desktop) */}
            <aside className="hidden lg:block">
              <div className="ge-card" style={{ padding: "1.25rem", position: "sticky", top: "5rem" }}>
                <p className="font-data mb-4" style={{ fontSize: "0.62rem", color: "var(--bronze)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Contents
                </p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="font-data"
                        style={{ fontSize: "0.72rem", color: "var(--sand-dim)", textDecoration: "none", letterSpacing: "0.03em", display: "block", padding: "0.2rem 0" }}
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                  <li>
                    <a href="#specs" className="font-data" style={{ fontSize: "0.72rem", color: "var(--sand-dim)", textDecoration: "none", letterSpacing: "0.03em", display: "block", padding: "0.2rem 0" }}>
                      09 — Specs
                    </a>
                  </li>
                  <li>
                    <a href="#team" className="font-data" style={{ fontSize: "0.72rem", color: "var(--sand-dim)", textDecoration: "none", letterSpacing: "0.03em", display: "block", padding: "0.2rem 0" }}>
                      10 — Team
                    </a>
                  </li>
                </ul>
              </div>
            </aside>

            {/* Main content */}
            <div className="lg:col-span-3">
              <div className="about-body" style={{ display: "flex", flexDirection: "column", gap: "3.5rem" }}>

                {sections.map((s) => (
                  <section key={s.id} id={s.id} style={{ borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
                    <p className="font-data mb-2" style={{ fontSize: "0.65rem", color: "var(--bronze)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {s.label}
                    </p>
                    <h2 className="font-display" style={{ fontSize: "1.45rem", fontWeight: 400, color: "var(--sand)", marginBottom: "1.25rem" }}>
                      {s.title}
                    </h2>
                    <div className="prose-about">
                      {s.body}
                    </div>
                  </section>
                ))}

                {/* Specs table */}
                <section id="specs" style={{ borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
                  <p className="font-data mb-2" style={{ fontSize: "0.65rem", color: "var(--bronze)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    09 — Specs
                  </p>
                  <h2 className="font-display" style={{ fontSize: "1.45rem", fontWeight: 400, color: "var(--sand)", marginBottom: "1.25rem" }}>
                    Quick reference
                  </h2>
                  <div className="ge-card" style={{ padding: "0.25rem 0" }}>
                    {specs.map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          padding: "0.6rem 1.25rem",
                          borderBottom: "1px solid var(--border)",
                          fontSize: "0.86rem",
                          gap: "1rem",
                        }}
                      >
                        <span style={{ color: "var(--sand-dim)", flexShrink: 0 }}>{k}</span>
                        <span style={{ color: "var(--sand)", textAlign: "right" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Team */}
                <section id="team" style={{ borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
                  <p className="font-data mb-2" style={{ fontSize: "0.65rem", color: "var(--bronze)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    10 — Team
                  </p>
                  <h2 className="font-display" style={{ fontSize: "1.45rem", fontWeight: 400, color: "var(--sand)", marginBottom: "1.25rem" }}>
                    Authors and supervision
                  </h2>
                  <div className="ge-card" style={{ padding: "1.25rem 1.5rem" }}>
                    <p className="font-data mb-3" style={{ fontSize: "0.62rem", color: "var(--bronze)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      Authors
                    </p>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                      {[
                        { name: "Hamza Jad Allah", href: "https://www.linkedin.com/in/hamza-jadallah/" },
                        { name: "Suhaib Alajami",  href: "https://www.linkedin.com/in/suhaibalajami/" },
                        { name: "Omar Malkawi",    href: "https://www.linkedin.com/in/omar-malkawi/" },
                      ].map(({ name, href }) => (
                        <li key={href}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--sand)", fontSize: "0.9rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--amber)" aria-hidden>
                              <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM0 8h5v16H0V8zm7.5 0H12v2.2h.07c.63-1.2 2.17-2.46 4.47-2.46C21.4 7.74 24 10.06 24 14.6V24h-5v-8.4c0-2-.04-4.58-2.79-4.58-2.79 0-3.21 2.18-3.21 4.43V24h-5V8z" />
                            </svg>
                            {name}
                          </a>
                        </li>
                      ))}
                    </ul>
                    <p className="font-data mb-2" style={{ fontSize: "0.62rem", color: "var(--bronze)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      Supervisor
                    </p>
                    <p style={{ fontSize: "0.9rem", color: "var(--sand-dim)", lineHeight: 1.75, marginBottom: "1.25rem" }}>
                      <a
                        href="https://htu.edu.jo/profile/dr--rami-alouran"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--sand)", textDecoration: "none", borderBottom: "1px solid var(--amber-dim)" }}
                      >
                        Dr. Rami Al-Ouran
                      </a>
                      , AlHussein Technical University.
                    </p>
                    <p style={{ fontSize: "0.86rem", color: "var(--sand-dim)", lineHeight: 1.7 }}>
                      The private desert dataset used for fine-tuning was obtained from the
                      Shaheen project. Their contribution is gratefully acknowledged.
                    </p>
                  </div>
                </section>

              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
