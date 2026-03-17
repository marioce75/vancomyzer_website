"use client";

interface PrimaryMetricsCardProps {
  auc24?: number | null;
  peak?: number | null;
  trough?: number | null;
}

function formatMetric(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return String(value);
}

export default function PrimaryMetricsCard({
  auc24,
  peak,
  trough,
}: PrimaryMetricsCardProps) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">Primary metrics</h2>
      <dl className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <dt className="text-sm text-gray-500">AUC24</dt>
          <dd className="mt-0.5 text-lg font-medium text-gray-900">
            {formatMetric(auc24)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Peak (mcg/mL)</dt>
          <dd className="mt-0.5 text-lg font-medium text-gray-900">
            {formatMetric(peak)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Trough (mcg/mL)</dt>
          <dd className="mt-0.5 text-lg font-medium text-gray-900">
            {formatMetric(trough)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
