import type { Metadata } from "next";
import { Cousine, Inter } from "next/font/google";
import "./globals.css";

const mono = Cousine({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

import { app } from "@/config/app";
import { getAssetPath } from "@/lib/assets";
import FeedbackLayer from "@/components/ui/FeedbackLayer";

const logoUrl = getAssetPath("/fooda-logo.png");

export const metadata: Metadata = {
  title: `${app.name} — ${app.tagline}`,
  description: app.description,
  icons: {
    icon: [
      { url: logoUrl, type: "image/png" },
    ],
    shortcut: logoUrl,
    apple: logoUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${mono.variable} ${inter.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href={logoUrl} type="image/png" />
        <link rel="shortcut icon" href={logoUrl} />
        <link rel="apple-touch-icon" href={logoUrl} />
      </head>
      <body className="min-h-full flex flex-col bg-app-bg text-text-primary font-body">
        {children}
        <FeedbackLayer />
      </body>
    </html>
  );
}
