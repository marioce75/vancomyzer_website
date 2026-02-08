import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
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
  ReferenceLine,
  ReferenceDot,
} from "recharts";

type CurvePoint = { t_hr: number; conc_mg_l: number };

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

export default function ConcentrationTimeChart({
  curve,
  levels,
  band,
  emptyMessage,
}: {
  curve?: Array<{ t_hr: number; conc_mg_l: number }>;
  levels?: Array<{ time_hr: number; concentration_mg_l: number }>;
  band?: { lower: Array<{ t_hr: number; conc_mg_l: number }>; upper: Array<{ t_hr: number; conc_mg_l: number }> } | null;
  emptyMessage?: string;
}) {
  const base = useMemo(() => densifyCurve(curve || []), [curve]);
  const bandUpper = useMemo(() => densifyCurve(band?.upper ?? []), [band]);
  const bandLower = useMemo(() => densifyCurve(band?.lower ?? []), [band]);
  const aucArea = useMemo(() => buildAucArea(base, 24), [base]);

  const levelPoints = useMemo(
    () => (levels || []).map((l) => ({ t_hr: l.time_hr, conc_mg_l: l.concentration_mg_l })),
    [levels],
  );
  const maxTime = useMemo(() => Math.max(48, ...base.map((p) => p.t_hr)), [base]);
  const maxConc = useMemo(() => Math.max(10, ...base.map((p) => p.conc_mg_l)), [base]);
  const yMax = useMemo(() => Math.ceil(maxConc * 1.15), [maxConc]);

  const peakPoint = useMemo(() => {
    const within = base.filter((p) => p.t_hr <= 24);
    if (within.length === 0) return null;
    return within.reduce((max, p) => (p.conc_mg_l > max.conc_mg_l ? p : max), within[0]);
  }, [base]);
  const troughPoint = useMemo(() => {
    if (base.length === 0) return null;
    return base.reduce((closest, p) =>
      Math.abs(p.t_hr - 24) < Math.abs(closest.t_hr - 24) ? p : closest,
    );
  }, [base]);

  if (base.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Concentration-Time (0-48h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {emptyMessage ?? "Provide regimen inputs to generate a concentration-time curve."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Concentration-Time (0-48h)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={base} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="t_hr"
              type="number"
              domain={[0, maxTime]}
              tickCount={7}
              tickFormatter={(v) => `${v}h`}
              label={{ value: "Time (hr)", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              domain={[0, yMax]}
              tickCount={6}
              tickFormatter={(v) => `${formatNumber(Number(v), 1)}`}
              label={{ value: "Concentration (mg/L)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const conc = payload.find((p) => p.dataKey === "conc_mg_l")?.value;
                return (
                  <div className="rounded border bg-background px-2 py-1 text-xs shadow">
                    <div>Time: {formatNumber(Number(label), 2)} hr</div>
                    <div>Concentration: {formatNumber(Number(conc ?? 0), 2)} mg/L</div>
                  </div>
                );
              }}
            />

            {aucArea.length > 0 && (
              <Area
                type="linear"
                data={aucArea}
                dataKey="conc_mg_l"
                stroke="none"
                fill="#93c5fd"
                fillOpacity={0.35}
              />
            )}
            <ReferenceLine x={24} stroke="#94a3b8" strokeDasharray="3 3" />

            {bandUpper.length > 0 && bandLower.length > 0 && (
              <>
                <Line type="linear" data={bandUpper} dataKey="conc_mg_l" stroke="#93c5fd" dot={false} />
                <Line type="linear" data={bandLower} dataKey="conc_mg_l" stroke="#93c5fd" dot={false} />
              </>
            )}

            <Line type="linear" dataKey="conc_mg_l" stroke="#2563eb" dot={false} />

            {peakPoint && (
              <ReferenceDot x={peakPoint.t_hr} y={peakPoint.conc_mg_l} r={4} fill="#2563eb" stroke="none" />
            )}
            {troughPoint && (
              <ReferenceDot x={troughPoint.t_hr} y={troughPoint.conc_mg_l} r={4} fill="#0f172a" stroke="none" />
            )}

            {levelPoints.length > 0 && (
              <Scatter data={levelPoints} fill="#ef4444" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
