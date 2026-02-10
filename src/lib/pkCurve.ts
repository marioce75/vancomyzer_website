import { formatNumber } from "@/lib/format";

export type CurvePoint = { t_hr: number; conc_mg_l: number };
export type RegimenForCurve = { intervalHr: number; infusionHr: number };

type MarkerPoint = CurvePoint & { kind: "peak" | "trough" };

function sortCurve(curve: CurvePoint[]): CurvePoint[] {
  return [...curve].sort((a, b) => a.t_hr - b.t_hr);
}

export function interpolateAtTime(curve: CurvePoint[], t: number): number {
  const sorted = sortCurve(curve);
  if (sorted.length === 0) return 0;
  if (t <= sorted[0].t_hr) return sorted[0].conc_mg_l;
  if (t >= sorted[sorted.length - 1].t_hr) return sorted[sorted.length - 1].conc_mg_l;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.t_hr && t <= b.t_hr) {
      const span = b.t_hr - a.t_hr;
      if (span <= 0) return a.conc_mg_l;
      const ratio = (t - a.t_hr) / span;
      return a.conc_mg_l + ratio * (b.conc_mg_l - a.conc_mg_l);
    }
  }
  return sorted[sorted.length - 1].conc_mg_l;
}

export function derivePeakTroughFromCurve(curve: CurvePoint[], regimen: RegimenForCurve) {
  const sorted = sortCurve(curve);
  if (sorted.length === 0) {
    return { peak: 0, trough: 0, peakTime: 0, troughTime: 0 };
  }
  const maxTime = sorted[sorted.length - 1].t_hr;
  const interval = Math.max(0.1, regimen.intervalHr);
  const infusion = Math.max(0, regimen.infusionHr);
  const eps = 1e-6;

  let peakTime = infusion;
  let troughTime = interval - eps;

  const nMax = Math.max(1, Math.floor(maxTime / interval));
  peakTime = Math.min(maxTime, (nMax - 1) * interval + infusion);
  troughTime = Math.min(maxTime, nMax * interval - eps);

  const peak = interpolateAtTime(sorted, peakTime);
  const trough = interpolateAtTime(sorted, troughTime);

  return { peak, trough, peakTime, troughTime };
}

export function buildMarkerPoints(curve: CurvePoint[], regimen: RegimenForCurve): MarkerPoint[] {
  const sorted = sortCurve(curve);
  if (sorted.length === 0) return [];
  const maxTime = sorted[sorted.length - 1].t_hr;
  const interval = Math.max(0.1, regimen.intervalHr);
  const infusion = Math.max(0, regimen.infusionHr);
  const eps = 1e-6;

  const markers: MarkerPoint[] = [];
  const nMax = Math.max(1, Math.floor(maxTime / interval));
  for (let n = 1; n <= nMax; n += 1) {
    const peakTime = Math.min(maxTime, (n - 1) * interval + infusion);
    const troughTime = Math.min(maxTime, n * interval - eps);
    markers.push({ t_hr: peakTime, conc_mg_l: interpolateAtTime(sorted, peakTime), kind: "peak" });
    markers.push({ t_hr: troughTime, conc_mg_l: interpolateAtTime(sorted, troughTime), kind: "trough" });
  }
  return markers;
}

export function mergeCurveWithMarkers(curve: CurvePoint[], markers: MarkerPoint[]): CurvePoint[] {
  const all = [...curve, ...markers];
  const unique = new Map<number, CurvePoint>();
  for (const point of all) {
    unique.set(point.t_hr, { t_hr: point.t_hr, conc_mg_l: point.conc_mg_l });
  }
  return sortCurve(Array.from(unique.values()));
}

export function findNearestMarker(markers: MarkerPoint[], time: number, toleranceHr = 0.05): MarkerPoint | null {
  let closest: MarkerPoint | null = null;
  for (const marker of markers) {
    const delta = Math.abs(marker.t_hr - time);
    if (delta <= toleranceHr && (!closest || delta < Math.abs(closest.t_hr - time))) {
      closest = marker;
    }
  }
  return closest;
}

export function formatConcentration(value: number, decimals = 1): string {
  return formatNumber(value, decimals);
}

