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
    <section className="mt-3 border-t pt-2" style={{ borderTopColor: "var(--color-border)" }}>
      <h2 className="vz-kicker m-0 mb-1">Limitations</h2>
      <div>
        {list.length > 0 ? (
          <>
            {featuredLimitation && (
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                <p className="text-xs font-semibold text-amber-950">Review-critical limitation</p>
                <p className="mt-0.5 text-xs text-amber-900">{featuredLimitation}</p>
              </div>
            )}
            {remaining.length > 0 && (
              <ul className="list-disc space-y-1 pl-4 text-xs text-gray-700">
                {remaining.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-500">
            Run a calculation to see limitations and caution notes.
          </p>
        )}
      </div>
    </section>
  );
}
