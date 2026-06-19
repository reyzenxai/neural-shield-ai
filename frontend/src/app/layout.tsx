import type { Metadata } from "next";
import {
  Inter,
  Space_Grotesk,
  Fraunces,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Neural Shield AI",
  description: "AI-powered scam detection platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`
        ${inter.variable}
        ${spaceGrotesk.variable}
        ${fraunces.variable}
      `}
    >
      <body>{children}</body>
    </html>
  );
}