"use client";

interface InterpretationSummaryCardProps {
  interpretation_summary?: string | null;
}

export default function InterpretationSummaryCard({
  interpretation_summary,
}: InterpretationSummaryCardProps) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Why this result</h2>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
        {interpretation_summary != null && interpretation_summary !== "" ? (
          <p className="text-sm leading-6">{interpretation_summary}</p>
        ) : (
          <p className="text-sm text-slate-500">
            Run a calculation to see the interpretation summary.
          </p>
        )}
      </div>
    </section>
  );
}
