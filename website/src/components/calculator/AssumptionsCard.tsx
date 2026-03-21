"use client";

import type { CalculationDetails } from "@/types/calculator";

interface AssumptionsCardProps {
  assumptions?: string[] | null;
  calculationDetails?: CalculationDetails | null;
}

function assumptionsNote(details?: CalculationDetails | null): {
  className: string;
  text: string;
} | null {
  if (!details) return null;

  if (details.review_status.level === "prior_only") {
    return {
      className: "border-blue-200 bg-blue-50 text-blue-900",
      text: "Assumptions carry more weight here because measured-level refinement is absent or minimal.",
    };
  }

  if (details.review_status.level === "caution") {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-900",
      text: "Assumptions deserve extra review because workflow fit or data quality is limited.",
    };
  }

  return {
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    text: "Assumptions still matter, but the workflow fit is more reviewable for this result.",
  };
}

export default function AssumptionsCard({
  assumptions,
  calculationDetails,
}: AssumptionsCardProps) {
  const list = assumptions?.filter(Boolean) ?? [];
  const note = assumptionsNote(calculationDetails);
  const [first, ...rest] = list;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Assumptions</h2>
      {note && <div className={`mt-3 rounded-xl border p-3 text-sm ${note.className}`}>{note.text}</div>}
      <div className="mt-4">
        {list.length > 0 ? (
          <>
            {first && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Most important assumption</p>
                <p className="mt-2 text-sm text-slate-700">{first}</p>
              </div>
            )}
            {rest.length > 0 && (
              <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-900">
                  Show all assumptions
                </summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {rest.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">Run a calculation to see assumptions.</p>
        )}
      </div>
    </section>
  );
}
