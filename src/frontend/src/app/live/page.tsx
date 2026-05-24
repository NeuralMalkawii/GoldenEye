"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { api, type Detection } from "@/lib/api";

type Source = "webcam" | "screen" | "demo";
type ConnState = "idle" | "connecting" | "live" | "error";

type FrameResult = {
  frame_id: number;
  detections: Detection[];
  count: number;
  timing: { preprocess_ms: number; inference_ms: number; postprocess_ms: number };
};

// Build SVG box markup — coordinates are in native video resolution.
// The SVG viewBox handles all scaling to display size automatically.
function buildOverlaySVG(dets: Detection[]): string {
  return dets
    .map((d, i) => {
      const [x1, y1, x2, y2] = d.bbox;
      const w = x2 - x1;
      const h = y2 - y1;
      const conf = Math.round(d.confidence * 100);
      const cs = Math.min(12, Math.max(6, Math.round(w * 0.15)));  // corner size scales with box
      return `
        <g>
          <line x1="${x1}"   y1="${y1+cs}" x2="${x1}"   y2="${y1}"   stroke="var(--amber)" stroke-width="2"/>
          <line x1="${x1}"   y1="${y1}"    x2="${x1+cs}" y2="${y1}"   stroke="var(--amber)" stroke-width="2"/>
          <line x1="${x2-cs}" y1="${y1}"   x2="${x2}"   y2="${y1}"    stroke="var(--amber)" stroke-width="2"/>
          <line x1="${x2}"   y1="${y1}"    x2="${x2}"   y2="${y1+cs}" stroke="var(--amber)" stroke-width="2"/>
          <line x1="${x2}"   y1="${y2-cs}" x2="${x2}"   y2="${y2}"    stroke="var(--amber)" stroke-width="2"/>
          <line x1="${x2}"   y1="${y2}"    x2="${x2-cs}" y2="${y2}"   stroke="var(--amber)" stroke-width="2"/>
          <line x1="${x1+cs}" y1="${y2}"  x2="${x1}"   y2="${y2}"     stroke="var(--amber)" stroke-width="2"/>
          <line x1="${x1}"   y1="${y2}"    x2="${x1}"   y2="${y2-cs}" stroke="var(--amber)" stroke-width="2"/>
          <rect x="${x1}" y="${y1-20}" width="56" height="18"
            fill="oklch(0.08 0.008 54 / 0.85)" stroke="var(--amber-dim)" stroke-width="0.5" rx="2"/>
          <text x="${x1+4}" y="${y1-6}" fill="var(--amber)"
            style="font-family:monospace;font-size:11px;font-weight:600;">
            #${i+1} ${conf}%
          </text>
        </g>`;
    })
    .join("");
}

export default function LivePage() {
  const [source, setSource] = useState<Source>("screen");
  const [conn, setConn] = useState<ConnState>("idle");
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const [totalDetections, setTotalDetections] = useState(0);
  const [latestResult, setLatestResult] = useState<FrameResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const demoVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameLoopRef = useRef<number | null>(null);
  const fpsFrames = useRef<number[]>([]);
  const activeRef = useRef(false);  // tracks whether session is alive

  const stopSession = useCallback(() => {
    activeRef.current = false;
    if (frameLoopRef.current) {
      cancelAnimationFrame(frameLoopRef.current);
      frameLoopRef.current = null;
    }
    const ws = wsRef.current;
    if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    demoVideoRef.current?.pause();
    setConn("idle");
    setLatestResult(null);
    setFps(0);
    if (overlayRef.current) overlayRef.current.innerHTML = "";
  }, []);

  useEffect(() => () => stopSession(), [stopSession]);

  const startSession = useCallback(async () => {
    setConn("connecting");
    setError("");
    setTotalDetections(0);
    fpsFrames.current = [];

    // ── Demo mode: just play the pre-recorded video, no WebSocket needed
    if (source === "demo") {
      const dv = demoVideoRef.current;
      if (!dv) return;
      dv.currentTime = 0;
      await dv.play().catch(() => {});
      setConn("live");
      return;
    }

    try {
      const stream =
        source === "screen"
          ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 } })
          : await navigator.mediaDevices.getUserMedia({ video: { frameRate: 15 } });

      streamRef.current = stream;

      // Stop session automatically if the user ends the screen share via browser UI
      stream.getVideoTracks()[0].addEventListener("ended", () => stopSession());

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const ws = new WebSocket(api.wsLiveUrl());
      wsRef.current = ws;
      activeRef.current = true;

      ws.onopen = () => setConn("live");

      ws.onerror = () => {
        setError("WebSocket connection failed. Is the API server running?");
        setConn("error");
        stopSession();
      };

      ws.onclose = () => {
        // Only reset UI if this close wasn't triggered by stopSession already
        if (activeRef.current) stopSession();
      };

      ws.onmessage = (e) => {
        const data: FrameResult = JSON.parse(e.data);
        setLatestResult(data);
        setTotalDetections((n) => n + data.count);

        const now = performance.now();
        fpsFrames.current = [...fpsFrames.current.filter((t) => now - t < 1000), now];
        setFps(fpsFrames.current.length);

        // KEY FIX: Set viewBox to native video resolution so boxes (in native coords)
        // scale automatically to whatever display size the element has.
        const svg = overlayRef.current;
        if (svg) {
          const nw = video.videoWidth;
          const nh = video.videoHeight;
          const dw = video.clientWidth;
          const dh = video.clientHeight;
          svg.setAttribute("viewBox", `0 0 ${nw} ${nh}`);
          svg.setAttribute("width", String(dw));
          svg.setAttribute("height", String(dh));
          svg.innerHTML = buildOverlaySVG(data.detections);
        }
      };

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      let sending = false;

      const sendFrame = () => {
        // Stop the loop if session ended
        if (!activeRef.current) return;

        frameLoopRef.current = requestAnimationFrame(sendFrame);

        const currentWs = wsRef.current;
        if (!currentWs || currentWs.readyState !== WebSocket.OPEN || sending) return;

        const nw = video.videoWidth;
        const nh = video.videoHeight;
        if (!nw || !nh) return;

        canvas.width = nw;
        canvas.height = nh;
        ctx.drawImage(video, 0, 0, nw, nh);

        sending = true;
        canvas.toBlob((blob) => {
          if (!blob) { sending = false; return; }
          blob.arrayBuffer().then((buf) => {
            // Re-check state — WS may have closed while the blob was encoding
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) ws.send(buf);
            sending = false;
          });
        }, "image/jpeg", 0.7);
      };

      frameLoopRef.current = requestAnimationFrame(sendFrame);
    } catch (e: unknown) {
      activeRef.current = false;
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission")
          ? "Screen share / camera permission denied."
          : msg.toLowerCase().includes("abort")
          ? "Screen share cancelled."
          : msg,
      );
      setConn("error");
    }
  }, [source, stopSession]);

  const isLive = conn === "live";

  return (
    <>
      <Navbar />
      <main className="flex-1 page-enter max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="font-data mb-2" style={{ fontSize: "0.7rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Detection · Live
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: "var(--sand)", fontOpticalSizing: "auto" }}>
            Real-time stream
          </h1>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* ── Video pane ── */}
          <div className="lg:col-span-3">
            <div
              style={{
                position: "relative",
                background: "var(--surface)",
                border: `1px solid ${isLive ? "var(--amber-dim)" : "var(--border)"}`,
                borderRadius: 8,
                overflow: "hidden",
                minHeight: 360,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxShadow: isLive ? "0 0 0 1px var(--amber-dim), 0 0 24px var(--amber-glow)" : "none",
              }}
            >
              {/* Live stream (screen share / webcam) */}
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ display: isLive && source !== "demo" ? "block" : "none", width: "100%", maxHeight: 520, objectFit: "contain" }}
              />

              {/* Demo playback video */}
              <video
                ref={demoVideoRef}
                playsInline
                loop
                style={{ display: isLive && source === "demo" ? "block" : "none", width: "100%", maxHeight: 520, objectFit: "contain" }}
                src="/demo_flight.mp4"
              />

              {/* SVG overlay — viewBox = native resolution, width/height = display size */}
              <svg
                ref={overlayRef}
                style={{ display: source === "demo" ? "none" : undefined, position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
                preserveAspectRatio="none"
              />

              {/* Hidden canvas for frame capture */}
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {!isLive && (
                <div style={{ textAlign: "center", padding: "2rem", position: "relative", zIndex: 1 }}>
                  {conn === "idle" && (
                    <>
                      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>◉</div>
                      <p style={{ color: "var(--sand-dim)", fontSize: "0.9rem" }}>
                        Select a source and press <strong style={{ color: "var(--sand)" }}>Start</strong>
                      </p>
                    </>
                  )}
                  {conn === "connecting" && (
                    <p className="font-data" style={{ color: "var(--amber)", letterSpacing: "0.06em", fontSize: "0.8rem" }}>
                      CONNECTING…
                    </p>
                  )}
                  {conn === "error" && (
                    <div>
                      <p style={{ color: "var(--terra)", fontSize: "0.88rem", marginBottom: "0.75rem" }}>⚠ {error || "Connection failed."}</p>
                      <button type="button" className="ge-btn-ghost" onClick={() => setConn("idle")}>Try again</button>
                    </div>
                  )}
                </div>
              )}

              {isLive && (
                <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "oklch(0.08 0.008 54 / 0.85)", border: "1px solid var(--terra)", borderRadius: 99, padding: "3px 10px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--terra)", display: "inline-block" }} className="amber-pulse" />
                  <span className="font-data" style={{ fontSize: "0.65rem", color: "var(--terra)", letterSpacing: "0.08em" }}>LIVE</span>
                </div>
              )}
            </div>

            {isLive && source === "screen" && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--sand-faint)" }}>
                Tip: For best results, open SAR images full-screen or zoom in — tiny figures at high altitude may be below detection threshold.
              </p>
            )}
            {isLive && source === "demo" && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--sand-faint)" }}>
                Simulation: lawnmower scan at 50 m altitude over Shaheen 4K imagery. Run <code style={{ fontSize: "0.7rem", color: "var(--amber)" }}>python simulation/fly_simulation.py</code> to regenerate.
              </p>
            )}
          </div>

          {/* ── Control panel ── */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Source selector */}
            <div className="ge-card" style={{ padding: "1.25rem" }}>
              <p className="font-data mb-3" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Source
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {([
                  { id: "screen", label: "Screen share" },
                  { id: "webcam", label: "Webcam" },
                  { id: "demo",   label: "Sim demo" },
                ] as { id: Source; label: string }[]).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSource(id)}
                    disabled={isLive}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      borderRadius: 4,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      cursor: isLive ? "default" : "pointer",
                      transition: "all 0.12s",
                      background: source === id ? "var(--amber-glow)" : "var(--surface)",
                      border: `1px solid ${source === id ? "var(--amber-dim)" : "var(--border)"}`,
                      color: source === id ? "var(--amber)" : "var(--sand-dim)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {source === "demo" && (
                <p style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--sand-faint)", lineHeight: 1.5 }}>
                  Plays a pre-recorded UAV simulation over real Shaheen 4K imagery. No API connection needed.
                </p>
              )}
            </div>

            {/* Live stats */}
            <div className="ge-card" style={{ padding: "1.25rem" }}>
              <p className="font-data mb-4" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Stats
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {[
                  { label: "FPS",        value: isLive ? fps : "—" },
                  { label: "Detections", value: isLive ? totalDetections : "—" },
                  { label: "Last count", value: isLive ? (latestResult?.count ?? 0) : "—" },
                  { label: "Infer ms",   value: isLive && latestResult ? latestResult.timing.inference_ms.toFixed(0) : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "0.75rem" }}>
                    <div className="font-data" style={{ fontSize: "1.2rem", color: "var(--amber)", fontWeight: 500 }}>{value}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--sand-dim)", marginTop: "0.15rem" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detection list — latest frame */}
            {isLive && latestResult && latestResult.count > 0 && (
              <div className="ge-card" style={{ padding: "1.25rem" }}>
                <p className="font-data mb-3" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Latest detections
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {latestResult.detections.map((d, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.6rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
                      <span className="font-data" style={{ fontSize: "0.68rem", color: "var(--sand-dim)" }}>#{i + 1} person</span>
                      <span className="badge-success">{Math.round(d.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action */}
            {isLive ? (
              <button type="button" className="ge-btn" style={{ background: "var(--terra)", width: "100%" }} onClick={stopSession}>
                Stop session
              </button>
            ) : (
              <button type="button" className="ge-btn" style={{ width: "100%" }} onClick={startSession} disabled={conn === "connecting"}>
                {conn === "connecting" ? "Connecting…" : "Start live detection"}
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
