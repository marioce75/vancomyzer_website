import React from "react";

interface PrimaryMetricsCardProps {
  auc24?: number | null;
  peak?: number | null;
  trough?: number | null;
}

function formatMetric(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

const Metric = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">{value}</span>
        <span className="text-sm font-medium text-slate-500">{unit}</span>
      </div>
    </div>
  );

export default function PrimaryMetricsCard({ auc24, peak, trough }: PrimaryMetricsCardProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Metric label="AUC24" value={formatMetric(auc24)} unit="mg·h/L" />
      <Metric label="Peak" value={formatMetric(peak)} unit="mcg/mL" />
      <Metric label="Trough" value={formatMetric(trough)} unit="mcg/mL" />
    </div>
  );
}
