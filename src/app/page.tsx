import type { Metadata } from "next";
import { cookies } from "next/headers";
import LandingPageClient from "./components/landing/LandingPageClient";
import LandingPageJsonLd from "./components/seo/LandingPageJsonLd";

type SupportedLocale = "ja" | "en" | "ko";

const META: Record<SupportedLocale, { title: string; description: string; ogDescription: string; twitterDescription: string }> = {
  ja: {
    title: "LoL Coach AI | AIが導く、次のランクへ",
    description:
      "League of Legendsの試合データ・リプレイ動画をAIが分析。CS精度、視界管理、マクロ判断をプロレベルで診断し、ランクアップを加速します。",
    ogDescription:
      "試合データ・リプレイ動画をAIが分析。プロレベルのコーチングでランクアップをサポート。",
    twitterDescription: "プロレベルのLoLコーチングをAIで。",
  },
  en: {
    title: "LoL Coach AI | AI-Powered Coaching to Reach Your Next Rank",
    description:
      "AI analyzes your League of Legends match data and replay videos. Get pro-level coaching on CS accuracy, vision control, and macro decisions to climb ranks faster.",
    ogDescription:
      "AI-powered match analysis and replay review. Pro-level coaching to help you rank up.",
    twitterDescription: "Pro-level LoL coaching powered by AI.",
  },
  ko: {
    title: "LoL Coach AI | AI가 이끄는 다음 랭크로",
    description:
      "리그 오브 레전드 경기 데이터와 리플레이 영상을 AI가 분석합니다. CS 정확도, 시야 관리, 매크로 판단을 프로 수준으로 진단하여 랭크업을 가속합니다.",
    ogDescription:
      "경기 데이터와 리플레이를 AI가 분석. 프로 수준의 코칭으로 랭크업을 지원합니다.",
    twitterDescription: "AI 기반 프로 수준 LoL 코칭.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("language")?.value as SupportedLocale) || "ja";
  const m = META[locale] ?? META.ja;

  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title: m.title,
      description: m.ogDescription,
      type: "website",
      locale: locale === "ja" ? "ja_JP" : locale === "ko" ? "ko_KR" : "en_US",
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
        ja: "https://lolcoachai.com",
        en: "https://lolcoachai.com",
        ko: "https://lolcoachai.com",
      },
    },
  };
}

export default function LandingPage() {
  return (
    <>
      <LandingPageJsonLd />
      <LandingPageClient />
    </>
  );
}
