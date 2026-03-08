"use server";

import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { FALLBACK_PRICES, type PriceInfo } from "./pricingConstants";

const LOCALE_MAP: Record<string, string> = {
  ja: "ja-JP",
  en: "en-US",
  ko: "ko-KR",
};

function formatPrice(amount: number, locale: string = "ja"): string {
  return amount.toLocaleString(LOCALE_MAP[locale] || "ja-JP");
}

export async function getStripePrices(locale: string = "ja"): Promise<PriceInfo> {
  try {
    const priceIds = [
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_EXTRA_ANNUAL_PRICE_ID,
    ].filter(Boolean) as string[];

    if (priceIds.length < 4) {
      return FALLBACK_PRICES;
    }

    const prices = await Promise.all(
      priceIds.map((id) => stripe.prices.retrieve(id))
    );

    const [premiumMonth, premiumYear, extraMonth, extraYear] = prices;

    const pmAmount = (premiumMonth.unit_amount || 98000) / 100;
    const paAmount = (premiumYear.unit_amount || 780000) / 100;
    const emAmount = (extraMonth.unit_amount || 148000) / 100;
    const eaAmount = (extraYear.unit_amount || 880000) / 100;

    const CURRENCY_SYMBOLS: Record<string, string> = { jpy: "¥", usd: "$", eur: "€", krw: "₩", gbp: "£" };
    const currency = premiumMonth.currency?.toLowerCase() || "jpy";
    const currencySymbol = CURRENCY_SYMBOLS[currency] || currency.toUpperCase() + " ";

    const paMonthly = Math.round(paAmount / 12);
    const eaMonthly = Math.round(eaAmount / 12);

    const premiumDiscount = Math.round((1 - paMonthly / pmAmount) * 100);
    const extraDiscount = Math.round((1 - eaMonthly / emAmount) * 100);

    return {
      premiumMonthly: formatPrice(pmAmount, locale),
      premiumAnnual: formatPrice(paAmount, locale),
      premiumAnnualMonthly: formatPrice(paMonthly, locale),
      premiumDiscount: String(premiumDiscount),
      extraMonthly: formatPrice(emAmount, locale),
      extraAnnual: formatPrice(eaAmount, locale),
      extraAnnualMonthly: formatPrice(eaMonthly, locale),
      extraDiscount: String(extraDiscount),
      currencySymbol,
      isFallback: false,
    };
  } catch (error) {
    logger.error("[Pricing] Failed to fetch Stripe prices:", error);
    return FALLBACK_PRICES;
  }
}
