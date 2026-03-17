"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

interface CurvePoint {
  time_hours: number;
  concentration: number;
}

interface ConcentrationTimeGraphProps {
  curve?: CurvePoint[] | null;
  measured_levels?: CurvePoint[] | null;
}

function getDomains(
  curve: CurvePoint[],
  measured_levels: CurvePoint[]
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const all = [...curve, ...measured_levels];
  if (all.length === 0) return { xMin: 0, xMax: 24, yMin: 0, yMax: 30 };
  const x = all.map((p) => p.time_hours);
  const y = all.map((p) => p.concentration);
  const xMin = Math.min(0, ...x);
  const xMax = Math.max(24, ...x);
  const yMin = 0;
  const yMax = Math.max(30, Math.ceil((Math.max(...y) * 1.1) / 5) * 5);
  return { xMin, xMax, yMin, yMax };
}

export default function ConcentrationTimeGraph({
  curve,
  measured_levels,
}: ConcentrationTimeGraphProps) {
  const curveData = curve ?? [];
  const measuredData = measured_levels ?? [];
  const hasCurve = curveData.length > 0;
  const hasMeasured = measuredData.length > 0;
  const hasData = hasCurve || hasMeasured;

  if (!hasData) {
    return (
      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Concentration–time curve
        </h2>
        <div
          className="mt-4 flex min-h-[240px] items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-gray-500"
          aria-label="Graph container for concentration-time curve"
        >
          <p className="text-sm">Run a calculation to see the curve.</p>
        </div>
      </section>
    );
  }

  const { xMin, xMax, yMin, yMax } = getDomains(curveData, measuredData);
  const data = hasCurve ? curveData : measuredData;

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Concentration–time curve
      </h2>
      <div
        className="mt-4 min-h-[240px] w-full"
        aria-label="Concentration-time graph"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time_hours"
              type="number"
              domain={[xMin, xMax]}
              tickFormatter={(v) => `${v} h`}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis
              dataKey="concentration"
              type="number"
              domain={[yMin, yMax]}
              tickFormatter={(v) => `${v}`}
              label={{
                value: "Concentration (mcg/mL)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12 },
              }}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <Tooltip
              formatter={(value) => [
                `${Number(value) ?? 0} mcg/mL`,
                "Concentration",
              ]}
              labelFormatter={(label) => `Time: ${label} h`}
              contentStyle={{
                fontSize: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 6,
              }}
            />
            {hasCurve && (
              <Line
                type="monotone"
                dataKey="concentration"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                name="Model"
                isAnimationActive={false}
              />
            )}
            {!hasCurve && hasMeasured && (
              <Line
                type="monotone"
                dataKey="concentration"
                stroke="transparent"
                dot={{ r: 5, fill: "#dc2626", strokeWidth: 1, stroke: "#fff" }}
                name="Measured"
                isAnimationActive={false}
              />
            )}
            {hasCurve &&
              measuredData.map((p, i) => (
                <ReferenceDot
                  key={i}
                  x={p.time_hours}
                  y={p.concentration}
                  r={5}
                  fill="#dc2626"
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
