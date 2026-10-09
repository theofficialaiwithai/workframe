import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Geist comes from the official `geist` package (next/font/google in Next 14.2
// has no Geist). Cabinet Grotesk is not on Google Fonts: downloaded from fontshare.com (free for commercial use).
const cabinetGrotesk = localFont({
  src: [
    { path: "../fonts/CabinetGrotesk-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/CabinetGrotesk-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-cabinet",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Workframe",
  description: "Python courses that start with your job.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${jetbrainsMono.variable} ${cabinetGrotesk.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
