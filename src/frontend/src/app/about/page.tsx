import { Navbar } from "@/components/Navbar";

const specs = [
  ["University",     "AlHussein Technical University"],
  ["Supervisor",     "Dr. Rami Al-Ouran"],
  ["Academic year",  "2025 / 2026"],
  ["Model",          "YOLOv8n (nano)"],
  ["Format",         "ONNX opset 20"],
  ["Input",          "640 × 640 px, RGB"],
  ["Output",         "Single class — person"],
  ["Precision",      "0.975"],
  ["Recall",         "0.985"],
  ["mAP@0.5",        "0.979"],
  ["CPU latency",    "~42 ms / frame"],
  ["License",        "Academic use only"],
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
          GoldenEye is a senior capstone project at AlHussein Technical University,
          supervised by Dr. Rami Al-Ouran. The mission is to design, train, and deploy
          a production-grade, edge-capable human-detection system optimised for aerial
          Search &amp; Rescue (SAR) operations in desert environments — principally the
          UAE Empty Quarter and Jordan's Wadi Rum.
        </p>
        <p>
          The system takes a live video feed from a UAV camera, runs an on-device YOLO
          inference pipeline to locate people in the frame, and streams annotated results
          to a web-based command interface in real time. The full stack — from model
          training to cloud API to edge hardware — is designed to work in environments
          with intermittent connectivity, extreme heat, and low contrast between
          subjects and terrain.
        </p>
        <p>
          The primary scientific question GoldenEye answers is: <em>how well does a model
          trained on UAE imagery generalise to Jordan's visually different desert?</em> The
          cross-environment evaluation, altitude robustness study, and degradation analysis
          constitute the novel contributions beyond the Shaheen baseline.
        </p>
      </>
    ),
  },
  {
    id: "datasets",
    label: "02 — Datasets",
    title: "Training data",
    body: (
      <>
        <p>
          Two datasets are used, combined into a single unified corpus for training.
        </p>

        <h3>SARD — Search and Rescue Dataset</h3>
        <p>
          A publicly available academic dataset of aerial imagery collected specifically for
          SAR research. Images were captured at varying altitudes, lighting conditions, and
          terrain types. The dataset provides a wide distribution of human poses, clothing
          colours, and occlusion scenarios, making it well-suited as a general-purpose
          pre-training base.
        </p>

        <h3>Shaheen — AUS Real-World Dataset</h3>
        <p>
          Contributed by the Shaheen team at the American University of Sharjah, this dataset
          contains high-resolution aerial images captured over the UAE Empty Quarter using a
          DJI Mavic 3 at altitudes from 20 m to 95 m. Ground-truth annotations are in YOLO
          format (normalised bounding boxes, single class: <em>person</em>). The images are
          4K (3840 × 2160) with rich detail in dune textures, making person-sand separation
          a genuine challenge. Shaheen's held-out test split is the primary benchmark used
          for all GoldenEye evaluations.
        </p>

        <h3>Data pipeline</h3>
        <p>
          Both datasets are merged and then split 80 / 10 / 10 into train / validation /
          test sets, stratified to ensure altitude distribution is preserved across splits.
          Augmentation applied during training includes random horizontal flip, mosaic
          composition, colour jitter (hue ±0.015, saturation ±0.7, value ±0.4), random
          scale (±50 %), and copy-paste. No augmentations are applied at validation or test
          time.
        </p>
      </>
    ),
  },
  {
    id: "model",
    label: "03 — Model",
    title: "YOLOv8n architecture",
    body: (
      <>
        <p>
          The detection model is YOLOv8n (nano) — the smallest member of Ultralytics'
          YOLOv8 family. It was selected deliberately over larger variants because the
          target deployment is a Raspberry Pi 5 + Hailo-8L AI accelerator, where model
          size and parameter count dominate latency more than FLOP count.
        </p>

        <h3>Architecture summary</h3>
        <p>
          YOLOv8n uses a CSPDarknet backbone with C2f bottleneck modules, a PANet feature
          pyramid neck, and a decoupled detection head that separates classification and
          regression branches. The nano variant has ~3.2 M parameters and ~8.7 GFLOPs at
          640 × 640 input. The decoupled head removes the objectness branch present in
          YOLOv5, simplifying training and improving small-object recall — critical for
          people viewed from 50–95 m altitude.
        </p>

        <h3>Training procedure</h3>
        <p>
          Training starts from official ImageNet-pretrained weights. Phase 1 fine-tunes
          on SARD (100 epochs, cosine LR schedule, initial LR 0.01, final LR 0.001,
          SGD + momentum 0.937). Phase 2 fine-tunes the Phase 1 checkpoint on the
          combined SARD + Shaheen corpus for a further 150 epochs using the same schedule
          with a warm-up of 3 epochs. Both phases use a confidence threshold of 0.001
          and IoU threshold 0.7 for NMS during evaluation.
        </p>

        <h3>Export and quantisation</h3>
        <p>
          The best validation checkpoint (<code>best.pt</code>) is exported to ONNX opset 20
          with dynamic batch dimension. The exported model processes a single 640 × 640
          frame in ~42 ms on a stock laptop CPU (no GPU). For the Hailo-8L edge deployment
          the model is re-exported at opset 12 (maximum Hailo Dataflow Compiler support)
          and compiled to a <code>.hef</code> binary with INT8 post-training quantisation —
          accuracy drop versus FP32 ONNX is measured and documented in the evaluation.
        </p>
      </>
    ),
  },
  {
    id: "inference",
    label: "04 — Inference",
    title: "Inference pipeline",
    body: (
      <>
        <p>
          The inference engine (<code>src/api/inference/onnx_engine.py</code>) wraps
          ONNX Runtime and performs the following steps on every frame:
        </p>

        <ol>
          <li>
            <strong>Letterbox resize</strong> — the input image is resized to fit within
            640 × 640 while preserving aspect ratio; unused area is padded with grey
            (114, 114, 114). This avoids distortion of human proportions.
          </li>
          <li>
            <strong>Normalisation</strong> — pixel values are divided by 255 to map
            [0, 255] → [0, 1]. The tensor is transposed from HWC to NCHW and cast to
            float32.
          </li>
          <li>
            <strong>ONNX session run</strong> — the pre-loaded <code>InferenceSession</code>
            (loaded once at API startup, kept in memory) returns output shape [1, 5, 8400]:
            four box coordinates (cx, cy, w, h) plus one confidence score for each of the
            8400 anchors.
          </li>
          <li>
            <strong>Filtering</strong> — rows with confidence below the threshold
            (default 0.25) are discarded. The threshold is configurable per-request.
          </li>
          <li>
            <strong>NMS</strong> — Non-Maximum Suppression (<code>cv2.dnn.NMSBoxes</code>)
            with IoU threshold 0.45 removes duplicate detections of the same person.
          </li>
          <li>
            <strong>Rescaling</strong> — bounding boxes are mapped back from 640 × 640
            space to the original image dimensions, accounting for the letterbox padding
            offset and scale factor.
          </li>
          <li>
            <strong>Response</strong> — detections are returned as a list of
            <code>{"{ bbox: [x1,y1,x2,y2], confidence, class_name }"}</code> objects plus
            per-request timing metadata (preprocessing, inference, postprocessing in ms).
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "api",
    label: "05 — API",
    title: "Backend service",
    body: (
      <>
        <p>
          The backend is a FastAPI application served by Uvicorn with Gunicorn workers.
          It exposes REST endpoints for single-image and batch-video detection, a WebSocket
          endpoint for real-time streaming, and a Prometheus metrics scrape target.
        </p>

        <h3>Endpoints</h3>
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
                ["POST",  "/api/detect/image",           "Upload an image → JSON detections + annotated base64 image"],
                ["POST",  "/api/detect/video",           "Upload a video → job_id; Celery processes async"],
                ["GET",   "/api/jobs/{job_id}",          "Poll job status + progress percentage"],
                ["GET",   "/api/jobs/{job_id}/result.mp4",  "Download annotated output video"],
                ["GET",   "/api/jobs/{job_id}/result.csv",  "Download per-frame detection CSV"],
                ["WS",    "/ws/live",                    "Stream raw JPEG frames → receive JSON detections"],
                ["GET",   "/api/models",                 "List loaded model files with metadata"],
                ["POST",  "/api/models/select",          "Switch the active inference model"],
                ["GET",   "/api/health",                 "Liveness + readiness check"],
                ["GET",   "/api/metrics",                "Prometheus text-format metrics"],
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

        <h3>Rate limiting &amp; backpressure</h3>
        <p>
          The image endpoint is rate-limited to 60 requests/minute per IP using SlowAPI.
          The WebSocket endpoint queues incoming frames and drops the oldest frame if
          the inference queue depth exceeds 4, preventing memory accumulation during slow
          network conditions. Celery + Redis handles video jobs asynchronously so that
          long-running encodes do not block the API workers.
        </p>
      </>
    ),
  },
  {
    id: "simulation",
    label: "06 — Simulation",
    title: "UAV flight simulation",
    body: (
      <>
        <p>
          Because a physical UAV is not always available for testing, GoldenEye includes
          a Python-based software simulation (<code>simulation/fly_simulation.py</code>)
          that replicates a drone flyover using real Shaheen 4K imagery.
        </p>

        <h3>How it works</h3>
        <p>
          The simulator loads a 4K source image and computes a crop window whose size is
          determined by the simulated altitude. Lower altitudes produce a smaller crop
          (more zoom), higher altitudes produce a larger crop (wider FOV). The mapping is:
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Altitude (m)</th><th>Crop fraction</th><th>Effective zoom</th></tr></thead>
            <tbody>
              {[
                ["20 m", "22 %", "Very close — person fills ~12 % of frame height"],
                ["30 m", "30 %", "Close — person clearly visible"],
                ["50 m", "46 %", "Medium — default operational altitude"],
                ["70 m", "63 %", "High — person is small, ~8 px tall"],
                ["95 m", "82 %", "Maximum — near-full-image view, person ~5 px tall"],
              ].map(([a, f, z]) => (
                <tr key={a}><td>{a}</td><td>{f}</td><td>{z}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The crop window moves along a generated flight path (lawnmower or Archimedean
          spiral), and each position is encoded as a JPEG and streamed over WebSocket to
          the live detection API. Returned detections are overlaid onto the frame with
          amber tactical corner brackets, a confidence score, and a HUD bar showing
          altitude, frame number, FPS, and detection count.
        </p>

        <h3>Altitude robustness evaluation</h3>
        <p>
          A companion script (<code>simulation/evaluate_sim.py</code>) runs the same
          centre-crop logic over the test set at all 8 altitudes, compares predictions
          against YOLO-format ground-truth labels using IoU-based greedy matching
          (threshold 0.5), and produces per-altitude Precision / Recall / F1 curves.
          This generates the altitude robustness figure used in the capstone report.
        </p>
      </>
    ),
  },
  {
    id: "deployment",
    label: "07 — Deployment",
    title: "System architecture",
    body: (
      <>
        <p>
          GoldenEye is deployed as three independent services:
        </p>

        <h3>Frontend — Vercel</h3>
        <p>
          The Next.js 14 App Router application is deployed to Vercel on every push to
          <code>main</code>. All pages are statically pre-rendered where possible; client
          components hydrate in the browser. Vercel's edge network serves the static
          assets globally at low latency.
        </p>

        <h3>Backend API — Railway / Fly.io</h3>
        <p>
          The FastAPI application and Celery worker run inside Docker containers defined
          in <code>docker-compose.yml</code>. The API image is based on
          <code>python:3.11-slim</code> with ONNX Runtime CPU, OpenCV headless, and
          FFmpeg. The ONNX model path is configured via the <code>MODEL_PATH</code>
          environment variable (default <code>models/best.onnx</code>), loaded once at
          startup and kept in memory for the lifetime of the process.
        </p>

        <h3>Redis</h3>
        <p>
          A Redis 7 instance acts as the Celery broker and result backend. Job status,
          progress percentages, and detection CSVs for completed video jobs are stored
          in Redis with a 24-hour TTL.
        </p>

        <h3>Edge — Raspberry Pi 5 + Hailo-8L</h3>
        <p>
          For field deployment, the <code>.hef</code> model binary runs on the Hailo-8L
          AI accelerator attached to a Raspberry Pi 5 via the M.2 HAT+. A GStreamer
          pipeline captures frames from the UAV camera interface, passes them to the
          Hailo runtime, overlays detections, and optionally streams to the web frontend.
          The edge node operates fully offline with no cloud dependency.
        </p>
      </>
    ),
  },
  {
    id: "contributions",
    label: "08 — Contributions",
    title: "Scientific contributions",
    body: (
      <>
        <p>
          GoldenEye extends the Shaheen baseline with three novel experimental dimensions:
        </p>

        <h3>1. Cross-environment generalisation</h3>
        <p>
          Shaheen's dataset covers only UAE golden sand dunes. GoldenEye evaluates the same
          model on imagery from Jordan's Wadi Rum — a visually distinct environment
          characterised by red sandstone, darker shadow areas, and different vegetation.
          This cross-domain experiment quantifies how much accuracy the model loses when
          deployed in a new desert terrain, and whether fine-tuning on even a small Wadi
          Rum sample recovers it.
        </p>

        <h3>2. Altitude robustness curve</h3>
        <p>
          Precision, Recall, and F1 are reported at eight discrete altitudes (20–95 m).
          The resulting curve answers: <em>at what altitude does detection performance
          fall below an operationally acceptable threshold?</em> This directly informs UAV
          mission planning for SAR teams — they can read off the maximum safe search
          altitude for a given recall target.
        </p>

        <h3>3. Sensor degradation robustness</h3>
        <p>
          Real UAV imagery is often affected by motion blur, JPEG compression artefacts,
          haze, and sensor noise. GoldenEye synthetically applies these degradations at
          parameterised severity levels to the test set and evaluates model performance
          under each, producing a degradation tolerance profile.
        </p>

        <h3>Relationship to Shaheen</h3>
        <p>
          Shaheen (AUS) solved the core detection problem for UAE Empty Quarter at low
          altitude with high accuracy. GoldenEye takes that solved baseline and asks the
          harder operational questions: <em>does it still work in a different country, from
          a higher altitude, through a degraded sensor?</em> The Shaheen model and dataset
          are used with explicit permission; their contribution is fully credited.
        </p>
      </>
    ),
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 page-enter max-w-7xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-14">
          <p className="font-data mb-2" style={{ fontSize: "0.7rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            About GoldenEye
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: "var(--sand)", fontOpticalSizing: "auto" }}>
            Edge-first SAR detection
          </h1>
          <p style={{ marginTop: "0.75rem", color: "var(--sand-dim)", fontSize: "1rem", maxWidth: "60ch", lineHeight: 1.7 }}>
            A complete technical reference for the GoldenEye system — model, data,
            inference pipeline, API, simulation, and deployment.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-10">

          {/* Sticky TOC (desktop) */}
          <aside className="hidden lg:block">
            <div className="ge-card" style={{ padding: "1.25rem", position: "sticky", top: "5rem" }}>
              <p className="font-data mb-4" style={{ fontSize: "0.62rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
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
                  <a href="#acknowledgements" className="font-data" style={{ fontSize: "0.72rem", color: "var(--sand-dim)", textDecoration: "none", letterSpacing: "0.03em", display: "block", padding: "0.2rem 0" }}>
                    10 — Acknowledgements
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
                  <p className="font-data mb-2" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
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
                <p className="font-data mb-2" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
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

              {/* Acknowledgements */}
              <section id="acknowledgements" style={{ borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
                <p className="font-data mb-2" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  10 — Acknowledgements
                </p>
                <h2 className="font-display" style={{ fontSize: "1.45rem", fontWeight: 400, color: "var(--sand)", marginBottom: "1.25rem" }}>
                  Credits
                </h2>

                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--amber-dim)",
                    borderLeft: "3px solid var(--amber)",
                    borderRadius: "0 6px 6px 0",
                    padding: "1.25rem 1.5rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <p className="font-data mb-2" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Shaheen Project — American University of Sharjah
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "var(--sand-dim)", lineHeight: 1.75, marginBottom: "0.75rem" }}>
                    The Shaheen dataset, pre-trained model weights (<code>best.pt</code>), and
                    the original fine-tuning methodology are the intellectual property of the
                    Shaheen team at AUS. GoldenEye builds on top of their work with their
                    explicit permission.
                  </p>
                  <p style={{ fontSize: "0.86rem", color: "var(--sand-dim)", lineHeight: 1.7 }}>
                    <strong style={{ color: "var(--sand)" }}>Shaheen team:</strong>{" "}
                    Yousef Irshaid, Malik Hader, Adham Elmosalamy, Ahmad Alsaleh, and
                    Dr. Mohamed Alhajri.
                  </p>
                </div>

                <div className="ge-card" style={{ padding: "1.25rem 1.5rem" }}>
                  <p className="font-data mb-2" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    SARD Dataset
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "var(--sand-dim)", lineHeight: 1.75 }}>
                    The Search and Rescue Dataset is used under its academic licence for
                    non-commercial research. Full citation and dataset card are included in
                    the project's <code>docs/</code> directory.
                  </p>
                </div>
              </section>

            </div>
          </div>
        </div>
      </main>

    </>
  );
}
