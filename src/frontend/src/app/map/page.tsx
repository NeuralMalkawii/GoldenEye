import { Navbar } from "@/components/Navbar";

/* Mapbox requires a public API key which isn't configured yet.
   This page shows a mission-planning placeholder with the correct
   layout so it can be wired up once NEXT_PUBLIC_MAPBOX_TOKEN is set. */

const mockPins = [
  { id: 1, lat: 24.12, lon: 55.32, conf: 0.92, site: "UAE Empty Quarter" },
  { id: 2, lat: 24.11, lon: 55.34, conf: 0.87, site: "UAE Empty Quarter" },
  { id: 3, lat: 29.53, lon: 35.47, conf: 0.78, site: "Wadi Rum, Jordan" },
];

export default function MapPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 page-enter max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="font-data mb-2" style={{ fontSize: "0.7rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Mission map
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: "var(--sand)", fontOpticalSizing: "auto" }}>
            Geotagged detections
          </h1>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Map placeholder */}
          <div
            className="lg:col-span-3 ge-card"
            style={{
              minHeight: 480,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Topographic grid backdrop */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `
                  linear-gradient(var(--border) 1px, transparent 1px),
                  linear-gradient(90deg, var(--border) 1px, transparent 1px)
                `,
                backgroundSize: "40px 40px",
                opacity: 0.5,
              }}
            />
            {/* Contour ellipses — decorative topographic feel */}
            <svg
              aria-hidden
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12 }}
            >
              {[80, 160, 240, 320].map((r) => (
                <ellipse key={r} cx="50%" cy="50%" rx={r} ry={r * 0.55}
                  fill="none" stroke="var(--amber)" strokeWidth="1" />
              ))}
            </svg>

            {/* Mock pins */}
            {mockPins.map((p) => (
              <div
                key={p.id}
                style={{
                  position: "absolute",
                  left: `${30 + p.id * 18}%`,
                  top:  `${35 + p.id * 8}%`,
                  transform: "translate(-50%, -50%)",
                  cursor: "pointer",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--amber)", border: "2px solid var(--void)", boxShadow: "0 0 8px var(--amber-glow)" }} className="amber-pulse" />
              </div>
            ))}

            {/* Overlay: Mapbox pending */}
            <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
              <p className="font-data" style={{ fontSize: "0.75rem", color: "var(--amber)", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                MAPBOX TOKEN REQUIRED
              </p>
              <p style={{ fontSize: "0.85rem", color: "var(--sand-dim)", maxWidth: "36ch" }}>
                Set <code className="font-data" style={{ color: "var(--amber-bright)", background: "var(--surface)", padding: "2px 6px", borderRadius: 3, fontSize: "0.78rem" }}>
                  NEXT_PUBLIC_MAPBOX_TOKEN
                </code> in <code className="font-data" style={{ color: "var(--sand)", background: "var(--surface)", padding: "2px 6px", borderRadius: 3, fontSize: "0.78rem" }}>.env</code> to
                enable the live Mapbox GL map.
              </p>
            </div>
          </div>

          {/* Detection log */}
          <div className="flex flex-col gap-4">
            <div className="ge-card" style={{ padding: "1.25rem" }}>
              <p className="font-data mb-4" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Detection log
              </p>
              {mockPins.map((p) => (
                <div key={p.id} style={{ padding: "0.65rem 0", borderBottom: "1px solid var(--border)" }}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-data" style={{ fontSize: "0.68rem", color: "var(--sand-dim)" }}>
                      #{p.id} person
                    </span>
                    <span className="badge-success">{Math.round(p.conf * 100)}%</span>
                  </div>
                  <div className="font-data" style={{ fontSize: "0.65rem", color: "var(--sand-faint)" }}>
                    {p.lat.toFixed(3)}°N {p.lon.toFixed(3)}°E
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--sand-dim)", marginTop: "0.1rem" }}>
                    {p.site}
                  </div>
                </div>
              ))}
            </div>

            <div className="ge-card" style={{ padding: "1.25rem" }}>
              <p className="font-data mb-3" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Search areas
              </p>
              {["UAE Empty Quarter", "Wadi Rum, Jordan"].map((area) => (
                <div key={area} style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 4, marginBottom: "0.4rem", fontSize: "0.82rem", color: "var(--sand-dim)" }}>
                  {area}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
