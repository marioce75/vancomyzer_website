import type { CalculateRequestLevel } from '@/types/calculator';
import { isManualHoursCollectionTime, manualHoursCollectionTime } from '@/lib/manualHoursTimestamp';

export interface TimingDraft {
  dateMode: boolean;
  doseDate: string;
  doseTime: string;
  levelDate: string;
  levelTime: string;
}
// UI-only metadata: stripped before sending the unchanged calculation contract.
export type LevelDraft = CalculateRequestLevel & { timing?: TimingDraft };

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function localTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function timingDraft(level: LevelDraft, today: string, doseDate?: string, doseTime?: string): TimingDraft {
  if (level.timing) return level.timing;
  const draft = { dateMode: !isManualHoursCollectionTime(level.collection_time), doseDate: doseDate ?? today, doseTime: doseTime ?? '', levelDate: today, levelTime: '' };
  const sample = new Date(level.collection_time);
  if (draft.dateMode && Number.isFinite(sample.getTime()) && Number.isFinite(level.time_since_last_dose_hours) && level.time_since_last_dose_hours >= 0) {
    const dose = new Date(sample.getTime() - level.time_since_last_dose_hours * 3_600_000);
    return { ...draft, levelDate: localDate(sample), levelTime: localTime(sample), doseDate: localDate(dose), doseTime: localTime(dose) };
  }
  return draft;
}
export function buildDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const dt = new Date(`${date}T${time}:00`);
  // Reject calendar overflow and nonexistent local clock times (e.g. DST gaps).
  if (!Number.isFinite(dt.getTime()) || localDate(dt) !== date || localTime(dt) !== time) return null;
  return dt;
}
export function calcHours(doseDate: string, doseTime: string, levelDate: string, levelTime: string): number | null {
  const a = buildDateTime(doseDate, doseTime);
  const b = buildDateTime(levelDate, levelTime);
  if (!a || !b) return null;
  const diff = b.getTime() - a.getTime();
  return diff < 0 ? -1 : Math.round(diff / 3_600_000 * 100) / 100;
}
export function withTiming(level: LevelDraft, timing: TimingDraft): LevelDraft {
  const hours = calcHours(timing.doseDate, timing.doseTime, timing.levelDate, timing.levelTime);
  const valid = hours !== null && hours >= 0;
  return { ...level, timing, collection_time: valid ? buildDateTime(timing.levelDate, timing.levelTime)!.toISOString() : '', time_since_last_dose_hours: valid ? hours : NaN };
}
export function switchTimingMode(level: LevelDraft, draft: TimingDraft): LevelDraft {
  const timing = { ...draft, dateMode: !draft.dateMode };
  return timing.dateMode ? withTiming(level, timing) : { ...level, timing, collection_time: '', time_since_last_dose_hours: NaN };
}
export function withManualHours(level: LevelDraft, hours: number): LevelDraft {
  return { ...level, time_since_last_dose_hours: hours, collection_time: manualHoursCollectionTime(hours) };
}
export function timingIsValid(level: LevelDraft): boolean {
  if (level.timing?.dateMode) {
    const derived = withTiming(level, level.timing);
    return Number.isFinite(derived.time_since_last_dose_hours) && derived.collection_time === level.collection_time && derived.time_since_last_dose_hours === level.time_since_last_dose_hours;
  }
  return Number.isFinite(level.time_since_last_dose_hours) && level.time_since_last_dose_hours >= 0 && Number.isFinite(Date.parse(level.collection_time));
}
export function isEnteredLevel(level: LevelDraft): boolean {
  return Boolean(level.timing) || level.value_mcg_ml !== 0 || level.time_since_last_dose_hours !== 0 || (level.collection_time ?? '').trim() !== '';
}
export function requestLevel({ value_mcg_ml, collection_time, time_since_last_dose_hours }: LevelDraft): CalculateRequestLevel {
  return { value_mcg_ml, collection_time, time_since_last_dose_hours };
}

/** Older sessions did not persist date drafts, so their timestamps may be stale.
 * Keep concentrations and manual-hour entries; require calendar timing re-entry.
 */
export function restoreLevelDrafts(levels: LevelDraft[], timingDraftVersion: unknown): LevelDraft[] {
  if (timingDraftVersion === 1) return levels;
  return levels.map(level => !isEnteredLevel(level) || isManualHoursCollectionTime(level.collection_time)
    ? level
    : { value_mcg_ml: level.value_mcg_ml, collection_time: '', time_since_last_dose_hours: NaN });
}
