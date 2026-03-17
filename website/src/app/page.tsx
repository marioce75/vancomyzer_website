import Link from "next/link";
import CTA from "@/components/CTA";

// Locked: one hero, one case preview (CASE-001), one quick summary export preview, FAQ preview, demo-first CTA flow
export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* 1. Hero */}
      <section id="hero" className="mb-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Vancomycin dosing with more clarity
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-600">
          Review recommendations, assumptions, and outputs in a more
          clinician-readable workflow.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <CTA variant="exploreWorkflow" primary />
          <CTA variant="sampleCase" />
        </div>
      </section>

      {/* 2. Why Vancomyzer */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">Why Vancomyzer</h2>
        <p className="mt-3 text-gray-600">
          Vancomyzer is designed to make vancomycin dosing easier to review,
          explain, and trust. Instead of hiding assumptions behind a black box,
          it aims to present recommendations with clearer logic, interpretable
          outputs, and workflow-friendly summaries.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-gray-600">
          <li>Transparent assumptions</li>
          <li>Clinician-readable outputs</li>
          <li>Documentation-ready summaries</li>
          <li>Workflow clarity</li>
        </ul>
      </section>

      {/* 3. Trust and transparency highlights */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Trust and transparency
        </h2>
        <p className="mt-3 text-gray-600">
          Vancomyzer emphasizes what inputs were used, what method was applied,
          what assumptions affected the result, and where caution is warranted.
          The goal is interpretability as well as precision.
        </p>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>Visible assumptions</li>
          <li>Visible method and model</li>
          <li>Caution and limitations highlighted</li>
          <li>Documentation-ready communication</li>
        </ul>
        <div className="mt-4">
          <Link
            href="/trust-evidence"
            className="text-sm font-medium text-gray-900 underline hover:no-underline"
          >
            Explore the Trust & Evidence page
          </Link>
        </div>
      </section>

      {/* 4. Sample case preview — CASE-001 only */}
      <section id="sample-case" className="mb-16 scroll-mt-8">
        <h2 className="text-xl font-semibold text-gray-900">Sample case preview</h2>
        <p className="mt-3 text-gray-600">
          Review a straightforward case with preserved renal function and
          routine AUC-guided dosing interpretation: stable adult with preserved
          renal function.
        </p>
        <div className="mt-4">
          <CTA variant="sampleCase" primary />
        </div>
      </section>

      {/* 5. Documentation/export preview — quick summary only */}
      <section id="documentation" className="mb-16 scroll-mt-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Documentation-ready summary
        </h2>
        <p className="mt-3 text-gray-600">
          Quick summaries and documentation-ready outputs that are easier to
          review and share in workflow.
        </p>
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-700">
          <p>Recommendation: Example regimen placeholder for CASE-001</p>
          <p>Estimated AUC / trough: Example placeholders</p>
          <p>Method: Bayesian/AUC-guided example summary</p>
          <p>Key assumptions and cautions: Example notes for review</p>
        </div>
        <div className="mt-4">
          <CTA variant="documentationSummary" primary />
        </div>
      </section>

      {/* 6. FAQ preview — 3–5 items, locked shortlist subset */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">Frequently asked</h2>
        <ul className="mt-4 space-y-4">
          <li>
            <strong className="text-gray-900">What is AUC-guided vancomycin dosing?</strong>
            <p className="mt-1 text-sm text-gray-600">
              AUC-guided dosing focuses on estimated drug exposure over time
              rather than relying only on trough levels.
            </p>
          </li>
          <li>
            <strong className="text-gray-900">How is Bayesian dosing different from traditional PK dosing?</strong>
            <p className="mt-1 text-sm text-gray-600">
              Bayesian dosing uses prior model information with patient-specific
              data to support individualized interpretation.
            </p>
          </li>
          <li>
            <strong className="text-gray-900">Why does transparency matter in a vancomycin dosing tool?</strong>
            <p className="mt-1 text-sm text-gray-600">
              Clinicians need to understand what inputs, assumptions, and
              methods influenced a recommendation.
            </p>
          </li>
          <li>
            <strong className="text-gray-900">What should clinicians review before accepting a recommendation?</strong>
            <p className="mt-1 text-sm text-gray-600">
              Major inputs, method applied, assumptions, uncertainty or
              limitation notes, and safety-related cautions.
            </p>
          </li>
        </ul>
        <div className="mt-4">
          <Link href="/faq" className="text-sm font-medium text-gray-900 underline hover:no-underline">
            Explore the FAQ
          </Link>
        </div>
      </section>

      {/* 7. Final CTA — demo-first */}
      <section className="border-t border-gray-200 pt-12">
        <p className="text-gray-600">Next steps:</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <CTA variant="exploreWorkflow" />
          <CTA variant="sampleCase" />
          <CTA variant="documentationSummary" />
        </div>
      </section>
    </div>
  );
}
