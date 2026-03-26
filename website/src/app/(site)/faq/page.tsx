import Link from "next/link";
import CTA from "@/components/CTA";

const FAQ_ITEMS = [
  {
    q: "What is AUC-guided vancomycin dosing?",
    short: "Exposure-based interpretation instead of relying only on troughs.",
    a: "AUC-guided vancomycin dosing focuses on estimated drug exposure over time rather than relying only on trough levels. The goal is to support exposure-based interpretation in a more clinically meaningful way.",
  },
  {
    q: "Why might two vancomycin calculators disagree?",
    short: "Different models, assumptions, level timing rules, and scope limits.",
    a: "Calculators may differ because they use different PK models, assumptions, level-timing handling, and scope rules. Differences become more noticeable when data are sparse, timing is imperfect, or the workflow falls outside routine steady-state assumptions.",
  },
  {
    q: "When is a one-level estimate less reliable?",
    short: "When timing is weak, dose history is unclear, or the fit is sparse.",
    a: "Single-level estimates can be more uncertain than coherent multi-level fits, especially when sample timing is close to infusion completion, dose history is unclear, or renal function is changing. Sparse data should be reviewed more cautiously, not overinterpreted.",
  },
  {
    q: "What level timing problems make a result unsafe to overinterpret?",
    short: "During infusion, too soon after infusion, or across unclear chronology.",
    a: "Levels drawn during infusion, immediately after infusion, across unclear dose history, or with missing chronology can make a steady-state result unsafe to overread. In those cases, confirm actual dose times and consider repeat sampling or a different workflow.",
  },
  {
    q: "What patient types are outside scope?",
    short: "Pediatric, dialysis-specific, and continuous-infusion workflows are outside the current scope.",
    a: "The current calculator is scoped to adult intermittent-infusion vancomycin workflows. It is not intended for pediatric, dialysis-specific, or continuous-infusion use unless explicitly stated.",
  },
  {
    q: "What should clinicians verify before changing a regimen?",
    short: "Inputs, method, level timing, assumptions, limitations, and local protocol.",
    a: "Verify the inputs used, the method applied, the timing and sufficiency of measured levels, assumptions affecting the estimate, uncertainty or limitation notes, and local protocol or institutional practice.",
  },
  {
    q: "Does Vancomyzer™ replace local protocol, pharmacist review, or clinician judgment?",
    short: "No. It supports structured review but does not replace professional oversight.",
    a: "No. Vancomyzer™ is designed to support structured review of model outputs and assumptions. Final interpretation and treatment decisions still require clinician judgment, pharmacist oversight, and local policy alignment.",
  },
  {
    q: "Can documentation drafts improve workflow?",
    short: "Yes—if they are reviewed and edited before communication or record use.",
    a: "Documentation-support drafts can help communication and review by making the model output, assumptions, and cautions easier to inspect and edit. They should still be reviewed before use in clinical communication or the medical record.",
  },
];

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Frequently asked questions
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Condensed answers for quick clinical scanning. Expand each item for fuller nuance on timing quality, scope, calculator disagreement, and safe interpretation.
        </p>
      </section>

      <section className="mb-16 space-y-3">
        {FAQ_ITEMS.map(({ q, short, a }) => {
          const id =
            q === "When is a one-level estimate less reliable?"
              ? "one-level-reliability"
              : q === "What should clinicians verify before changing a regimen?"
                ? "verify-before-change"
                : q === "Does Vancomyzer™ replace local protocol, pharmacist review, or clinician judgment?"
                  ? "replace-judgment"
                  : undefined;

          return (
            <details
              key={q}
              id={id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{q}</h2>
                    <p className="mt-1 text-sm text-slate-600">{short}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-500">Expand</span>
                </div>
              </summary>
              <p className="mt-4 text-sm leading-6 text-slate-600">{a}</p>
            </details>
          );
        })}
      </section>

      <section className="mb-16 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">See the workflow in context</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The calculator surfaces prior-only, caution-limited, or more reviewable states before clinicians lean on the dose suggestion.
            </p>
          </div>
          <Link href="/calculator" className="text-sm font-medium text-slate-900 underline hover:no-underline">
            Go to the calculator
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <CTA variant="sampleCase" primary />
          <CTA variant="documentationSummary" />
        </div>
      </section>

      <section className="mb-16 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">Need the trust and evidence view?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          If you want the inspectability and uncertainty framing behind these answers, continue to the Trust &amp; Evidence page.
        </p>
        <div className="mt-4">
          <CTA variant="trustEvidence" />
        </div>
      </section>

      <section className="border-t border-slate-200 pt-10">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/calculator"
            className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Open the calculator
          </Link>
          <CTA variant="sampleCase" />
          <CTA variant="trustEvidence" />
          <CTA variant="requestEvaluation" />
        </div>
      </section>
    </div>
  );
}
