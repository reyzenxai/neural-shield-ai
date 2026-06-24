import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { CookieBanner } from "@/components/ui/CookieBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Neural Shield AI — Stop Scams Before They Stop You",
  description:
    "AI-powered fraud detection for messages, URLs, emails, QR codes, and payments. Built for India.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://frontend-cyan-five-59.vercel.app"
  ),
  openGraph: {
    title: "Neural Shield AI — Stop Scams Before They Stop You",
    description:
      "AI-powered fraud detection for messages, URLs, emails, QR codes, and payments. Built for India.",
    type: "website",
    siteName: "Neural Shield AI",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Neural Shield AI — Stop Scams Before They Stop You",
    description: "AI-powered scam detection for India. Scan messages, URLs, UPI IDs, QR codes instantly.",
    images: ["/api/og"],
  },
  keywords: ["scam detection", "fraud detection", "UPI fraud", "phishing", "cyber fraud India", "scam checker"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        <AppProviders>{children}</AppProviders>
        <CookieBanner />
      </body>
    </html>
  );
}
