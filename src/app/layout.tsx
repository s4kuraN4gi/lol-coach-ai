import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { SummonerProvider } from "./Providers/SummonerProvider";
import { AuthProvider } from "./Providers/AuthProvider";
import { VisionAnalysisProvider } from "./Providers/VisionAnalysisProvider";
import { CoachUIProvider } from "./Providers/CoachUIProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LoL Coach AI | あなたの専属AIコーチ",
  description: "League of Legendsの試合結果やリプレイ動画をAIが解析。プロレベルのコーチングでランクアップをサポートします。",
  openGraph: {
    title: "LoL Coach AI | あなたの専属AIコーチ",
    description: "League of Legendsの試合結果やリプレイ動画をAIが解析。プロレベルのコーチングでランクアップをサポートします。",
    type: "website",
    locale: "ja_JP",
    siteName: "LoL Coach AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "LoL Coach AI",
    description: "プロレベルのLoLコーチングをAIで。",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
      >
        <LanguageProvider>
          <AuthProvider>
            <SummonerProvider>
              <VisionAnalysisProvider>
                <CoachUIProvider>
                  {children}
                </CoachUIProvider>
              </VisionAnalysisProvider>
            </SummonerProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
