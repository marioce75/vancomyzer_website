/**
 * Synthetic timestamps for manual-hours level entry.
 *
 * Manual-hours mode has no wall-clock times, but the server reads
 * `collection_time` with `Date.parse` and compares the gap between two levels'
 * collection times against the difference in their hours-after-dose. Sending
 * the typed hours directly ("2.5") parsed as a calendar date (Feb 5 2001) or
 * failed outright ("7.47"), so valid entries were rejected.
 *
 * Each level therefore gets a synthetic ISO timestamp: a fixed reference dose
 * time plus its hours after the dose. The gap between two levels then equals
 * the difference in their entered hours. The reference date is arbitrary and
 * never shown to anyone.
 *
 * This lives in its own module rather than in the level-entry component so the
 * server-side validator can recognise these timestamps without importing a
 * React component — it has to distinguish them from real draw times to tell a
 * clinician that two levels were entered in different modes.
 */
export const MANUAL_HOURS_REFERENCE_DOSE_MS = Date.UTC(2000, 0, 1, 0, 0, 0);

/** Synthetic timestamps fall within this window after the reference. */
export const MANUAL_HOURS_WINDOW_MS = 31 * 24 * 3_600_000;

export function manualHoursCollectionTime(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  return new Date(MANUAL_HOURS_REFERENCE_DOSE_MS + Math.round(hours * 3_600_000)).toISOString();
}

export function isManualHoursCollectionTime(collectionTime: string | undefined): boolean {
  if (!collectionTime) return false;
  const ms = Date.parse(collectionTime);
  return Number.isFinite(ms)
    && ms >= MANUAL_HOURS_REFERENCE_DOSE_MS
    && ms < MANUAL_HOURS_REFERENCE_DOSE_MS + MANUAL_HOURS_WINDOW_MS;
}
