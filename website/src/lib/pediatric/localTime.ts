/**
 * Explicit time-zone interpretation of wall-clock entries (docs/pediatric/INPUT-VALIDATION.md §2).
 *
 * The API accepts only instants with an explicit offset. The workspace lets
 * the administrator type a local wall-clock time and choose the zone it was
 * recorded in; this module converts that pair to an instant WITHOUT Date.parse
 * on local strings, so that:
 *   - a wall-clock time that does not exist in the zone (spring-forward gap,
 *     e.g. America/New_York 2026-03-08 02:30) is reported as `gap`, not moved;
 *   - a wall-clock time that occurs twice (fall-back fold, e.g. America/New_York
 *     2026-11-01 01:30) is reported as `fold` with both candidate offsets, and
 *     the caller must choose one;
 *   - a unique wall-clock time resolves to exactly one instant with its offset.
 * Zone rules come from the JavaScript Intl database (IANA zone names) and are
 * independent of the process or browser local zone. Fixed offsets are also
 * accepted as "UTC", "+05:30" or "-04:00".
 */

export interface WallClock { year: number; month: number; day: number; hour: number; minute: number; second?: number }
export interface ResolvedInstant { ms: number; offsetMinutes: number; iso: string }
export type LocalResolution =
  | { kind: "ok"; instant: ResolvedInstant }
  | { kind: "gap"; message: string; before: ResolvedInstant; after: ResolvedInstant }
  | { kind: "fold"; message: string; options: ResolvedInstant[] }
  | { kind: "invalid"; message: string };

const FIXED = /^(UTC|Z|[+-]\d{2}:\d{2})$/;
const pad = (n: number, w = 2) => String(Math.abs(Math.trunc(n))).padStart(w, "0");

export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const a = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** ISO 8601 string of the wall-clock fields with the given offset (what the API receives). */
export function formatWithOffset(w: WallClock, offsetMinutes: number): string {
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second ?? 0)}${formatOffset(offsetMinutes)}`;
}

/** Parses the value of an HTML datetime-local input ("YYYY-MM-DDTHH:MM" or with ":SS"). */
export function parseWallClock(s: string): WallClock | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const w = { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5], second: m[6] === undefined ? 0 : +m[6] };
  const dim = new Date(Date.UTC(w.year, w.month, 0)).getUTCDate();
  if (w.month < 1 || w.month > 12 || w.day < 1 || w.day > dim || w.hour > 23 || w.minute > 59 || w.second > 59) return null;
  return w;
}

export function isValidZone(zone: string): boolean {
  if (FIXED.test(zone)) { if (zone === "UTC" || zone === "Z") return true; const h = +zone.slice(1, 3), m = +zone.slice(4, 6); return h * 60 + m <= 14 * 60 && m <= 59; }
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); return true; } catch { return false; }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = fmtCache.get(zone);
  if (!f) { f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); fmtCache.set(zone, f); }
  return f;
}

/** UTC offset (minutes east of UTC) in force in `zone` at the instant `ms`. */
export function offsetAt(zone: string, ms: number): number {
  if (FIXED.test(zone)) return zone === "UTC" || zone === "Z" ? 0 : (zone[0] === "-" ? -1 : 1) * (+zone.slice(1, 3) * 60 + +zone.slice(4, 6));
  const parts = formatter(zone).formatToParts(new Date(ms));
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

function instant(ms: number, zone: string): ResolvedInstant {
  const off = offsetAt(zone, ms);
  const local = new Date(ms + off * 60000);
  return { ms, offsetMinutes: off, iso: formatWithOffset({ year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate(), hour: local.getUTCHours(), minute: local.getUTCMinutes(), second: local.getUTCSeconds() }, off) };
}

/**
 * Resolves a wall-clock time in `zone`. Candidates are the UTC guess minus
 * each offset observed around it; a candidate is valid when the zone's offset
 * at that instant maps it back to the same wall-clock fields.
 */
export function resolveLocal(w: WallClock, zone: string): LocalResolution {
  if (!isValidZone(zone)) return { kind: "invalid", message: `Unknown time zone "${zone}".` };
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second ?? 0);
  if (!Number.isFinite(guess)) return { kind: "invalid", message: "Invalid date/time." };
  const offsets = new Set<number>();
  for (const probe of [guess - 24 * 3600000, guess - 12 * 3600000, guess, guess + 12 * 3600000, guess + 24 * 3600000]) offsets.add(offsetAt(zone, probe));
  const valid: ResolvedInstant[] = [];
  for (const off of Array.from(offsets)) {
    const cand = guess - off * 60000;
    if (offsetAt(zone, cand) === off) valid.push(instant(cand, zone));
  }
  valid.sort((a, b) => a.ms - b.ms);
  const dedup = valid.filter((v, i) => i === 0 || v.ms !== valid[i - 1].ms);
  const label = `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}`;
  if (dedup.length === 1) return { kind: "ok", instant: dedup[0] };
  if (dedup.length === 0) {
    // Gap: the wall-clock time was skipped. Report the instants just before and after the transition.
    const offs = Array.from(offsets).sort((a, b) => a - b);
    const before = instant(guess - offs[0] * 60000, zone), after = instant(guess - offs[offs.length - 1] * 60000, zone);
    return { kind: "gap", message: `${label} does not exist in ${zone}: clocks skipped forward that day (${formatOffset(Math.min(...offs))} → ${formatOffset(Math.max(...offs))}). Enter the time actually recorded on the chart, or choose the zone/offset the clock was set to.`, before: before.ms < after.ms ? before : after, after: before.ms < after.ms ? after : before };
  }
  return { kind: "fold", message: `${label} occurs twice in ${zone} (clocks went back that day). Choose the offset in force when the entry was recorded: ${dedup.map((d) => `${formatOffset(d.offsetMinutes)} (${d === dedup[0] ? "first" : "second"} occurrence)`).join(" or ")}.`, options: dedup };
}

/** Resolves with an explicit offset choice for a fold; errors if the choice does not match a valid occurrence. */
export function resolveLocalWithChoice(w: WallClock, zone: string, chosenOffsetMinutes: number | null | undefined): LocalResolution {
  const r = resolveLocal(w, zone);
  if (r.kind !== "fold") return r;
  if (chosenOffsetMinutes === null || chosenOffsetMinutes === undefined) return r;
  const pick = r.options.find((o) => o.offsetMinutes === chosenOffsetMinutes);
  if (!pick) return { kind: "invalid", message: `Offset ${formatOffset(chosenOffsetMinutes)} is not one of the valid occurrences (${r.options.map((o) => formatOffset(o.offsetMinutes)).join(", ")}).` };
  return { kind: "ok", instant: pick };
}

/** Zone list for the selector: IANA zones from the runtime plus UTC and fixed offsets. */
export function zoneChoices(): string[] {
  const iana = (typeof (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf === "function")
    ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone")
    : ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Brussels", "Asia/Tokyo"];
  const fixed: string[] = ["UTC"];
  for (let h = -12; h <= 14; h++) for (const m of [0, 30]) { if (h === 14 && m) continue; if (h === -12 && m) continue; fixed.push(`${h < 0 ? "-" : "+"}${pad(h)}:${pad(m)}`); }
  return [...iana, ...fixed];
}
