"use client";

import type { CalculationDetails } from "@/types/calculator";

interface DataFitReviewabilityPanelProps {
  details?: CalculationDetails | null;
}

function toneFor(level: CalculationDetails["review_status"]["level"]) {
  if (level === "caution") {
    return "border-amber-300 bg-amber-50 text-amber-950";
  }
  if (level === "supported") {
    return "border-emerald-300 bg-emerald-50 text-emerald-950";
  }
  return "border-blue-300 bg-blue-50 text-blue-950";
}

export default function DataFitReviewabilityPanel({ details }: DataFitReviewabilityPanelProps) {
  if (!details) return null;

  return (
    <section className={`rounded-md border px-3 py-2 ${toneFor(details.review_status.level)}`}>
      <div className="grid gap-2 md:grid-cols-[1.1fr_0.9fr] md:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">Review status</p>
          <p className="mt-1 text-sm font-semibold">{details.review_status.banner_title}</p>
          <p className="mt-1 text-sm">{details.review_status.banner_body}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">Verify before acting</p>
          <ul className="mt-1 space-y-1 text-sm">
            {details.review_status.next_actions.slice(0, 3).map((item, index) => (
              <li key={index}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
