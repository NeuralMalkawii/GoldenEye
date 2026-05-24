import Link from "next/link";
import { Navbar } from "@/components/Navbar";

const modes = [
  {
    href:  "/detect/image",
    glyph: "◈",
    title: "Image",
    desc:  "Upload a single frame. See detected persons with confidence scores and annotated bounding boxes.",
    tag:   "< 100ms",
  },
  {
    href:  "/detect/video",
    glyph: "▶",
    title: "Video",
    desc:  "Upload any video file. Every frame is processed and returned as an annotated video with a detection CSV.",
    tag:   "Async · Celery",
  },
  {
    href:  "/live",
    glyph: "◉",
    title: "Live",
    desc:  "Share your screen or webcam. Frames stream over WebSocket; detections appear in real time.",
    tag:   "WebSocket",
  },
];

const datasets = [
  { name: "SARD",              count: "5,755",  domain: "General SAR" },
  { name: "Shaheen Real",      count: "7,056",  domain: "UAE Desert 4K" },
  { name: "Shaheen Synthetic", count: "59,820", domain: "Sim-to-real" },
  { name: "HERIDAL",           count: "1,600",  domain: "Wilderness 12MP" },
  { name: "Doron",             count: "616",    domain: "Aerial DJI" },
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
          {/* Coordinate grid corner decoration */}
          <div
            aria-hidden
            className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(var(--border) 1px, transparent 1px),
                linear-gradient(90deg, var(--border) 1px, transparent 1px)
              `,
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(ellipse at top right, black 0%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse at top right, black 0%, transparent 70%)",
              opacity: 0.6,
            }}
          />

          <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — text */}
            <div>
              <div className="badge-amber mb-8" style={{ display: "inline-flex" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", display: "inline-block" }} />
                SAR · Edge AI · HTU Capstone 2026
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

              <p style={{ fontSize: "1.05rem", color: "var(--sand-dim)", lineHeight: 1.7, maxWidth: "44ch", marginBottom: "2.5rem" }}>
                GoldenEye is a human-detection system for aerial Search &amp; Rescue. A YOLOv8
                model trained on desert-domain imagery runs fully offline — on a Raspberry Pi 5
                with Hailo-8L acceleration, no cloud required.
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
                alt="Aerial SAR — person detected in desert terrain"
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
                  <span className="badge-amber">PERSON</span>
                </div>
              </div>

              {/* HUD bar — appears with detection */}
              <div className="hero-hud-bar hero-det-appear">
                <span className="font-data" style={{ fontSize: "0.62rem", color: "var(--amber-bright)", letterSpacing: "0.08em" }}>
                  TARGET ACQUIRED · YOLOv8n · 45 ms
                </span>
                <span className="font-data" style={{ fontSize: "0.6rem", color: "var(--sand-faint)" }}>
                  best.onnx · CPU
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Three modes ── */}
        <section className="max-w-7xl mx-auto px-6 py-20" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="mb-12">
            <p className="font-data mb-3" style={{ fontSize: "0.7rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Detection modes
            </p>
            <h2 className="font-display" style={{ fontSize: "clamp(1.8rem, 3vw, 2.8rem)", fontWeight: 300, color: "var(--sand)", lineHeight: 1.15, fontOpticalSizing: "auto" }}>
              Three ways to find a person
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {modes.map(({ href, glyph, title, desc, tag }) => (
              <Link
                key={href}
                href={href}
                className="mode-card"
              >
                <div style={{ width: 44, height: 44, borderRadius: 6, background: "var(--amber-glow)", border: "1px solid var(--amber-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "var(--amber)", marginBottom: "1.25rem" }}>
                  {glyph}
                </div>
                <h3 className="font-display" style={{ fontSize: "1.3rem", fontWeight: 500, color: "var(--sand)", marginBottom: "0.5rem", fontOpticalSizing: "auto" }}>
                  {title}
                </h3>
                <p style={{ fontSize: "0.88rem", color: "var(--sand-dim)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
                  {desc}
                </p>
                <span className="badge-amber">{tag}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Dataset table ── */}
        <section className="max-w-7xl mx-auto px-6 py-16" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="font-data mb-8" style={{ fontSize: "0.7rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Training data provenance
          </p>
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Dataset", "Images", "Domain"].map((h) => (
                    <th key={h} className="font-data" style={{ textAlign: "left", padding: "0.6rem 1rem", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sand-dim)", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datasets.map(({ name, count, domain }, i) => (
                  <tr key={name} style={{ background: i % 2 === 0 ? "transparent" : "var(--surface)" }}>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.875rem", color: "var(--sand)", borderBottom: "1px solid var(--border)" }}>{name}</td>
                    <td className="font-data" style={{ padding: "0.7rem 1rem", fontSize: "0.8rem", color: "var(--amber)", borderBottom: "1px solid var(--border)" }}>{count}</td>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.8rem", color: "var(--sand-dim)", borderBottom: "1px solid var(--border)" }}>{domain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: "1px solid var(--border)", padding: "2rem 0" }}>
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="font-data" style={{ fontSize: "0.72rem", color: "var(--sand-faint)", letterSpacing: "0.04em" }}>
              GoldenEye · HTU Capstone 2026 · Omar Malkawi, Hamza Jad Allah, Suhaib Alajami
            </span>
            <span className="font-data" style={{ fontSize: "0.7rem", color: "var(--sand-faint)" }}>
              Supervised by Dr. Rami Al-Ouran
            </span>
          </div>
        </footer>
      </main>
    </>
  );
}
