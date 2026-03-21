"use client";

import type { CalculationDetails } from "@/types/calculator";

interface ClinicalSignalStripProps {
  auc24?: number | null;
  trough?: number | null;
  details?: CalculationDetails | null;
}

function tone(details?: CalculationDetails | null, auc24?: number | null) {
  if (auc24 && auc24 > 600) return "border-red-200 bg-red-50 text-red-950";
  const level = details?.review_status.level;
  if (level === "supported") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (level === "caution") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-blue-200 bg-blue-50 text-blue-950";
}

export default function ClinicalSignalStrip({ auc24, trough, details }: ClinicalSignalStripProps) {
  if (!details) return null;

  return (
    <section className={`rounded-xl border p-3 shadow-sm ${tone(details, auc24)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{details.review_status.banner_title}</h2>
          <p className="mt-1 text-sm">{details.review_status.banner_body}</p>
          {(auc24 && auc24 > 600) ? (
            <p className="mt-2 text-sm font-bold text-red-700">Warning: Predicted AUC &gt; 600. Potential for elevated nephrotoxicity risk. Proceed with extreme caution.</p>
          ) : null}
        </div>
        <span className="text-xs font-medium">{details.evidence_strength}</span>
      </div>
    </section>
  );
}
