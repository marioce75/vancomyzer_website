/**
 * Regimen identity for labels and wording.
 *
 * A regimen is its dose, its interval AND its infusion duration. Two regimens
 * with the same dose and interval but a different infusion duration are not
 * the same regimen: the exposure differs and so does what the nurse hangs.
 * Every "is this the regimen as entered?" / "continue" / "same regimen"
 * decision in the notes, the PDF, the candidate table and the engine's
 * explanation text goes through here.
 *
 * Display and wording only. Nothing in this file is used by the PK
 * calculation or by the candidate selection.
 */

export interface RegimenIdentity {
  dose_mg: number;
  interval_hours: number;
  /** Hours. Absent when the source does not state one. */
  infusion_duration_hours?: number | null;
}

/** Infusion duration in minutes, as printed everywhere ("infused over 100 minutes"). */
export function infusionMinutes(hours: number | null | undefined): number | undefined {
  return hours !== null && hours !== undefined && Number.isFinite(hours) && hours > 0
    ? Number((hours * 60).toFixed(6))
    : undefined;
}

/**
 * Same infusion duration to the printed precision. A stated duration never
 * equals an unstated one: an unknown duration cannot be called "unchanged".
 */
export function sameInfusionDuration(a: number | null | undefined, b: number | null | undefined): boolean {
  const ma = infusionMinutes(a);
  const mb = infusionMinutes(b);
  if (ma === undefined || mb === undefined) return ma === mb;
  return Math.abs(ma - mb) < 1e-3;
}

/** Same dose, same interval and same infusion duration. */
export function sameRegimen(a: RegimenIdentity, b: RegimenIdentity): boolean {
  return (
    a.dose_mg === b.dose_mg &&
    a.interval_hours === b.interval_hours &&
    sameInfusionDuration(a.infusion_duration_hours, b.infusion_duration_hours)
  );
}

export type RegimenChange =
  /** Dose, interval and infusion duration all as entered. */
  | "none"
  /** Dose and interval as entered; only the infusion duration differs. */
  | "infusion_only"
  /** The dose or the interval differs (the infusion duration may differ too). */
  | "dose_or_interval";

export function classifyRegimenChange(entered: RegimenIdentity, proposed: RegimenIdentity): RegimenChange {
  if (entered.dose_mg !== proposed.dose_mg || entered.interval_hours !== proposed.interval_hours) return "dose_or_interval";
  return sameInfusionDuration(entered.infusion_duration_hours, proposed.infusion_duration_hours) ? "none" : "infusion_only";
}

/** "infusion duration change from 120 to 100 minutes", or null when it does not change (or either is unstated). */
export function infusionChangeText(entered: RegimenIdentity, proposed: RegimenIdentity): string | null {
  const from = infusionMinutes(entered.infusion_duration_hours);
  const to = infusionMinutes(proposed.infusion_duration_hours);
  if (from === undefined || to === undefined || Math.abs(from - to) < 1e-3) return null;
  return `infusion duration change from ${from} to ${to} minutes`;
}
