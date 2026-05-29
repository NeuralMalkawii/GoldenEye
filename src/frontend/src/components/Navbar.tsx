"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/detect/image", label: "Image" },
  { href: "/detect/video", label: "Video" },
  { href: "/live",         label: "Live" },
  { href: "/about",        label: "About" },
];

export function Navbar() {
  const path = usePathname();

  return (
    <header
      style={{
        background: "linear-gradient(180deg, var(--void) 0%, transparent 100%)",
        borderBottom: "1px solid var(--border)",
      }}
      className="sticky top-0 z-50 backdrop-blur-sm"
    >
      <nav className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Wordmark */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          style={{ textDecoration: "none" }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
            <ellipse cx="11" cy="11" rx="10" ry="7" stroke="var(--amber)" strokeWidth="1.5" />
            <ellipse cx="11" cy="11" rx="4" ry="4" fill="var(--amber)" opacity="0.9" />
            <line x1="1" y1="11" x2="5" y2="11" stroke="var(--amber)" strokeWidth="1.5" />
            <line x1="17" y1="11" x2="21" y2="11" stroke="var(--amber)" strokeWidth="1.5" />
          </svg>
          <span
            className="font-display font-semibold tracking-wide text-base"
            style={{ color: "var(--sand)", letterSpacing: "0.06em" }}
          >
            GOLDEN<span style={{ color: "var(--amber)" }}>EYE</span>
          </span>
        </Link>

        {/* Nav links */}
        <ul className="flex items-center gap-0.5 list-none m-0 p-0">
          {links.map(({ href, label }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  style={{
                    display: "block",
                    padding: "0.3rem 0.7rem",
                    borderRadius: "4px",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    transition: "color 0.12s, background 0.12s",
                    color: active ? "var(--amber)" : "var(--sand-dim)",
                    background: active ? "var(--amber-glow)" : "transparent",
                    border: active ? "1px solid var(--amber-dim)" : "1px solid transparent",
                  }}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
