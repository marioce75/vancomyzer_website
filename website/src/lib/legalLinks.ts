/**
 * Production URLs for canonical legal documents on the dosys.health
 * marketing site. Single source of truth — used by the in-app
 * /disclaimer, /privacy, /terms pages, the Footer, and the BAA flow.
 *
 * Update these when the marketing-site URLs change.
 */

export const LEGAL_LINKS = {
  disclaimer: "https://dosys.health/legal/disclaimer",
  privacy: "https://dosys.health/legal/privacy",
  terms: "https://dosys.health/legal/terms",
  baa: "https://dosys.health/legal/baa",
} as const;
