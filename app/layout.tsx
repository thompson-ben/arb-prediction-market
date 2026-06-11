import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arb Terminal — Prediction Market Arbitrage",
  description:
    "Professional cross-venue arbitrage terminal for Polymarket, Kalshi, and PredictIt.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
