/**
 * Explicit time-zone resolution: DST gaps and folds, offsets, zone independence.
 * Run: node --import tsx src/lib/pediatric/__tests__/localTime.test.ts
 * The file re-runs itself under several process time zones (TZ) so the results
 * cannot depend on the server's local zone.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { formatOffset, formatWithOffset, isValidZone, offsetAt, parseWallClock, resolveLocal, resolveLocalWithChoice, zoneChoices } from "../localTime";
import { parseStrictTimestamp } from "../engine";

let n = 0;
const ok = (c: unknown, m: string) => { assert.ok(c, `[TZ=${process.env.TZ ?? "unset"}] ${m}`); n++; };
const w = (s: string) => { const p = parseWallClock(s); assert.ok(p, s); return p; };

// New York spring-forward gap, 2026-03-08 02:00 → 03:00
{
  const r = resolveLocal(w("2026-03-08T02:30"), "America/New_York");
  ok(r.kind === "gap" && /does not exist in America\/New_York/.test(r.message) && /-05:00 → -04:00/.test(r.message), `02:30 on 2026-03-08 is a gap: ${JSON.stringify(r)}`);
  if (r.kind === "gap") ok(r.before.iso === "2026-03-08T01:30:00-05:00" && r.after.iso === "2026-03-08T03:30:00-04:00", `gap neighbours ${r.before.iso} / ${r.after.iso}`);
  const b = resolveLocal(w("2026-03-08T01:59"), "America/New_York");
  ok(b.kind === "ok" && b.instant.iso === "2026-03-08T01:59:00-05:00", "01:59 before the gap resolves to EST");
  const a = resolveLocal(w("2026-03-08T03:00"), "America/New_York");
  ok(a.kind === "ok" && a.instant.iso === "2026-03-08T03:00:00-04:00", "03:00 after the gap resolves to EDT");
}
// New York fall-back fold, 2026-11-01 01:00-02:00 occurs twice
{
  const r = resolveLocal(w("2026-11-01T01:30"), "America/New_York");
  ok(r.kind === "fold" && r.options.length === 2 && r.options[0].iso === "2026-11-01T01:30:00-04:00" && r.options[1].iso === "2026-11-01T01:30:00-05:00", `01:30 on 2026-11-01 is a fold: ${JSON.stringify(r)}`);
  if (r.kind === "fold") ok(r.options[1].ms - r.options[0].ms === 3600000, "the two occurrences are one hour apart");
  const first = resolveLocalWithChoice(w("2026-11-01T01:30"), "America/New_York", -240);
  const second = resolveLocalWithChoice(w("2026-11-01T01:30"), "America/New_York", -300);
  ok(first.kind === "ok" && first.instant.iso === "2026-11-01T01:30:00-04:00" && new Date(first.instant.ms).toISOString() === "2026-11-01T05:30:00.000Z", "choice -04:00 → 05:30Z");
  ok(second.kind === "ok" && second.instant.iso === "2026-11-01T01:30:00-05:00" && new Date(second.instant.ms).toISOString() === "2026-11-01T06:30:00.000Z", "choice -05:00 → 06:30Z");
  ok(resolveLocalWithChoice(w("2026-11-01T01:30"), "America/New_York", -180).kind === "invalid", "an offset that is not an occurrence is rejected");
  ok(resolveLocalWithChoice(w("2026-11-01T01:30"), "America/New_York", null).kind === "fold", "no choice leaves the fold unresolved");
  ok(resolveLocal(w("2026-11-01T00:59"), "America/New_York").kind === "ok" && resolveLocal(w("2026-11-01T02:00"), "America/New_York").kind === "ok", "times outside the fold hour are unique");
  // The API accepts the chosen ISO strings and preserves the instants exactly.
  for (const o of (r as { options: { iso: string; ms: number }[] }).options) { const p = parseStrictTimestamp(o.iso); ok(p.ok && p.ms === o.ms, `API round trip ${o.iso}`); }
}
// Other zones and fixed offsets; the Southern-hemisphere transition direction
{
  ok(resolveLocal(w("2026-07-01T12:00"), "Europe/Brussels").kind === "ok" && (resolveLocal(w("2026-07-01T12:00"), "Europe/Brussels") as { instant: { iso: string } }).instant.iso === "2026-07-01T12:00:00+02:00", "Brussels summer +02:00");
  ok((resolveLocal(w("2026-01-15T12:00"), "Europe/Brussels") as { instant: { iso: string } }).instant.iso === "2026-01-15T12:00:00+01:00", "Brussels winter +01:00");
  ok((resolveLocal(w("2026-10-29T08:00"), "Asia/Tokyo") as { instant: { iso: string } }).instant.iso === "2026-10-29T08:00:00+09:00", "Tokyo has no DST");
  ok((resolveLocal(w("2026-10-29T08:00"), "Asia/Kolkata") as { instant: { iso: string } }).instant.iso === "2026-10-29T08:00:00+05:30", "half-hour offset");
  ok((resolveLocal(w("2026-10-29T08:00"), "UTC") as { instant: { iso: string } }).instant.iso === "2026-10-29T08:00:00+00:00", "UTC");
  ok((resolveLocal(w("2026-10-29T08:00"), "-05:00") as { instant: { iso: string } }).instant.iso === "2026-10-29T08:00:00-05:00", "fixed offset -05:00");
  ok(resolveLocal(w("2026-03-08T02:30"), "-05:00").kind === "ok", "a fixed offset has no gaps");
  ok(resolveLocal(w("2026-10-04T02:30"), "Australia/Sydney").kind === "gap", "Sydney spring-forward 2026-10-04 02:30 is a gap");
  ok(resolveLocal(w("2026-04-05T02:30"), "Australia/Sydney").kind === "fold", "Sydney fall-back 2026-04-05 02:30 is a fold");
  ok(resolveLocal(w("2026-10-29T08:00"), "Mars/Olympus").kind === "invalid" && !isValidZone("Mars/Olympus") && isValidZone("Europe/Paris") && isValidZone("+14:00") && !isValidZone("+15:00"), "zone validation");
  ok(parseWallClock("2026-02-30T08:00") === null && parseWallClock("2026-02-10T24:00") === null && parseWallClock("2024-02-29T08:00") !== null, "wall-clock calendar checks");
  ok(formatOffset(-240) === "-04:00" && formatOffset(330) === "+05:30" && formatOffset(0) === "+00:00", "offset formatting");
  ok(formatWithOffset({ year: 2026, month: 3, day: 8, hour: 1, minute: 59 }, -300) === "2026-03-08T01:59:00-05:00", "wall-clock formatting");
  ok(offsetAt("America/New_York", Date.UTC(2026, 6, 1)) === -240 && offsetAt("America/New_York", Date.UTC(2026, 0, 1)) === -300, "offsetAt");
  ok(zoneChoices().includes("America/New_York") && zoneChoices().includes("UTC") && zoneChoices().includes("+05:30"), "zone choices");
}
console.log(`${n} local-time checks passed under TZ=${process.env.TZ ?? "unset"}.`);

// Re-run under other process zones unless this is already a child run.
if (!process.env.PED_TZ_CHILD) {
  for (const tz of ["UTC", "America/New_York", "Asia/Tokyo", "Pacific/Kiritimati", "America/St_Johns"]) {
    const out = execFileSync(process.execPath, ["--import", "tsx", __filename], { env: { ...process.env, TZ: tz, PED_TZ_CHILD: "1" }, encoding: "utf8" });
    process.stdout.write(out);
  }
  console.log("Local-time resolution verified independently of the process time zone (5 zones).");
}
