import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SummonerProvider } from "./providers/SummonerProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import SWRProvider from "./providers/SWRProvider";
import MotionProvider from "./providers/MotionProvider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type SupportedLocale = "ja" | "en" | "ko";

const LAYOUT_META: Record<SupportedLocale, { title: string; description: string; twitterDescription: string }> = {
  ja: {
    title: "LoL Coach AI | あなたの専属AIコーチ",
    description: "League of Legendsの試合結果やリプレイ動画をAIが解析。プロレベルのコーチングでランクアップをサポートします。",
    twitterDescription: "プロレベルのLoLコーチングをAIで。",
  },
  en: {
    title: "LoL Coach AI | Your Personal AI Coach",
    description: "AI analyzes your League of Legends match data and replay videos. Pro-level coaching to help you rank up.",
    twitterDescription: "Pro-level LoL coaching powered by AI.",
  },
  ko: {
    title: "LoL Coach AI | 당신의 전속 AI 코치",
    description: "리그 오브 레전드 경기 데이터와 리플레이 영상을 AI가 분석합니다. 프로 수준의 코칭으로 랭크업을 지원합니다.",
    twitterDescription: "AI 기반 프로 수준 LoL 코칭.",
  },
};

const LOCALE_MAP: Record<SupportedLocale, string> = {
  ja: "ja_JP",
  en: "en_US",
  ko: "ko_KR",
};

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("language")?.value as SupportedLocale) || "ja";
  const m = LAYOUT_META[locale] ?? LAYOUT_META.ja;

  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title: m.title,
      description: m.description,
      type: "website",
      locale: LOCALE_MAP[locale] || "ja_JP",
      siteName: "LoL Coach AI",
    },
    twitter: {
      card: "summary_large_image",
      title: "LoL Coach AI",
      description: m.twitterDescription,
    },
    alternates: {
      canonical: "https://lolcoachai.com",
      languages: {
        "ja": "https://lolcoachai.com",
        "en": "https://lolcoachai.com",
        "ko": "https://lolcoachai.com",
        "x-default": "https://lolcoachai.com",
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const cookieStore = await cookies();
  const lang = (cookieStore.get("language")?.value as SupportedLocale) || "ja";

  return (
    <html lang={lang}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        nonce={nonce}
      >
        <LanguageProvider>
          <MotionProvider>
          <SWRProvider>
            <AuthProvider>
              <SummonerProvider>
                {children}
                <Toaster theme="dark" position="top-right" richColors closeButton />
              </SummonerProvider>
            </AuthProvider>
          </SWRProvider>
          </MotionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
