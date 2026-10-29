/**
 * Weight-for-age z-scores (WHO 2006 standard 0-60 months, CDC 2000 reference
 * 61-240 months) used ONLY to flag unusual weights for verification. Sex is
 * not an input of the model, so both sexes are evaluated and the value closer
 * to zero is used for flagging (the more permissive reading).
 * Sources, populations and limitations: weight-for-age-lms.json.
 */
import table from "./weight-for-age-lms.json";

interface LMS { L: number; M: number; S: number }
interface Row { month: number; source: string; tabulated_age: string; boys: LMS; girls: LMS }
const rows = (table as { rows: Row[] }).rows;
export const GROWTH_SOURCES = (table as { sources: Record<string, Record<string, string>> }).sources;
export const GROWTH_MAX_MONTHS = rows.length - 1;

export function lmsZ(x: number, p: LMS): number {
  return p.L !== 0 ? (Math.pow(x / p.M, p.L) - 1) / (p.L * p.S) : Math.log(x / p.M) / p.S;
}

export interface WeightForAge {
  monthsUsed: number;
  source: string;
  zBoys: number;
  zGirls: number;
  /** z closer to zero of the two sexes (used for flags). */
  zPermissive: number;
  medianBoysKg: number;
  medianGirlsKg: number;
}

/** @param ageMonths completed chronological months (corrected for prematurity by the caller when appropriate). */
export function weightForAge(weightKg: number, ageMonths: number): WeightForAge | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(ageMonths) || weightKg <= 0 || ageMonths < 0 || ageMonths > GROWTH_MAX_MONTHS) return null;
  const r = rows[Math.floor(ageMonths)];
  const zBoys = lmsZ(weightKg, r.boys), zGirls = lmsZ(weightKg, r.girls);
  return { monthsUsed: r.month, source: r.source, zBoys, zGirls, zPermissive: Math.abs(zBoys) < Math.abs(zGirls) ? zBoys : zGirls, medianBoysKg: r.boys.M, medianGirlsKg: r.girls.M };
}
