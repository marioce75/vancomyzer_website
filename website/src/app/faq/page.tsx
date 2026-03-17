import Link from "next/link";
import CTA from "@/components/CTA";

// Locked FAQ shortlist; CASE-001 and quick summary as supporting references
const FAQ_ITEMS = [
  {
    q: "What is AUC-guided vancomycin dosing?",
    a: "AUC-guided vancomycin dosing focuses on estimated drug exposure over time rather than relying only on trough levels. The goal is to support exposure-based interpretation in a more clinically meaningful way.",
  },
  {
    q: "How is Bayesian dosing different from traditional PK dosing?",
    a: "Bayesian dosing uses prior model information together with patient-specific data to support individualized interpretation. Traditional PK approaches can still be useful, but the two methods differ in how they estimate exposure and how they handle sparse information.",
  },
  {
    q: "Why might AUC interpretation differ from trough-based reasoning?",
    a: "AUC interpretation focuses on total exposure rather than using trough concentration alone as a proxy. Because of that, the clinical interpretation and resulting dosing decisions may differ.",
  },
  {
    q: "Why does transparency matter in a vancomycin dosing tool?",
    a: "Transparency matters because clinicians need to understand what inputs, assumptions, and methods influenced a recommendation. Visible reasoning supports trust, review, and safer interpretation.",
  },
  {
    q: "What should clinicians review before accepting a recommendation?",
    a: "Clinicians should review the major inputs used, the method applied, assumptions affecting the result, uncertainty or limitation notes, and any safety-related cautions.",
  },
  {
    q: "Can documentation-ready summaries improve workflow?",
    a: "Documentation-ready summaries can support communication, review, and consistency by making recommendations, assumptions, and cautions easier to copy, share, and understand.",
  },
];

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* 1. Page introduction */}
      <section className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Frequently asked questions
        </h1>
        <p className="mt-4 text-gray-600">
          Answers to common questions about vancomycin dosing workflow,
          Bayesian/AUC interpretation, and transparency. The tool is designed
          to support interpretation rather than replace clinician judgment.
        </p>
      </section>

      {/* 2. Core FAQ block */}
      <section className="mb-16">
        <ul className="space-y-8">
          {FAQ_ITEMS.map(({ q, a }) => (
            <li key={q}>
              <h2 className="text-lg font-semibold text-gray-900">{q}</h2>
              <p className="mt-2 text-gray-600">{a}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Example references — CASE-001, quick summary */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Example references
        </h2>
        <p className="mt-3 text-gray-600">
          A stable adult case with preserved renal function (CASE-001) and a
          quick summary export can reinforce these answers with practical
          examples.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <CTA variant="sampleCase" primary />
          <CTA variant="documentationSummary" />
        </div>
      </section>

      {/* 4. Trust reinforcement */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Transparency and review
        </h2>
        <p className="mt-3 text-gray-600">
          Transparency principles and clinician oversight are central to how
          the workflow is designed. For more detail on what to review and how
          the product approaches trust, see the Trust & Evidence page.
        </p>
        <div className="mt-4">
          <CTA variant="trustEvidence" />
        </div>
      </section>

      {/* 5. Final CTA */}
      <section className="border-t border-gray-200 pt-12">
        <div className="flex flex-wrap gap-4">
          <CTA variant="sampleCase" primary />
          <CTA variant="documentationSummary" />
          <CTA variant="trustEvidence" />
          <CTA variant="requestEvaluation" />
        </div>
      </section>
    </div>
  );
}
