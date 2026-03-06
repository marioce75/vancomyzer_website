import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import {
  buildMarkerPoints,
  derivePeakTroughFromCurve,
  findNearestMarker,
  formatConcentration,
  mergeCurveWithMarkers,
  type CurvePoint,
  type RegimenForCurve,
} from "@/lib/pkCurve";
import {
  Area,
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Scatter,
  ReferenceDot,
} from "recharts";
import { useVancomyzerStore } from "@/store/vancomyzerStore";

function densifyCurve(curve: CurvePoint[], stepHr = 0.1): CurvePoint[] {
  if (curve.length < 2) return curve;
  const sorted = [...curve].sort((a, b) => a.t_hr - b.t_hr);
  const dense: CurvePoint[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    dense.push(a);
    const span = b.t_hr - a.t_hr;
    if (span <= stepHr) continue;
    const steps = Math.floor(span / stepHr);
    for (let s = 1; s < steps; s += 1) {
      const t = a.t_hr + s * stepHr;
      const ratio = (t - a.t_hr) / (b.t_hr - a.t_hr);
      const conc = a.conc_mg_l + ratio * (b.conc_mg_l - a.conc_mg_l);
      dense.push({ t_hr: t, conc_mg_l: conc });
    }
  }
  dense.push(sorted[sorted.length - 1]);
  return dense;
}

function buildAucArea(curve: CurvePoint[], maxHr = 24): CurvePoint[] {
  if (curve.length === 0) return [];
  const sorted = [...curve].sort((a, b) => a.t_hr - b.t_hr);
  const area: CurvePoint[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const point = sorted[i];
    if (point.t_hr <= maxHr) {
      area.push(point);
    } else {
      const prev = sorted[i - 1];
      if (prev && prev.t_hr < maxHr) {
        const ratio = (maxHr - prev.t_hr) / (point.t_hr - prev.t_hr);
        const conc = prev.conc_mg_l + ratio * (point.conc_mg_l - prev.conc_mg_l);
        area.push({ t_hr: maxHr, conc_mg_l: conc });
      }
      break;
    }
  }
  return area;
}

const X_MAX = 24;

export default function PKGraph() {
  const { result, dosing, mode, serumLevels } = useVancomyzerStore();

  const curve = useMemo(() => {
    if (!result) return [];
    if ("curve" in result && Array.isArray(result.curve))
      return result.curve.map((p) => ({ t_hr: p.t_hr, conc_mg_l: p.conc_mg_l }));
    return [];
  }, [result]);

  const regimen: RegimenForCurve | null = useMemo(() => {
    if (mode === "bayesian" && result && "recommendation" in result)
      return {
        intervalHr: result.recommendation.interval_hr,
        infusionHr: result.infusion_hr ?? dosing.infusionHr,
      };
    return { intervalHr: dosing.intervalHr, infusionHr: dosing.infusionHr };
  }, [mode, result, dosing]);

  const band = useMemo(() => {
    if (mode === "bayesian" && result && "curve_ci_low" in result && result.curve_ci_low && result.curve_ci_high)
      return { lower: result.curve_ci_low, upper: result.curve_ci_high };
    return null;
  }, [mode, result]);

  const markerPoints = useMemo(
    () => (regimen && curve.length > 0 ? buildMarkerPoints(curve, regimen) : []),
    [curve, regimen]
  );
  const mergedCurve = useMemo(
    () => (markerPoints.length > 0 && curve.length > 0 ? mergeCurveWithMarkers(curve, markerPoints) : curve),
    [curve, markerPoints]
  );
  const base = useMemo(() => densifyCurve(mergedCurve).filter((p) => p.t_hr <= X_MAX), [mergedCurve]);
  const bandUpper = useMemo(
    () => densifyCurve(band?.upper ?? []).filter((p) => p.t_hr <= X_MAX),
    [band]
  );
  const bandLower = useMemo(
    () => densifyCurve(band?.lower ?? []).filter((p) => p.t_hr <= X_MAX),
    [band]
  );
  const aucArea = useMemo(() => buildAucArea(base, X_MAX), [base]);

  const levelPoints = useMemo(
    () =>
      serumLevels
        .map((r) => {
          const t = parseFloat(r.timeHours);
          const c = parseFloat(r.concentration);
          return Number.isFinite(t) && Number.isFinite(c) && t <= X_MAX ? { t_hr: t, conc_mg_l: c } : null;
        })
        .filter(Boolean) as { t_hr: number; conc_mg_l: number }[],
    [serumLevels]
  );

  const maxConc = useMemo(() => Math.max(10, ...base.map((p) => p.conc_mg_l)), [base]);
  const yMax = useMemo(() => Math.ceil(maxConc * 1.15), [maxConc]);
  const hasCurve = base.length > 0;

  const derived = useMemo(() => {
    if (!regimen || base.length === 0) return null;
    return derivePeakTroughFromCurve(base, regimen);
  }, [base, regimen]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">Concentration–Time (0–24 h)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={hasCurve ? base : [{ t_hr: 0, conc_mg_l: 0 }, { t_hr: X_MAX, conc_mg_l: 0 }]} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="t_hr"
              type="number"
              domain={[0, X_MAX]}
              tickCount={7}
              tickFormatter={(v) => `${v}h`}
              label={{ value: "Time (hr)", position: "insideBottom", offset: -5 }}
              stroke="#6b7280"
            />
            <YAxis
              domain={[0, hasCurve ? yMax : 50]}
              tickCount={6}
              tickFormatter={(v) => formatNumber(Number(v), 1)}
              label={{ value: "Concentration (mg/L)", angle: -90, position: "insideLeft" }}
              stroke="#6b7280"
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const conc = payload.find((p) => p.dataKey === "conc_mg_l")?.value;
                const marker = findNearestMarker(markerPoints, Number(label));
                const displayConc = marker ? marker.conc_mg_l : Number(conc ?? 0);
                const markerLabel = marker ? (marker.kind === "peak" ? "Peak" : "Trough") : null;
                return (
                  <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <div>Time: {formatNumber(Number(label), 2)} hr</div>
                    <div>Concentration: {formatConcentration(displayConc, 2)} mg/L</div>
                    {markerLabel && <div className="text-gray-500">{markerLabel}</div>}
                  </div>
                );
              }}
            />
            {hasCurve && aucArea.length > 0 && (
              <Area
                type="linear"
                data={aucArea}
                dataKey="conc_mg_l"
                stroke="none"
                fill="#93c5fd"
                fillOpacity={0.35}
              />
            )}
            {hasCurve && bandUpper.length > 0 && bandLower.length > 0 && (
              <>
                <Line type="linear" data={bandUpper} dataKey="conc_mg_l" stroke="#93c5fd" dot={false} />
                <Line type="linear" data={bandLower} dataKey="conc_mg_l" stroke="#93c5fd" dot={false} />
              </>
            )}
            {hasCurve && <Line type="linear" dataKey="conc_mg_l" stroke="#2563eb" strokeWidth={2} dot={false} />}
            {derived && (
              <ReferenceDot x={derived.peakTime} y={derived.peak} r={4} fill="#2563eb" stroke="white" strokeWidth={1} />
            )}
            {derived && (
              <ReferenceDot x={derived.troughTime} y={derived.trough} r={4} fill="#0f172a" stroke="white" strokeWidth={1} />
            )}
            {levelPoints.length > 0 && <Scatter data={levelPoints} fill="#dc2626" name="Observed" />}
          </LineChart>
        </ResponsiveContainer>
        {!hasCurve && (
          <p className="text-sm text-muted-foreground text-center">Enter patient data and run a calculation to see the PK curve.</p>
        )}
      </CardContent>
    </Card>
  );
}
