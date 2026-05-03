import type { Metadata } from "next";
import { Inter_Tight, Outfit } from "next/font/google";
import "./globals.css";
import { MatchProvider } from "@/context/MatchContext";
import Navigation from "@/components/Navigation";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-display",
  style: ["italic", "normal"],
  weight: ["900"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "CricLens Pro | AI Cricket Analyst",
  description: "Multimodal AI pipeline for high-fidelity cricket intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${interTight.variable} ${outfit.variable} font-sans antialiased`}>
        <MatchProvider>
          <div className="min-h-screen relative">
            <Navigation />
            {children}
            <div className="fixed inset-0 pointer-events-none -z-10 opacity-30 bg-[linear-gradient(rgba(163,230,53,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(163,230,53,0.02)_1px,transparent_1px)] bg-[size:100px_100px]" />
            <div className="fixed inset-0 pointer-events-none -z-20 bg-[radial-gradient(circle_at_50%_-20%,rgba(163,230,53,0.05),transparent_70%)]" />
          </div>
        </MatchProvider>
      </body>
    </html>
  );
}
