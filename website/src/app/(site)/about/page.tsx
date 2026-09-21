import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://vancomyzer.com/about" },
};

// Locked: practical not brand-heavy; CASE-001 and quick summary as support links; mission, philosophy, intended users
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* 1. Page introduction */}
      <section className="mb-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          About Vancomyzer™
        </h1>
        <p className="mt-4 text-gray-600">
          Vancomyzer™ estimates vancomycin regimens for adults receiving intermittent intravenous therapy. Clinicians can review predicted exposure, model assumptions and published references.
        </p>
      </section>

      {/* 2. Why Vancomyzer™ exists */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Why Vancomyzer™ exists
        </h2>
        <p className="mt-3 text-gray-600">
          A dose estimate needs context: patient information, measured concentrations and the limits of the model. Vancomyzer presents these alongside regimen comparisons and a clinical note.
        </p>
      </section>

      {/* 3. Product philosophy */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Product philosophy
        </h2>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>Show the model and assumptions used</li>
          <li>State where evidence or input data are limited</li>
          <li>Keep dosing decisions with the treating clinician</li>
          <li>Provide results that can be reviewed and documented</li>
        </ul>
      </section>

      {/* 4. Intended users */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Intended users
        </h2>
        <p className="mt-3 text-gray-600">
          The tool is designed for clinical pharmacists, antimicrobial
          stewardship teams, hospital clinicians reviewing dosing options,
          and learners exploring vancomycin dosing interpretation.
        </p>
      </section>
    </div>
  );
}
