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
