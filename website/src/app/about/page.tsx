import Link from "next/link";
import CTA from "@/components/CTA";

// Locked: practical not brand-heavy; CASE-001 and quick summary as support links; mission, philosophy, intended users
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* 1. Page introduction */}
      <section className="mb-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          About Vancomyzer
        </h1>
        <p className="mt-4 text-gray-600">
          Vancomyzer is designed to help clinicians review vancomycin dosing
          workflow with greater clarity, interpretability, and transparency.
        </p>
      </section>

      {/* 2. Why Vancomyzer exists */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Why Vancomyzer exists
        </h2>
        <p className="mt-3 text-gray-600">
          Vancomycin dosing can be hard to interpret. Clinicians benefit from
          clearer workflow support. Transparency and explainability are central
          design goals: the product aims to make assumptions, methods, and
          outputs easier to review and communicate.
        </p>
      </section>

      {/* 3. Product philosophy */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Product philosophy
        </h2>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>Transparency over black-box presentation</li>
          <li>Interpretability over vague sophistication claims</li>
          <li>Clinician oversight over algorithmic authority</li>
          <li>Documentation clarity for communication</li>
        </ul>
        <div className="mt-4">
          <CTA variant="trustEvidence" />
        </div>
      </section>

      {/* 4. Intended users */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Intended users
        </h2>
        <p className="mt-3 text-gray-600">
          The tool is designed for clinical pharmacists, antimicrobial
          stewardship teams, hospital clinicians reviewing dosing workflows,
          and learners exploring vancomycin dosing interpretation.
        </p>
      </section>

      {/* 5. How the tool supports review — CASE-001, quick summary, Trust & Evidence */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          How the tool supports review
        </h2>
        <p className="mt-3 text-gray-600">
          You can explore a sample case (stable adult with preserved renal
          function), a documentation-ready summary, and the Trust & Evidence
          page for assumptions, limitations, and review guidance.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <CTA variant="sampleCase" />
          <CTA variant="documentationSummary" />
          <CTA variant="trustEvidence" />
        </div>
      </section>

      {/* 6. Final CTA */}
      <section className="border-t border-gray-200 pt-12">
        <div className="flex flex-wrap gap-4">
          <CTA variant="sampleCase" primary />
          <CTA variant="trustEvidence" />
          <CTA variant="exploreWorkflow" />
          <CTA variant="documentationSummary" />
        </div>
      </section>
    </div>
  );
}
