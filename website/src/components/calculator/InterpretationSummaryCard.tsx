"use client";
import { LocalizedText, LocalizedGeneratedText } from "@/localization/LanguageProvider";


interface InterpretationSummaryCardProps {
  interpretation_summary?: string | null;
}

export default function InterpretationSummaryCard({
  interpretation_summary,
}: InterpretationSummaryCardProps) {
  return (
    <section>
      <h2 className="vz-kicker m-0 mb-1"><LocalizedText text="Why this result" /></h2>
      <div className="text-slate-700">
        {interpretation_summary != null && interpretation_summary !== "" ? (
          <p className="text-xs leading-5"><LocalizedGeneratedText text={interpretation_summary} /></p>
        ) : (
          <p className="text-xs text-slate-500"><LocalizedText text="Run a calculation to see the interpretation summary." /></p>
        )}
      </div>
    </section>
  );
}
