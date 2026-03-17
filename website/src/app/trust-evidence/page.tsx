import Link from "next/link";
import CTA from "@/components/CTA";

// Locked: CASE-003, clinical note export, trust practical and evidence-aware, assumptions/limitations/review behavior visible
export default function TrustEvidencePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* 1. Page introduction */}
      <section className="mb-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Trust & Evidence
        </h1>
        <p className="mt-4 text-gray-600">
          Transparency and interpretability matter for dosing workflow review.
          This page outlines what Vancomyzer is designed to support and what
          clinicians should review before accepting any recommendation.
        </p>
        <div className="mt-4">
          <CTA variant="sampleCase" />
        </div>
      </section>

      {/* 2. Transparency principles */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Transparency principles
        </h2>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>Visible assumptions</li>
          <li>Visible method and model</li>
          <li>Visible limitations</li>
          <li>Clinician-readable outputs</li>
        </ul>
        <div className="mt-4">
          <Link
            href="/faq"
            className="text-sm font-medium text-gray-900 underline hover:no-underline"
          >
            FAQ
          </Link>
        </div>
      </section>

      {/* 3. What clinicians should review */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          What clinicians should review
        </h2>
        <p className="mt-3 text-gray-600">
          Before accepting a recommendation, clinicians should review:
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-gray-600">
          <li>Patient variables and inputs used</li>
          <li>Model assumptions</li>
          <li>Data sufficiency and uncertainty</li>
          <li>Interpretation context and caution notes</li>
        </ul>
        <p className="mt-4 text-gray-600">
          The product is designed to support structured review, not to replace
          clinician judgment.
        </p>
      </section>

      {/* 4. Example workflow interpretation — CASE-003 */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Example: sparse level data
        </h2>
        <p className="mt-3 text-gray-600">
          When level information is limited, assumptions and uncertainty become
          more important. CASE-003 illustrates how sparse data affects
          confidence and why visible assumptions matter for interpretation.
        </p>
        <div className="mt-4">
          <CTA variant="sampleCase" primary />
        </div>
      </section>

      {/* 5. Documentation-ready communication — clinical note style export */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Documentation-ready communication
        </h2>
        <p className="mt-3 text-gray-600">
          Richer output can support interpretation and communication. A
          clinical-note style export can make recommendations, assumptions, and
          limitations easier to review and share.
        </p>
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-700">
          <p>Patient/scenario: Sparse level data</p>
          <p>Inputs used: Example input summary placeholder</p>
          <p>Method: Bayesian/AUC-guided example method</p>
          <p>Recommendation: Example regimen placeholder</p>
          <p>Why this recommendation was made: Example rationale</p>
          <p>Assumptions / Limitations / Safety notes: Example notes for clinician review</p>
        </div>
        <div className="mt-4">
          <CTA variant="documentationSummary" primary />
        </div>
      </section>

      {/* 6. Evidence-aware communication */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Evidence-aware communication
        </h2>
        <p className="mt-3 text-gray-600">
          Vancomyzer is designed to support review of vancomycin dosing
          workflow with greater clarity and interpretability. It is intended to
          help users review assumptions, outputs, and limitations. It does not
          claim formal validation, superiority over other tools, or specific
          outcome benefits. Caution and clinician oversight remain central.
        </p>
      </section>

      {/* 7. Final CTA — sample case, documentation summary, FAQ, Contact / Institutional */}
      <section className="border-t border-gray-200 pt-12">
        <div className="flex flex-wrap gap-4">
          <CTA variant="sampleCase" primary />
          <CTA variant="documentationSummary" />
          <Link href="/faq" className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Explore the FAQ
          </Link>
          <CTA variant="contact" />
          <CTA variant="requestEvaluation" />
        </div>
      </section>
    </div>
  );
}
