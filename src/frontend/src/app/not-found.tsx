import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="flex-1 page-enter">
        <section
          style={{
            minHeight: "calc(100dvh - 56px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1.5rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Coordinate grid backdrop */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `
                linear-gradient(var(--border) 1px, transparent 1px),
                linear-gradient(90deg, var(--border) 1px, transparent 1px)
              `,
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse at center, black 0%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 75%)",
              opacity: 0.35,
            }}
          />

          {/* Animated falcon flying across, then reset */}
          <div
            aria-hidden
            className="not-found-falcon"
            style={{
              position: "absolute",
              top: "30%",
              left: "-10%",
              color: "var(--amber-dim)",
              opacity: 0.55,
              pointerEvents: "none",
            }}
          >
            <svg width="48" height="22" viewBox="0 0 48 22" fill="none">
              {/* stylised falcon silhouette: pointed wings spread */}
              <path
                d="M2 11 L18 7 L22 2 L26 7 L46 11 L26 14 L22 20 L18 14 Z"
                fill="currentColor"
              />
              <circle cx="22" cy="10" r="0.9" fill="var(--void)" />
            </svg>
          </div>

          <div style={{ textAlign: "center", position: "relative", zIndex: 1, maxWidth: "32rem" }}>
            <p
              className="font-data mb-3"
              style={{
                fontSize: "0.7rem",
                color: "var(--bronze)",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              Signal lost
            </p>

            <h1
              className="font-display"
              style={{
                fontSize: "clamp(4rem, 12vw, 7rem)",
                fontWeight: 300,
                color: "var(--sand)",
                lineHeight: 1,
                fontOpticalSizing: "auto",
                marginBottom: "1rem",
              }}
            >
              4<em style={{ fontStyle: "italic", color: "var(--amber)", fontWeight: 400 }}>0</em>4
            </h1>

            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--sand-dim)",
                lineHeight: 1.65,
                marginBottom: "2rem",
                maxWidth: "32ch",
                marginInline: "auto",
              }}
            >
              No target acquired at this coordinate. The page may have moved, or this URL was
              never on the flight plan.
            </p>

            <div style={{ display: "inline-flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/" className="ge-btn">
                Return to base
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/detect/image" className="ge-btn-ghost">
                Try a detection
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
