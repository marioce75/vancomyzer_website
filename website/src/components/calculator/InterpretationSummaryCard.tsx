"use client";

interface InterpretationSummaryCardProps {
  interpretation_summary?: string | null;
}

export default function InterpretationSummaryCard({
  interpretation_summary,
}: InterpretationSummaryCardProps) {
  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Interpretation summary
      </h2>
      <div className="mt-4 text-gray-700">
        {interpretation_summary != null && interpretation_summary !== "" ? (
          <p className="text-sm">{interpretation_summary}</p>
        ) : (
          <p className="text-sm text-gray-500">
            Run a calculation to see interpretation.
          </p>
        )}
      </div>
    </section>
  );
}
