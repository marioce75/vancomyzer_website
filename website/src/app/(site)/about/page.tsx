import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Record, Prose, INK } from "@/components/site/Record";

export const metadata: Metadata = {
  title: "About — Vancomyzer™",
  description: "What Vancomyzer is for, how it is meant to be used, and who it is designed for.",
  alternates: { canonical: "https://vancomyzer.com/about" },
};

export default function AboutPage() {
  return (
    <div style={{ color: INK }}>
      <PageHeader
        kicker="About"
        title="Vancomyzer™"
        compact
        lede="Vancomyzer estimates vancomycin regimens for adults receiving intermittent intravenous therapy. Clinicians can review predicted exposure, model assumptions and published references."
      />

      <Record label="Why it exists" note="A dose estimate needs its context.">
        <Prose>
          <p>
            A dose estimate needs context: patient information, measured concentrations and the limits
            of the model. Vancomyzer presents these alongside regimen comparisons and a clinical note.
          </p>
        </Prose>
      </Record>

      <Record label="How it is built" note="Four commitments, applied to every result.">
        <Prose>
          <ul>
            <li>Show the model and assumptions used</li>
            <li>State where evidence or input data are limited</li>
            <li>Keep dosing decisions with the treating clinician</li>
            <li>Provide results that can be reviewed and documented</li>
          </ul>
        </Prose>
      </Record>

      <Record label="Intended users" note="Qualified healthcare professionals and trainees.">
        <Prose>
          <p>
            Clinical pharmacists, antimicrobial stewardship teams, hospital clinicians reviewing dosing
            options, and learners exploring vancomycin dosing interpretation. It is not for patients or
            caregivers.
          </p>
        </Prose>
      </Record>

      <Record label="Who makes it" note="Mario Cardenas, PharmD, MBA." last>
        <Prose>
          <p>
            Vancomyzer is a product of{" "}
            <a href="https://dosys.health" target="_blank" rel="noopener noreferrer">Dōsys Health LLC</a>.
            Mario Cardenas, PharmD, MBA, is an ICU clinical pharmacist and the company’s founder and CEO.
            He leads product development. Questions and research inquiries go through the{" "}
            <Link href="/contact">contact page</Link>; the evidence behind the calculator is on the{" "}
            <Link href="/transparent-dosing">evidence page</Link>.
          </p>
          <p>
            The published population model and developer-run checks are not independent clinical
            validation of Vancomyzer. Independent evaluation with patient data is pending; the{" "}
            <Link href="/transparent-dosing">evidence status</Link> explains what has been checked
            and what remains to be evaluated.
          </p>
        </Prose>
      </Record>
    </div>
  );
}
