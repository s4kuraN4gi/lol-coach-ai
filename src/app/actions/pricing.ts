"use server";

import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export type PriceInfo = {
  premiumMonthly: string;
  premiumAnnual: string;
  premiumAnnualMonthly: string;
  premiumDiscount: string;
  extraMonthly: string;
  extraAnnual: string;
  extraAnnualMonthly: string;
  extraDiscount: string;
  /** Currency symbol (e.g. "¥", "$") derived from Stripe or locale */
  currencySymbol: string;
  /** true when prices are fallback values (Stripe unavailable or env vars missing) */
  isFallback: boolean;
};

/**
 * Hardcoded fallback prices displayed when Stripe API is unreachable.
 * These MUST be kept in sync with actual Stripe price settings.
 * Currency: JPY (unit_amount / 100).
 *
 * Last updated: 2026-03-02
 * - Premium Monthly: ¥980
 * - Premium Annual:  ¥7,800 (¥650/mo, 34% off)
 * - Extra Monthly:   ¥1,480
 * - Extra Annual:    ¥8,800 (¥733/mo, 50% off)
 */
export const FALLBACK_PRICES: PriceInfo = {
  premiumMonthly: "980",
  premiumAnnual: "7,800",
  premiumAnnualMonthly: "650",
  premiumDiscount: "34",
  extraMonthly: "1,480",
  extraAnnual: "8,800",
  extraAnnualMonthly: "733",
  extraDiscount: "50",
  currencySymbol: "¥",
  isFallback: true,
};

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
