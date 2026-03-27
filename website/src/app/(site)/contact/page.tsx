import Link from "next/link";
import CTA from "@/components/CTA";

// Locked: evaluator-oriented not sales-heavy; CASE-002; clinical note export; demo-first before inquiry; no ROI/productivity/superiority claims
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* 1. Page introduction */}
      <section className="mb-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Contact / Institutional
        </h1>
        <p className="mt-4 text-gray-600">
          This page is for teams and evaluators who want to understand whether
          Vancomyzer™ is relevant for their workflow. We recommend reviewing
          sample materials before reaching out.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href="mailto:contact@vancomyzer.com?subject=Workflow%20evaluation%20request"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            Request a workflow evaluation
          </a>
        </div>
      </section>

      {/* 2. Who this is for */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Who this is for
        </h2>
        <p className="mt-3 text-gray-600">
          Antimicrobial stewardship teams, ICU and ID pharmacists, clinicians
          involved in vancomycin dosing review, and clinical leaders evaluating
          workflow support tools.
        </p>
      </section>

      {/* 3. Why teams may care */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Why teams may care
        </h2>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>Workflow clarity and interpretability of outputs</li>
          <li>Visible assumptions and limitations</li>
          <li>Documentation-ready summaries</li>
        </ul>
        <p className="mt-4 text-gray-600">
          The product is designed to support workflow review and
          communication, with an emphasis on transparency and clinician-readable
          design.
        </p>
      </section>

      {/* 4. What evaluators should review first — CASE-002, clinical note, Trust & Evidence */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          What evaluators should review first
        </h2>
        <p className="mt-3 text-gray-600">
          A case with renal function instability (CASE-002) illustrates how
          changing renal function affects interpretation, assumptions, and
          caution notes. A clinical-note style export shows how richer
          documentation can support review.
        </p>
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-700">
          <p>Patient/scenario: Renal function instability</p>
          <p>Inputs used: Example input summary placeholder</p>
          <p>Method: Bayesian/AUC-guided example method</p>
          <p>Recommendation: Example regimen placeholder</p>
          <p>Assumptions / Limitations / Safety notes: Example notes for clinician review</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <CTA variant="sampleCase" primary />
          <CTA variant="documentationSummary" />
          <CTA variant="trustEvidence" />
        </div>
      </section>

      {/* 5. Contact / evaluation CTA block — mailto for Phase 1 (no self-links) */}
      <section id="inquiry" className="border-t border-gray-200 pt-12 scroll-mt-8">
        <p className="text-gray-600">
          Ready to discuss a workflow evaluation or have questions?
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Email:{" "}
          <a
            href="mailto:contact@vancomyzer.com?subject=Vancomyzer™%20inquiry"
            className="font-medium text-gray-900 underline hover:no-underline"
          >
            contact@vancomyzer.com
          </a>
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <a
            href="mailto:contact@vancomyzer.com?subject=Workflow%20evaluation%20request"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
          >
            Request a workflow evaluation
          </a>
          <a
            href="mailto:contact@vancomyzer.com?subject=Vancomyzer™%20inquiry"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
          >
            Contact us
          </a>
          <CTA variant="documentationSummary" />
        </div>
      </section>
    </div>
  );
}
