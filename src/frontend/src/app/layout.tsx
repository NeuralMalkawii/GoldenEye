import type { Metadata } from "next";
import { Fraunces, Syne, Fira_Code, Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-noto-naskh",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GoldenEye — Search & Rescue Detection",
  description:
    "AI-powered human detection for search and rescue operations. Trained on Shaheen and SARD datasets. Edge-deployable on Raspberry Pi + Hailo-8L.",
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
        ${firaCode.variable}
        ${notoNaskhArabic.variable}
      `}
    >
      <body className="min-h-dvh flex flex-col antialiased">{children}</body>
    </html>
  );
}
