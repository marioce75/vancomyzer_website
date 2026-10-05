
import { LocalizedText } from "@/localization/LanguageProvider";
import { localizeMetadata } from "@/localization/metadata";
import { requestLocale } from "@/localization/server";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Record, Prose, INK } from "@/components/site/Record";

const englishMetadata: Metadata = {
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
          <p><LocalizedText text="A dose estimate needs context: patient information, measured concentrations and the limits of the model. Vancomyzer presents these alongside regimen comparisons and a clinical note." /></p>
        </Prose>
      </Record>

      <Record label="What it provides" note="Model details, limitations and results for clinical review.">
        <Prose>
          <ul>
            <li><LocalizedText text="Show the model and assumptions used" /></li>
            <li><LocalizedText text="State where evidence or input data are limited" /></li>
            <li><LocalizedText text="Keep dosing decisions with the treating clinician" /></li>
            <li><LocalizedText text="Provide results that can be reviewed and documented" /></li>
          </ul>
        </Prose>
      </Record>

      <Record label="Intended users" note="Qualified healthcare professionals and trainees.">
        <Prose>
          <p><LocalizedText text="Clinical pharmacists, antimicrobial stewardship teams, hospital clinicians reviewing dosing options, and learners exploring vancomycin dosing interpretation. It is not for patients or caregivers." /></p>
        </Prose>
      </Record>

      <Record label="Who makes it" note="Mario Cardenas, PharmD, MBA." last>
        <Prose>
          <p><LocalizedText text="Vancomyzer is a product of" />{" "}
            <a href="https://dosys.health" target="_blank" rel="noopener noreferrer"><LocalizedText text="Dōsys Health LLC" /></a><LocalizedText text=". Mario Cardenas, PharmD, MBA, is an ICU clinical pharmacist and the company’s founder and CEO. He leads product development. Questions and research inquiries go through the" />{" "}
            <Link href="/contact"><LocalizedText text="contact page" /></Link><LocalizedText text="; the evidence behind the calculator is on the" />{" "}
            <Link href="/transparent-dosing"><LocalizedText text="evidence page" /></Link>.
          </p>
          <p><LocalizedText text="The published population model and developer-run checks are not independent clinical validation of Vancomyzer. Independent evaluation with patient data is pending; the" />{" "}
            <Link href="/transparent-dosing"><LocalizedText text="evidence status" /></Link>{" "}<LocalizedText text="explains what has been checked and what remains to be evaluated." /></p>
        </Prose>
      </Record>
    </div>
  );
}

export async function generateMetadata() {
  return localizeMetadata(englishMetadata, await requestLocale());
}
