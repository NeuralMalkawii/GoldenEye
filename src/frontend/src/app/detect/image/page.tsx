"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { api, type Detection, type ImageResult } from "@/lib/api";

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "result"; result: ImageResult; objectUrl: string }
  | { phase: "error"; message: string };

function DetectionOverlay({
  detections,
  naturalW,
  naturalH,
  displayW,
  displayH,
}: {
  detections: Detection[];
  naturalW: number;
  naturalH: number;
  displayW: number;
  displayH: number;
}) {
  const scaleX = displayW / naturalW;
  const scaleY = displayH / naturalH;

  return (
    <svg
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      width={displayW}
      height={displayH}
    >
      {detections.map((d, i) => {
        const x1 = d.bbox[0] * scaleX;
        const y1 = d.bbox[1] * scaleY;
        const w  = (d.bbox[2] - d.bbox[0]) * scaleX;
        const h  = (d.bbox[3] - d.bbox[1]) * scaleY;
        const conf = Math.round(d.confidence * 100);

        return (
          <g key={i} style={{ animationDelay: `${i * 60}ms` }} className="bbox-line">
            {/* Corner marks instead of full rect — more tactical feel */}
            <line x1={x1} y1={y1 + 10} x2={x1} y2={y1} stroke="var(--amber)" strokeWidth="2" />
            <line x1={x1} y1={y1} x2={x1 + 10} y2={y1} stroke="var(--amber)" strokeWidth="2" />
            <line x1={x1 + w - 10} y1={y1} x2={x1 + w} y2={y1} stroke="var(--amber)" strokeWidth="2" />
            <line x1={x1 + w} y1={y1} x2={x1 + w} y2={y1 + 10} stroke="var(--amber)" strokeWidth="2" />
            <line x1={x1 + w} y1={y1 + h - 10} x2={x1 + w} y2={y1 + h} stroke="var(--amber)" strokeWidth="2" />
            <line x1={x1 + w} y1={y1 + h} x2={x1 + w - 10} y2={y1 + h} stroke="var(--amber)" strokeWidth="2" />
            <line x1={x1 + 10} y1={y1 + h} x2={x1} y2={y1 + h} stroke="var(--amber)" strokeWidth="2" />
            <line x1={x1} y1={y1 + h} x2={x1} y2={y1 + h - 10} stroke="var(--amber)" strokeWidth="2" />

            {/* Confidence label */}
            <rect
              x={x1}
              y={y1 - 18}
              width={conf > 9 ? 54 : 46}
              height={17}
              fill="var(--void)"
              stroke="var(--amber-dim)"
              strokeWidth="0.5"
            />
            <text
              x={x1 + 4}
              y={y1 - 5}
              fill="var(--amber)"
              style={{ fontFamily: "var(--font-fira-code)", fontSize: 10, fontWeight: 500 }}
            >
              person {conf}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function DetectImagePage() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0, nw: 0, nh: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const currentObjectUrl = useRef<string | null>(null);

  // Always free the previous blob URL — leaks otherwise grow per upload
  const setStateWithUrlCleanup = useCallback((next: State) => {
    setState((prev) => {
      const prevUrl = prev.phase === "result" ? prev.objectUrl : null;
      const nextUrl = next.phase === "result" ? next.objectUrl : null;
      if (prevUrl && prevUrl !== nextUrl) URL.revokeObjectURL(prevUrl);
      currentObjectUrl.current = nextUrl;
      return next;
    });
  }, []);

  // Free any outstanding blob URL on unmount
  useEffect(() => () => {
    if (currentObjectUrl.current) URL.revokeObjectURL(currentObjectUrl.current);
  }, []);

  const process = useCallback(async (file: File) => {
    setStateWithUrlCleanup({ phase: "loading" });
    try {
      const result = await api.detectImage(file);
      const objectUrl = URL.createObjectURL(file);
      setStateWithUrlCleanup({ phase: "result", result, objectUrl });
    } catch (e: unknown) {
      setStateWithUrlCleanup({ phase: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [setStateWithUrlCleanup]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) process(file);
    },
    [process],
  );

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
  };

  const onImgLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    setImgSize({ w: el.clientWidth, h: el.clientHeight, nw: el.naturalWidth, nh: el.naturalHeight });
  };

  const reset = () => setStateWithUrlCleanup({ phase: "idle" });

  const downloadAnnotated = () => {
    if (state.phase !== "result") return;
    const a = document.createElement("a");
    a.href = `data:image/jpeg;base64,${state.result.annotated_image_b64}`;
    a.download = "goldeneye_detected.jpg";
    a.click();
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 page-enter max-w-7xl mx-auto px-6 py-12">
        {/* Page header */}
        <div className="mb-10">
          <p className="font-data mb-2" style={{ fontSize: "0.7rem", color: "var(--bronze)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Detection · Image
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: "var(--sand)", fontOpticalSizing: "auto" }}>
            Single-frame analysis
          </h1>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* ── Left col: upload + result ── */}
          <div className="lg:col-span-3">
            {state.phase === "idle" || state.phase === "error" ? (
              <label
                style={{ cursor: "pointer", display: "block" }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <input type="file" accept="image/*" className="sr-only" onChange={onFileInput} />
                <div
                  style={{
                    minHeight: 340,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    borderRadius: 8,
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  className={dragOver ? "dropzone-active" : "dropzone-idle"}
                >
                  {/* Upload glyph */}
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: dragOver ? "var(--amber)" : "var(--sand-faint)" }}>
                    <rect x="6" y="24" width="28" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M20 6v16M14 12l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ color: dragOver ? "var(--amber)" : "var(--sand-dim)", fontSize: "0.95rem", marginBottom: "0.3rem" }}>
                      Drop an image here, or <span style={{ color: "var(--amber)", textDecoration: "underline" }}>browse</span>
                    </p>
                    <p className="font-data" style={{ fontSize: "0.7rem", color: "var(--sand-faint)", letterSpacing: "0.04em" }}>
                      JPG · PNG · WEBP · up to 500 MB
                    </p>
                  </div>
                  {state.phase === "error" && (
                    <div className="badge-terra" style={{ marginTop: "0.5rem" }}>
                      ⚠ {state.message}
                    </div>
                  )}
                </div>
              </label>
            ) : state.phase === "loading" ? (
              <div
                style={{ minHeight: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}
                className="ge-card scanline"
              >
                <div className="skeleton" style={{ width: 200, height: 12, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 140, height: 10, borderRadius: 4 }} />
                <p className="font-data" style={{ fontSize: "0.72rem", color: "var(--bronze)", letterSpacing: "0.06em", marginTop: "0.5rem" }}>
                  RUNNING INFERENCE…
                </p>
              </div>
            ) : (
              <div style={{ position: "relative", display: "inline-block", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-lit)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={state.objectUrl}
                  alt="Uploaded image"
                  style={{ display: "block", maxWidth: "100%", maxHeight: 520 }}
                  onLoad={onImgLoad}
                />
                {imgSize.w > 0 && (
                  <DetectionOverlay
                    detections={state.result.detections}
                    naturalW={imgSize.nw}
                    naturalH={imgSize.nh}
                    displayW={imgSize.w}
                    displayH={imgSize.h}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Right col: results panel ── */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {state.phase === "result" ? (
              <>
                {/* Summary card */}
                <div className="ge-card" style={{ padding: "1.25rem" }}>
                  <p className="font-data mb-4" style={{ fontSize: "0.65rem", color: "var(--bronze)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Detection summary
                  </p>
                  <div className="flex items-end gap-3 mb-4">
                    <span className="font-display" style={{ fontSize: "3.5rem", fontWeight: 700, color: state.result.count > 0 ? "var(--amber)" : "var(--sand-dim)", lineHeight: 1, fontOpticalSizing: "auto" }}>
                      {state.result.count}
                    </span>
                    <span style={{ fontSize: "0.9rem", color: "var(--sand-dim)", paddingBottom: "0.4rem" }}>
                      {state.result.count === 1 ? "person" : "persons"} detected
                    </span>
                  </div>

                  {/* Timing */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                    {[
                      { k: "Pre", v: state.result.timing.preprocess_ms },
                      { k: "Infer", v: state.result.timing.inference_ms },
                      { k: "Post", v: state.result.timing.postprocess_ms },
                    ].map(({ k, v }) => (
                      <div key={k} style={{ textAlign: "center" }}>
                        <div className="font-data" style={{ fontSize: "1rem", color: "var(--sand)", fontWeight: 500 }}>
                          {v.toFixed(0)}
                        </div>
                        <div className="font-data" style={{ fontSize: "0.62rem", color: "var(--sand-dim)", letterSpacing: "0.05em" }}>
                          {k} ms
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-detection list */}
                <div className="ge-card" style={{ padding: "1.25rem", flex: 1 }}>
                  <p className="font-data mb-3" style={{ fontSize: "0.65rem", color: "var(--bronze)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Detections
                  </p>
                  {state.result.detections.length === 0 ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--sand-dim)" }}>No persons detected.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {state.result.detections.map((d, i) => (
                        <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.6rem 0.75rem" }}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-data" style={{ fontSize: "0.7rem", color: "var(--sand-dim)" }}>
                              #{i + 1} person
                            </span>
                            <span className="badge-success">{Math.round(d.confidence * 100)}%</span>
                          </div>
                          <div className="font-data" style={{ fontSize: "0.65rem", color: "var(--sand-faint)" }}>
                            [{d.bbox.map((v) => v.toFixed(0)).join(", ")}]
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button className="ge-btn" style={{ flex: 1 }} onClick={downloadAnnotated}>
                    Download
                  </button>
                  <button className="ge-btn-ghost" style={{ flex: 1 }} onClick={reset}>
                    New image
                  </button>
                </div>
              </>
            ) : (
              <div className="ge-card" style={{ padding: "1.5rem", flex: 1 }}>
                <p className="font-data mb-6" style={{ fontSize: "0.65rem", color: "var(--bronze)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  How it works
                </p>
                {[
                  ["01", "Upload an aerial desert image."],
                  ["02", "The image is preprocessed and passed to YOLOv8n."],
                  ["03", "Confidence filtering and non-maximum suppression remove weak or duplicate detections."],
                  ["04", "Bounding boxes and confidence scores are overlaid; download the annotated image."],
                ].map(([n, t]) => (
                  <div key={n} className="flex gap-3 mb-4">
                    <span className="font-data" style={{ fontSize: "0.7rem", color: "var(--amber)", minWidth: 20, marginTop: "0.1rem" }}>{n}</span>
                    <span style={{ fontSize: "0.85rem", color: "var(--sand-dim)", lineHeight: 1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
