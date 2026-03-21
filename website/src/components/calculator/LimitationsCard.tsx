"use client";

import type { CalculationDetails } from "@/types/calculator";

interface LimitationsCardProps {
  limitations?: string[] | null;
  calculationDetails?: CalculationDetails | null;
}

export default function LimitationsCard({
  limitations,
  calculationDetails,
}: LimitationsCardProps) {
  const list = limitations?.filter(Boolean) ?? [];
  const cautionState = calculationDetails?.review_status.level === "caution";
  const featuredLimitation = cautionState && list.length > 0 ? list[0] : null;
  const remaining = featuredLimitation ? list.slice(1) : list;

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">Limitations</h2>
      <div className="mt-4">
        {list.length > 0 ? (
          <>
            {featuredLimitation && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-950">Review-critical limitation</p>
                <p className="mt-1 text-sm text-amber-900">{featuredLimitation}</p>
              </div>
            )}
            {remaining.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {remaining.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">
            Run a calculation to see limitations and caution notes.
          </p>
        )}
      </div>
    </section>
  );
}
