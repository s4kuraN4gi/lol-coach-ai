/**
 * JSON-LD structured data for the Landing Page.
 * This is a Server Component that outputs <script type="application/ld+json">
 * for SEO crawlers, rendered alongside the client-side LP.
 */

const BASE_URL = "https://lolcoachai.com";

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "LoL Coach AI",
  url: BASE_URL,
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  description:
    "League of Legendsの試合結果やリプレイ動画をAIが解析。プロレベルのコーチングでランクアップをサポートします。",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "JPY",
      description: "月3回のAI分析、Riot API連携、分析履歴保存",
    },
    {
      "@type": "Offer",
      name: "Premium",
      price: "980",
      priceCurrency: "JPY",
      description: "週20回のAI分析、AIコーチチャット、ビルドアドバイス、広告非表示",
    },
    {
      "@type": "Offer",
      name: "Extra",
      price: "1480",
      priceCurrency: "JPY",
      description: "週30回のAI分析、5セグメント動画分析、AIダメージ分析",
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "LoL Coach AIとは何ですか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LoL Coach AIは、League of Legendsの試合結果やリプレイ動画をAIが解析し、プロレベルのコーチングを提供するWebアプリケーションです。Riot API連携により自動で試合データを取得し、改善点を分析します。",
      },
    },
    {
      "@type": "Question",
      name: "無料で使えますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい、無料プランでは月3回のAI分析、Riot API連携、分析履歴の保存が利用できます。ゲストとして登録不要で1回試すこともできます。",
      },
    },
    {
      "@type": "Question",
      name: "Premium/Extraプランでは何ができますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Premiumプラン（月額¥980）では週20回のAI分析、AIコーチチャット、ビルドアドバイスが利用できます。Extraプラン（月額¥1,480）ではさらに週30回の分析と高度な動画分析が利用できます。",
      },
    },
    {
      "@type": "Question",
      name: "どのリージョンに対応していますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Japan、Korea、North America、Europe West、Europe Nordic & East、Oceania、Brazil、LATINの各リージョンに対応しています。",
      },
    },
  ],
};

export default function LandingPageJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
