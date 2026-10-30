import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import PwaProvider from "@/components/pwa/PwaProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Lastrivon Kart India — Multi-Vendor Marketplace",
  description:
    "Shop electronics, fashion, home & more from trusted sellers. Platform-owned and vendor products, one cart, one checkout.",
  keywords: ["marketplace", "ecommerce", "multi-vendor", "shopping", "India"],
  manifest: "/manifest.webmanifest",
  applicationName: "Lastrivon Kart",
  appleWebApp: {
    capable: true,
    title: "Lastrivon Kart",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Lastrivon Kart India — Multi-Vendor Marketplace",
    description:
      "Shop electronics, fashion, home & more from trusted sellers. New & refurbished products, B2B bulk quotes, Razorpay payments.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-clip bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-right" richColors />
        <PwaProvider />
      </body>
    </html>
  );
}
