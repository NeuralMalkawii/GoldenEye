import type { Metadata } from "next";
import { Fraunces, Syne, B612_Mono } from "next/font/google";
import "./globals.css";

// Fraunces — display.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

// Syne — UI body.
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// B612 Mono — data / numeric.
const b612 = B612_Mono({
  variable: "--font-b612",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GoldenEye — Search & Rescue Detection",
  description:
    "AI-based aerial human detection for desert search and rescue. YOLOv8n trained on a private desert dataset; designed for edge deployment on Raspberry Pi 5 with AI acceleration.",
  keywords: ["SAR", "search and rescue", "drone", "human detection", "YOLO", "edge AI"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`
        ${fraunces.variable}
        ${syne.variable}
        ${b612.variable}
      `}
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
