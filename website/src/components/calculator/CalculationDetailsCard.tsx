"use client";

import type { CalculationDetails } from "@/types/calculator";

interface CalculationDetailsCardProps {
  details?: CalculationDetails | null;
}

function evidenceTone(level: CalculationDetails["review_status"]["level"]): string {
  if (level === "caution") {
    return "bg-amber-100 text-amber-900 border border-amber-200";
  }
  if (level === "supported") {
    return "bg-emerald-100 text-emerald-900 border border-emerald-200";
  }
  return "bg-blue-100 text-blue-900 border border-blue-200";
}

export default function CalculationDetailsCard({
  details,
}: CalculationDetailsCardProps) {
  if (!details) return null;

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Calculation details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Core method and evidence summary first. Expanded detail stays compact.
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${evidenceTone(
            details.review_status.level
          )}`}
        >
          Evidence: {details.evidence_strength}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-gray-900">Method used</p>
          <p className="mt-1 text-sm text-gray-700">{details.method}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Workflow fit / data quality</p>
          <p className="mt-1 text-sm text-gray-700">{details.data_quality_summary}</p>
        </div>
      </div>

      <details className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-900">
          Expand rationale, cautions, and key inputs
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
            <p className="text-sm font-medium text-amber-950">Why caution may still apply</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {details.caution_flags.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 sm:col-span-2">
            <p className="text-sm font-medium text-blue-950">Recommended next review steps</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-blue-900">
              {details.review_status.next_actions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-gray-900">Key inputs</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {details.key_inputs.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}
