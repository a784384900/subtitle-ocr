import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "字幕提取工具 - Subtitle OCR",
  description: "基于AI视觉模型的视频硬字幕提取工具，支持高质量OCR识别、批量处理、多格式导出",
  keywords: ["字幕提取", "OCR", "视频字幕", "硬字幕", "AI识别", "VLM"],
  authors: [{ name: "Subtitle OCR Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "字幕提取工具 - Subtitle OCR",
    description: "基于AI视觉模型的视频硬字幕提取工具",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
