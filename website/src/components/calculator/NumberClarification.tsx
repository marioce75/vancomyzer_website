"use client";
import { useLanguage } from "@/localization/LanguageProvider";
import { clinicalNumberChoices, type NumberInterpretation } from "@/lib/parseClinicalNumber";

/** Neither option is selected until the user resolves a raw ambiguous entry. */
export default function NumberClarification({ raw, interpretation, onChoose }: {
  raw: string; interpretation?: NumberInterpretation;
  onChoose: (choice: NumberInterpretation) => void;
}) {
  const { t, locale } = useLanguage();
  const choices = clinicalNumberChoices(raw);
  if (!choices) return null;
  const display = (n: number) => locale === "en" ? String(n) : String(n).replace(".", ",");
  return <span className="mt-2 block text-xs" role="group" aria-label={t("Clarify this number")}>
    <span className="mb-1 block">{t(interpretation ? "Confirmed value" : "Choose the intended value")}</span>
    <span className="flex flex-wrap gap-2">
      {(["decimal", "whole"] as const).map(choice => <button key={choice} type="button"
        data-number-choice={choice} aria-pressed={interpretation === choice}
        className="rounded border border-slate-400 bg-white px-2 py-1 text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => onChoose(choice)}>
        {t(choice === "decimal" ? "Decimal value" : "Whole-number value")}: {display(choices[choice])}
      </button>)}
    </span>
  </span>;
}
