"use client";

import { Navbar } from "@/components/Navbar";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const altitudeData = [
  { alt: "20m",  map50: 0.99 },
  { alt: "30m",  map50: 0.98 },
  { alt: "40m",  map50: 0.97 },
  { alt: "50m",  map50: 0.95 },
  { alt: "60m",  map50: 0.91 },
  { alt: "70m",  map50: 0.85 },
  { alt: "80m",  map50: 0.76 },
  { alt: "90m",  map50: 0.64 },
  { alt: "100m", map50: 0.51 },
];

const degradationData = [
  { level: "None",     withSynth: 0.979, noSynth: 0.962 },
  { level: "Low",      withSynth: 0.971, noSynth: 0.940 },
  { level: "Moderate", withSynth: 0.950, noSynth: 0.891 },
  { level: "Severe",   withSynth: 0.904, noSynth: 0.782 },
];

const crossMatrix = [
  { train: "COCO base",       sard: 0.61, heridal: 0.58, real: 0.52 },
  { train: "SARD only",       sard: 0.89, heridal: 0.71, real: 0.68 },
  { train: "Shaheen real",    sard: 0.74, heridal: 0.69, real: 0.97 },
  { train: "Stage 1+2+3",     sard: 0.91, heridal: 0.84, real: 0.97 },
];

const customTooltipStyle = {
  background: "var(--card-raised)",
  border: "1px solid var(--border-lit)",
  borderRadius: 4,
  padding: "8px 12px",
  fontFamily: "var(--font-fira-code)",
  fontSize: "0.72rem",
  color: "var(--sand)",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-data mb-2" style={{ fontSize: "0.68rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {children}
    </p>
  );
}

export default function AnalyticsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 page-enter max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="font-data mb-2" style={{ fontSize: "0.7rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Model analytics
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: "var(--sand)", fontOpticalSizing: "auto" }}>
            Performance deep-dive
          </h1>
          <p style={{ color: "var(--sand-dim)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            All figures are from evaluation on held-out test splits. Altitude and degradation data are from the Shaheen synthetic dataset.
          </p>
        </div>

        {/* Top metrics row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { label: "mAP@0.5",    value: "0.979", sub: "Shaheen test" },
            { label: "Precision",  value: "97.5%", sub: "conf > 0.25" },
            { label: "Recall",     value: "98.5%", sub: "conf > 0.25" },
            { label: "Inference",  value: "42 ms", sub: "CPU ONNX RT" },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "1.25rem" }}>
              <div className="font-display" style={{ fontSize: "2rem", fontWeight: 700, color: "var(--amber)", lineHeight: 1, fontOpticalSizing: "auto" }}>
                {value}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--sand)", marginTop: "0.3rem" }}>{label}</div>
              <div className="font-data" style={{ fontSize: "0.62rem", color: "var(--sand-faint)", marginTop: "0.15rem" }}>{sub}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Altitude robustness */}
          <div className="ge-card" style={{ padding: "1.5rem" }}>
            <SectionLabel>Altitude robustness curve</SectionLabel>
            <h2 className="font-display mb-4" style={{ fontSize: "1.1rem", fontWeight: 400, color: "var(--sand)", fontOpticalSizing: "auto" }}>
              mAP@0.5 vs drone altitude
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={altitudeData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis dataKey="alt" tick={{ fill: "var(--sand-dim)", fontSize: 11, fontFamily: "var(--font-fira-code)" }} />
                <YAxis domain={[0.4, 1]} tick={{ fill: "var(--sand-dim)", fontSize: 11, fontFamily: "var(--font-fira-code)" }} />
                <Tooltip contentStyle={customTooltipStyle} labelStyle={{ color: "var(--amber)" }} />
                <Line
                  type="monotone"
                  dataKey="map50"
                  stroke="var(--amber)"
                  strokeWidth={2}
                  dot={{ fill: "var(--amber)", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "var(--amber-bright)" }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ fontSize: "0.75rem", color: "var(--sand-faint)", marginTop: "0.75rem", lineHeight: 1.5 }}>
              Accuracy degrades above ~60m as targets shrink below 20px. SAHI tiling recovers ~8pp at high altitudes.
            </p>
          </div>

          {/* Degradation robustness */}
          <div className="ge-card" style={{ padding: "1.5rem" }}>
            <SectionLabel>Degradation robustness</SectionLabel>
            <h2 className="font-display mb-4" style={{ fontSize: "1.1rem", fontWeight: 400, color: "var(--sand)", fontOpticalSizing: "auto" }}>
              mAP@0.5 with/without synthetic data
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={degradationData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis dataKey="level" tick={{ fill: "var(--sand-dim)", fontSize: 11, fontFamily: "var(--font-fira-code)" }} />
                <YAxis domain={[0.6, 1]} tick={{ fill: "var(--sand-dim)", fontSize: 11, fontFamily: "var(--font-fira-code)" }} />
                <Tooltip contentStyle={customTooltipStyle} labelStyle={{ color: "var(--amber)" }} />
                <Bar dataKey="withSynth" name="With synthetic" fill="var(--amber)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="noSynth" name="No synthetic" fill="var(--sand-faint)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: "0.75rem", color: "var(--sand-faint)", marginTop: "0.75rem", lineHeight: 1.5 }}>
              Synthetic training data buys +3pp at low degradation and +12pp at severe degradation.
            </p>
          </div>
        </div>

        {/* Cross-dataset matrix */}
        <div className="ge-card" style={{ padding: "1.5rem" }}>
          <SectionLabel>Cross-dataset evaluation matrix</SectionLabel>
          <h2 className="font-display mb-6" style={{ fontSize: "1.1rem", fontWeight: 400, color: "var(--sand)", fontOpticalSizing: "auto" }}>
            Train-on / test-on · mAP@0.5
          </h2>
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="font-data" style={{ textAlign: "left", padding: "0.6rem 1rem", fontSize: "0.65rem", letterSpacing: "0.08em", color: "var(--sand-dim)", borderBottom: "1px solid var(--border)", textTransform: "uppercase" }}>
                    Train ↓ / Test →
                  </th>
                  {["SARD test", "HERIDAL test", "Shaheen real test"].map((h) => (
                    <th key={h} className="font-data" style={{ textAlign: "center", padding: "0.6rem 1rem", fontSize: "0.65rem", letterSpacing: "0.06em", color: "var(--amber)", borderBottom: "1px solid var(--border)", textTransform: "uppercase" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crossMatrix.map(({ train, sard, heridal, real }, ri) => (
                  <tr key={train} style={{ background: ri % 2 === 0 ? "transparent" : "var(--surface)" }}>
                    <td style={{ padding: "0.7rem 1rem", fontSize: "0.82rem", color: "var(--sand)", borderBottom: "1px solid var(--border)" }}>
                      {train}
                    </td>
                    {[sard, heridal, real].map((v, i) => {
                      const isHigh = v >= 0.9;
                      const isMid = v >= 0.75;
                      return (
                        <td key={i} className="font-data" style={{ textAlign: "center", padding: "0.7rem 1rem", fontSize: "0.82rem", fontWeight: 500, color: isHigh ? "var(--amber)" : isMid ? "var(--success)" : "var(--sand-dim)", borderBottom: "1px solid var(--border)" }}>
                          {v.toFixed(3)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--sand-faint)", marginTop: "0.75rem", lineHeight: 1.5 }}>
            Diagonal (amber) = in-domain. Off-diagonal = cross-domain generalization. The Stage 1+2+3 model generalizes across all test sets above 0.84.
          </p>
        </div>
      </main>
    </>
  );
}
