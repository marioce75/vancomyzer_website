import Link from "next/link";
import CTA from "@/components/CTA";

// Locked: CASE-003, clinical note export, trust practical and evidence-aware, assumptions/limitations/review behavior visible
export default function TrustEvidencePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Trust &amp; Evidence
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Trust should come from inspectable output, restrained claims, and clear guardrails—not confidence theater.
        </p>
      </section>

      <section id="what-you-can-inspect" className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">What you can inspect in each result</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The interface keeps the most decision-relevant inspection points visible and pushes supporting detail into compact disclosure.
            </p>
          </div>
          <Link href="/faq" className="text-sm font-medium text-slate-900 underline hover:no-underline">
            FAQ
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            "Inputs used",
            "Method and model applied",
            "Assumptions affecting the estimate",
            "Limitations and caution notes",
            "Recommendation rationale",
            "Workflow-fit guardrails",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section id="what-clinicians-should-review" className="mb-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">What clinicians should review</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-900">Before applying a recommendation</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Patient variables and inputs used</li>
              <li>Model assumptions</li>
              <li>Data sufficiency and uncertainty</li>
              <li>Interpretation context and caution notes</li>
            </ul>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-950">Always keep this explicit</p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              The product supports structured review. It does not replace clinician judgment, pharmacist oversight, or local protocol.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">Evidence-aware communication</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Vancomyzer™ is designed to support review of vancomycin dosing workflow with clearer interpretability. It is not presented here as clinically validated, FDA-cleared, outcome-improving, or superior to other dosing tools.
        </p>
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-900">
            Expand precise claim boundaries
          </summary>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Outputs are model-based decision-support information for clinician review. Caution, local policy alignment, and clinician oversight remain central.
          </p>
        </details>
      </section>

      <section className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-2xl font-semibold text-slate-950">Related next steps</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li>
            <Link href="/calculator" className="font-medium text-slate-900 underline hover:no-underline">
              Go to the calculator
            </Link>{" "}
            to review a scoped case with visible assumptions and workflow-fit details.
          </li>
          <li>
            <Link href="/faq" className="font-medium text-slate-900 underline hover:no-underline">
              Read the FAQ
            </Link>{" "}
            for sparse-data, timing, and calculator-disagreement questions.
          </li>
          <li>
            <Link href="/disclaimer" className="font-medium text-slate-900 underline hover:no-underline">
              Review the Medical Disclaimer
            </Link>{" "}
            for intended-use and scope exclusions.
          </li>
        </ul>
      </section>

      <section className="border-t border-slate-200 pt-10">
        <div className="flex flex-wrap gap-3">
          <CTA variant="contact" />
        </div>
      </section>
    </div>
  );
}
