import Link from "next/link";
import { Navbar } from "@/components/Navbar";

type Mode = {
  href: string;
  title: string;
  desc: string;
  glyphPath: React.ReactNode;
};

const modes: Mode[] = [
  {
    href: "/detect/image",
    title: "Image",
    desc: "Upload an aerial image. The model returns bounding boxes and confidence scores for any detected humans.",
    glyphPath: (
      <>
        <rect x="4" y="6" width="20" height="14" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <path d="M4 16 L10 11 L14 14 L18 9 L24 14" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="19" cy="10" r="1.5" fill="currentColor" />
      </>
    ),
  },
  {
    href: "/detect/video",
    title: "Video",
    desc: "Upload a video file. Every frame is processed and returned as an annotated video with a detection CSV.",
    glyphPath: (
      <>
        <rect x="3" y="6" width="18" height="14" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <path d="M21 9 L26 6 L26 20 L21 17 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
        <path d="M9 11 L15 13 L9 16 Z" fill="currentColor" />
      </>
    ),
  },
  {
    href: "/live",
    title: "Live",
    desc: "Share a camera or screen. Frames are streamed over WebSocket; detections appear in real time.",
    glyphPath: (
      <>
        <circle cx="14" cy="13" r="3" fill="currentColor" />
        <circle cx="14" cy="13" r="6" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
        <circle cx="14" cy="13" r="9.5" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.35" />
        <circle cx="14" cy="13" r="12.5" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.18" />
      </>
    ),
  },
];

const testMetrics: { label: string; value: string; sub: string }[] = [
  { label: "Precision",  value: "0.975", sub: "on the test set" },
  { label: "Recall",     value: "0.985", sub: "on the test set" },
  { label: "mAP@0.5",    value: "0.979", sub: "on the test set" },
  { label: "mAP@0.5–95", value: "0.626", sub: "on the test set" },
];

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="flex-1 page-enter">
        {/* ── Hero ── */}
        <section
          className="relative min-h-[88dvh] flex flex-col justify-center"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 50%,
                oklch(0.72 0.135 70 / 0.07) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 80% 20%,
                oklch(0.54 0.150 38 / 0.05) 0%, transparent 50%)
            `,
          }}
        >
          <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — text */}
            <div>
              <div className="badge-amber mb-8" style={{ display: "inline-flex" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", display: "inline-block" }} />
                SAR · Aerial Human Detection
              </div>

              <h1
                className="font-display"
                style={{
                  fontSize: "clamp(3rem, 7vw, 5.5rem)",
                  fontWeight: 300,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  color: "var(--sand)",
                  marginBottom: "1.5rem",
                  fontOpticalSizing: "auto",
                }}
              >
                Find.{" "}
                <em style={{ fontStyle: "italic", color: "var(--amber)", fontWeight: 400 }}>
                  Confirm.
                </em>
                <br />Save.
              </h1>

              <p style={{ fontSize: "1.05rem", color: "var(--sand-dim)", lineHeight: 1.7, maxWidth: "48ch", marginBottom: "2.5rem" }}>
                GoldenEye is an AI-based aerial human-detection system for desert search and
                rescue. A YOLOv8n model, fine-tuned on a private desert dataset, identifies
                humans from drone-view imagery — designed for edge deployment on a Raspberry
                Pi 5 with AI acceleration.
              </p>

              <div className="flex items-center gap-4 flex-wrap">
                <Link href="/detect/image" className="ge-btn">
                  Try a detection
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                <Link href="/about" className="ge-btn-ghost">
                  Learn more
                </Link>
              </div>
            </div>

            {/* Right — hero image with scan animation */}
            <div
              style={{
                position: "relative",
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid var(--border-lit)",
                aspectRatio: "16/9",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero.jpg"
                alt="Aerial SAR — human detected in desert terrain"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />

              {/* Scan line sweeping top → bottom */}
              <div aria-hidden className="hero-scan-inner" />

              {/* Detection box — appears after scan completes */}
              <div
                aria-hidden
                className="hero-det-appear"
                style={{ left: "57.85%", top: "32.59%", width: "3.96%", height: "5.77%" }}
              >
                <div className="hero-corner hero-corner-tl" />
                <div className="hero-corner hero-corner-tr" />
                <div className="hero-corner hero-corner-bl" />
                <div className="hero-corner hero-corner-br" />
                <div className="hero-ping" />
                <div
                  className="hero-det-label-appear"
                  style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 4, whiteSpace: "nowrap" }}
                >
                  <span className="badge-amber">HUMAN</span>
                </div>
              </div>

              {/* HUD bar — appears with detection */}
              <div className="hero-hud-bar hero-det-appear">
                <span className="font-data" style={{ fontSize: "0.62rem", color: "var(--amber-bright)", letterSpacing: "0.08em" }}>
                  TARGET ACQUIRED · YOLOv8n · 2.7 ms
                </span>
                <span className="font-data" style={{ fontSize: "0.6rem", color: "var(--sand-faint)" }}>
                  best.onnx
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Three modes ── */}
        <section className="max-w-7xl mx-auto px-6 py-20" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="mb-12">
            <p className="font-data mb-3" style={{ fontSize: "0.7rem", color: "var(--bronze)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Detection modes
            </p>
            <h2 className="font-display" style={{ fontSize: "clamp(1.8rem, 3vw, 2.8rem)", fontWeight: 300, color: "var(--sand)", lineHeight: 1.15, fontOpticalSizing: "auto" }}>
              Three ways to find a person
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {modes.map(({ href, glyphPath, title, desc }) => (
              <Link
                key={href}
                href={href}
                className="mode-card"
              >
                <div
                  style={{
                    width: 52, height: 36, borderRadius: 4,
                    background: "var(--surface)",
                    border: "1px solid var(--amber-dim)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--amber)", marginBottom: "1.25rem",
                  }}
                >
                  <svg width="28" height="26" viewBox="0 0 28 26">{glyphPath}</svg>
                </div>
                <h3 className="font-display" style={{ fontSize: "1.3rem", fontWeight: 500, color: "var(--sand)", marginBottom: "0.5rem", fontOpticalSizing: "auto" }}>
                  {title}
                </h3>
                <p style={{ fontSize: "0.88rem", color: "var(--sand-dim)", lineHeight: 1.6 }}>
                  {desc}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Test results ── */}
        <section className="max-w-7xl mx-auto px-6 py-16" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="mb-8">
            <p className="font-data mb-2" style={{ fontSize: "0.7rem", color: "var(--bronze)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Final test evaluation
            </p>
            <h2 className="font-display" style={{ fontSize: "clamp(1.4rem, 2.4vw, 2rem)", fontWeight: 400, color: "var(--sand)", letterSpacing: "0.01em", fontOpticalSizing: "auto" }}>
              Performance on the unseen desert test set
            </h2>
            <p style={{ marginTop: "0.6rem", color: "var(--sand-dim)", fontSize: "0.92rem", lineHeight: 1.65, maxWidth: "62ch" }}>
              The final YOLOv8n model was evaluated on 1,411 images (688 human instances,
              763 background images) from the private desert search-and-rescue dataset.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {testMetrics.map(({ label, value, sub }) => (
              <div key={label} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "1.25rem" }}>
                <div className="font-display" style={{ fontSize: "2rem", fontWeight: 700, color: "var(--amber)", lineHeight: 1, fontOpticalSizing: "auto" }}>
                  {value}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--sand)", marginTop: "0.3rem" }}>{label}</div>
                <div className="font-data" style={{ fontSize: "0.62rem", color: "var(--sand-faint)", marginTop: "0.15rem" }}>{sub}</div>
              </div>
            ))}
          </div>

          <p className="font-data" style={{ marginTop: "1rem", fontSize: "0.7rem", color: "var(--sand-faint)", letterSpacing: "0.04em" }}>
            Inference time 2.7 ms/image on Tesla T4 GPU. Embedded benchmarks on Raspberry Pi 5 are separate.
          </p>
        </section>
      </main>
    </>
  );
}
