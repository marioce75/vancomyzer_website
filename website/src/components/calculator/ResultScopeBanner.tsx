"use client";

interface ResultScopeBannerProps {
  recommendation_type?: "initial_regimen" | "existing_regimen" | null;
}

export default function ResultScopeBanner({
  recommendation_type,
}: ResultScopeBannerProps) {
  const isInitial = recommendation_type === "initial_regimen";

  return (
    <section className="border-l-4 border-amber-500 bg-amber-50 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-950">Safety guardrails</h2>
          <ul className="mt-1 space-y-1 text-xs text-amber-900">
            <li>Adult intermittent IV workflow only.</li>
            <li>Not for pediatrics, dialysis-specific, or continuous infusion.</li>
            {isInitial ? (
              <li>Prior-only maintenance support; not patient-specific severity direction.</li>
            ) : (
              <li>Requires interpretable same-interval timing and routine dose history.</li>
            )}
          </ul>
        </div>
        <a href="/references" className="text-xs font-medium text-amber-950 underline hover:no-underline">
          Evidence
        </a>
      </div>
    </section>
  );
}
