import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArcVault AI Intake",
  description: "AI-powered customer request classification, enrichment, routing and escalation demo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
