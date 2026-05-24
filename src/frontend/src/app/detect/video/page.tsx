"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { api, type JobState } from "@/lib/api";

type State =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "processing"; jobId: string; job: JobState }
  | { phase: "done"; jobId: string; job: JobState }
  | { phase: "error"; message: string };

function ProgressRing({ pct }: { pct: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle
        cx="55" cy="55" r={r}
        fill="none"
        stroke="var(--amber)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transform: "rotate(-90deg)", transformOrigin: "55px 55px", transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text x="55" y="60" textAnchor="middle" className="font-data" style={{ fontFamily: "var(--font-fira-code)", fill: "var(--amber)", fontSize: 16, fontWeight: 500 }}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
}

export default function DetectVideoPage() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPoll(), []);

  const process = useCallback(async (file: File) => {
    setState({ phase: "uploading" });
    try {
      const { job_id } = await api.detectVideo(file);
      const initial: JobState = { job_id, status: "queued", progress: 0, total_frames: 0, processed_frames: 0 };
      setState({ phase: "processing", jobId: job_id, job: initial });

      pollRef.current = setInterval(async () => {
        const job = await api.jobStatus(job_id);
        if (job.status === "done") {
          stopPoll();
          setState({ phase: "done", jobId: job_id, job });
        } else if (job.status === "failed") {
          stopPoll();
          setState({ phase: "error", message: job.error ?? "Processing failed." });
        } else {
          setState((prev) =>
            prev.phase === "processing" ? { ...prev, job } : prev
          );
        }
      }, 1500);
    } catch (e: unknown) {
      setState({ phase: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("video/")) process(file);
  };

  const reset = () => { stopPoll(); setState({ phase: "idle" }); };

  const pct =
    state.phase === "processing" || state.phase === "done"
      ? state.job.progress
      : 0;

  const isDone   = state.phase === "done";
  const isProc   = state.phase === "processing";

  return (
    <>
      <Navbar />
      <main className="flex-1 page-enter max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="font-data mb-2" style={{ fontSize: "0.7rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Detection · Video
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: "var(--sand)", fontOpticalSizing: "auto" }}>
            Frame-by-frame processing
          </h1>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left */}
          <div className="lg:col-span-3">
            {state.phase === "idle" || state.phase === "error" ? (
              <label style={{ cursor: "pointer", display: "block" }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <input type="file" accept="video/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) process(f); }} />
                <div
                  style={{ minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", borderRadius: 8, transition: "border-color 0.15s, background 0.15s" }}
                  className={dragOver ? "dropzone-active" : "dropzone-idle"}
                >
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ color: dragOver ? "var(--amber)" : "var(--sand-faint)" }}>
                    <rect x="4" y="10" width="28" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M32 17l8-5v18l-8-5V17Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ color: dragOver ? "var(--amber)" : "var(--sand-dim)", fontSize: "0.95rem", marginBottom: "0.3rem" }}>
                      Drop a video here, or <span style={{ color: "var(--amber)", textDecoration: "underline" }}>browse</span>
                    </p>
                    <p className="font-data" style={{ fontSize: "0.7rem", color: "var(--sand-faint)", letterSpacing: "0.04em" }}>
                      MP4 · MOV · AVI · up to 500 MB
                    </p>
                  </div>
                  {state.phase === "error" && (
                    <div className="badge-terra" style={{ marginTop: "0.5rem" }}>⚠ {state.message}</div>
                  )}
                </div>
              </label>
            ) : (
              /* Job card */
              <div className="ge-card" style={{ padding: "2.5rem", minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem" }}>
                <ProgressRing pct={pct} />
                <div style={{ textAlign: "center" }}>
                  <p className="font-data" style={{ fontSize: "0.72rem", color: isDone ? "var(--success)" : "var(--amber)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                    {isDone ? "✓ PROCESSING COMPLETE" : isProc ? "PROCESSING…" : "QUEUED"}
                  </p>
                  {(isProc || isDone) && (
                    <p style={{ fontSize: "0.85rem", color: "var(--sand-dim)" }}>
                      {state.job.processed_frames.toLocaleString()} / {state.job.total_frames.toLocaleString()} frames
                    </p>
                  )}
                  {state.phase === "uploading" && (
                    <p style={{ fontSize: "0.85rem", color: "var(--sand-dim)" }}>Uploading…</p>
                  )}
                </div>

                {isDone && (
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <a
                      href={api.resultMp4Url(state.jobId)}
                      download
                      className="ge-btn"
                    >
                      Download MP4
                    </a>
                    <a
                      href={api.resultCsvUrl(state.jobId)}
                      download
                      className="ge-btn-ghost"
                    >
                      Download CSV
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="ge-card" style={{ padding: "1.5rem", flex: 1 }}>
              <p className="font-data mb-6" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Pipeline
              </p>
              {[
                ["Upload",    "Video file received, stored server-side."],
                ["Queue",     "Celery worker picks up the job from Redis."],
                ["Process",   "Every frame: YOLOv8n inference + annotation."],
                ["Export",    "Annotated MP4 + detection CSV ready for download."],
              ].map(([title, desc], i) => (
                <div key={title} className="flex gap-3 mb-4 items-start">
                  <span className="font-data" style={{ fontSize: "0.65rem", color: "var(--amber)", minWidth: 18, marginTop: "0.2rem", letterSpacing: "0.04em" }}>
                    0{i + 1}
                  </span>
                  <div>
                    <p style={{ fontSize: "0.8rem", color: "var(--sand)", fontWeight: 600, marginBottom: "0.15rem" }}>{title}</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--sand-dim)", lineHeight: 1.5 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {(state.phase !== "idle") && (
              <button className="ge-btn-ghost" onClick={reset}>
                ← Upload another video
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
