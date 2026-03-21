"use client";

import type { CalculatorMode } from "@/types/calculator";

interface PreCalculationGuidanceCardProps {
  mode: CalculatorMode;
}

export default function PreCalculationGuidanceCard({
  mode,
}: PreCalculationGuidanceCardProps) {
  const isInitial = mode === "initial_regimen";

  return (
    <section className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm font-medium text-blue-950">
          {isInitial
            ? "First-pass maintenance workflow. Patient characteristics only."
            : "Use only interpretable current-interval regimen and level timing."}
        </p>
        <details className="text-sm text-blue-900">
          <summary className="cursor-pointer font-medium">More guidance</summary>
          <div className="mt-2 space-y-1 leading-6">
            <p>Not for pediatric, dialysis-specific, or continuous-infusion use.</p>
            <p>
              {isInitial
                ? "Treat as prior-based support rather than high-certainty individualized dosing."
                : "Avoid levels drawn during infusion or immediately after infusion completion."}
            </p>
            <p>Unstable renal function, poor chronology, or sparse/mistimed levels require extra caution.</p>
          </div>
        </details>
      </div>
    </section>
  );
}
