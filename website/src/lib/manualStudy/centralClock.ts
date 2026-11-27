/** The Manual doses UI uses the hospital clock, never the device time zone. */
export const MANUAL_CLOCK_ZONE = "America/Chicago";
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MANUAL_CLOCK_ZONE, calendar: "gregory", numberingSystem: "latn",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

type ClockResult = { ok: true; instantMs: number } | { ok: false; code: "invalid" | "gap" | "repeated" };

function wallSecond(ms: number) {
  const parts = formatter.formatToParts(ms);
  const get = (key: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === key)?.value ?? "";
  return `${get("year").padStart(4,"0")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Try the surrounding IANA zone offsets, then accept only a unique exact
 * wall-clock round trip. No seconds, UTC/offset, or browser zone is entered. */
export function resolveCentralMinute(date: string, time: string): ClockResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, code: "invalid" };
  if (date.startsWith("0000-")) return { ok: false, code: "invalid" };
  const wall = `${date}T${time}:00`;
  const asUtc = Date.parse(wall + "Z"); // Numeric wall-clock anchor, not a zone assumption.
  if (!Number.isFinite(asUtc) || new Date(asUtc).toISOString().slice(0, 19) !== wall) return { ok: false, code: "invalid" };

  const offsets = new Set([-36, 0, 36].map(h => {
    const sample = asUtc + h * HOUR_MS;
    return Date.parse(wallSecond(sample) + "Z") - sample;
  }));
  const matches = Array.from(offsets, offset => asUtc - offset)
    .filter(ms => Number.isFinite(ms) && wallSecond(ms) === wall);
  if (matches.length === 1) return { ok: true, instantMs: matches[0] };
  return { ok: false, code: matches.length ? "repeated" : "gap" };
}

export function describeClockRefusal(field: string, code: Extract<ClockResult,{ok:false}>["code"]) {
  if (code === "gap") return `${field} falls in the hour skipped when the clocks move forward. Verify the source time; this worksheet cannot use it.`;
  if (code === "repeated") return `${field} falls in the hour repeated when the clocks move back. The worksheet cannot tell which occurrence was recorded.`;
  return `Enter a valid date and 24-hour time (HH:MM) for ${field.toLowerCase()}.`;
}

export function sameRecordedMinute(a: number, b: number) {
  return Math.floor(a / MINUTE_MS) === Math.floor(b / MINUTE_MS);
}

/** Built-in case maps real fixed instants back to the same local billing/chart
 * clock. These fixture instants were originally entered as UTC seconds = 00. */
export function centralMinuteFromInstant(ms: number) {
  const wall = wallSecond(ms);
  return { date: wall.slice(0,10), time: wall.slice(11,16) };
}
