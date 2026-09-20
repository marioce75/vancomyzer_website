/** Approved September 20, 2026. Match the Stripe lookup key in live and test mode. */
export const PRO_ANNUAL_LOOKUP_KEY = "vancomyzer_pro_annual_4999";
export const RENEWAL_CONSENT_VERSION = "2026-09-20-pro-annual-49.99";
export const PRO_RENEWAL_TERMS = "14-day free trial, then USD 49.99 per year until canceled. Verified discounts are shown before payment. Cancel online in Settings > Billing before the trial ends to avoid a charge, or before renewal to stop the next charge. Free accounts never convert automatically.";
export function isApprovedProPrice(price: { active: boolean; currency: string; unit_amount: number | null; recurring: { interval: string; interval_count: number } | null }): boolean {
  return price.active && price.currency === "usd" && price.unit_amount === 4999 && price.recurring?.interval === "year" && price.recurring.interval_count === 1;
}
