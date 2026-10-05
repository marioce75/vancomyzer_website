import { localizeMetadata } from "@/localization/metadata";
import { requestLocale } from "@/localization/server";

import { LocalizedText } from "@/localization/LanguageProvider";
import type { Metadata } from "next";
import Link from "next/link";
import { OPEN_ACCESS } from "@/lib/openAccess";
import { COLIN_2019 } from "@/lib/pk/modelRegistry";
import { REVIEW_POINTS, LIMITS, SOURCES, METHOD_PAGES } from "./evidenceContent";
import { PageHeader, Record, H3, Prose, Chip, Panel, INK, INK2, INK3, RULE } from "@/components/site/Record";

const englishMetadata: Metadata = {
  alternates: { canonical: "https://vancomyzer.com/transparent-dosing" },
  title: "Vancomyzer Calculator: Evidence, Methods & Validation Status",
  description:
    "How Vancomyzer calculates a vancomycin regimen: the Colin 2019 population model, the Bayesian fit to measured levels, what has been checked, and what has not.",
  openGraph: {
    title: "Evidence and methods — Vancomyzer™",
    description:
      "The population-model equations, the Bayesian fitting approach and the limitations. Independent clinical validation is pending.",
    type: "website",
    url: "https://vancomyzer.com/transparent-dosing",
    siteName: "Vancomyzer™",
  },
  twitter: {
    card: "summary_large_image",
    title: "Evidence and methods — Vancomyzer™",
    description: "The model, the fit and the checks behind each Vancomyzer estimate.",
  },
};

export default function TransparentDosingPage() {
  return (
    <div style={{ color: INK }}>
      <PageHeader
        kicker="Evidence and methods"
        title="How Vancomyzer calculates a regimen, and what has been checked."
        lede={
          <><LocalizedText text="Vancomyzer is a Bayesian vancomycin dosing calculator for clinicians. This page explains the model it uses, how measured levels change an estimate, and which checks have been run. Vancomyzer has not yet been validated in real patients." /></>
        }
      >
        <div className="mt-[26px] flex flex-wrap gap-3">
          <Link href="/transparent-dosing/equations" className="vz-mbtn vz-mbtn--primary"><LocalizedText text="Equations and derivations" /></Link>
          <Link href="/faq" className="vz-mbtn vz-mbtn--outline"><LocalizedText text="Frequently asked questions" /></Link>
        </div>
      </PageHeader>

      {/* ── WHY THIS PAGE EXISTS ────────────────────────────── */}
      <Record label="Why it is shown" note="What a reviewer needs to see.">
        <Prose>
          <p><LocalizedText text="A dose recommendation is only reviewable if the prior, the fit and the evidence behind the model are visible. Some tools show a number without them. Commercial platforms add EHR integration, population-specific models and implementation support; compare those against your institution’s needs. Vancomyzer shows the model, the assumptions and the evidence behind each estimate, and the core calculator is free for individual clinicians." /></p>
          <p><LocalizedText text="The" />{" "}{COLIN_2019.shortName}{" "}<LocalizedText text="prior is documented with its primary citation. A model-based 90% credible band (not yet validated against patient levels) shows how much a fit can and cannot say. The Bayesian step is explained in plain language inside the calculator (turn on" />{" "}<strong><LocalizedText text="Teaching mode" /></strong>{" "}<LocalizedText text="in the calculator’s settings)." /></p>
        </Prose>
      </Record>

      {/* ── HOW TO REVIEW A CALCULATION ─────────────────────── */}
      <Record label="Reviewing a calculation" note="Six things to look at. They are not steps.">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {REVIEW_POINTS.map((p) => (
            <div key={p.title}>
              <h3 className="text-[16px] font-semibold" style={{ color: INK }}><LocalizedText text={p.title} /></h3>
              <p className="mt-1.5 text-[15px] leading-[1.55]" style={{ color: INK2 }}><LocalizedText text={p.body} /></p>
            </div>
          ))}
        </div>
      </Record>

      {/* ── THE CLEARANCE EQUATION ──────────────────────────── */}
      <Record label="The clearance equation" note="The same equation for every adult.">
        <H3><LocalizedText text="Vancomycin clearance," />{" "}{COLIN_2019.shortName}</H3>
        <Prose className="mt-3">
          <p><LocalizedText text="Clearance is the product of a typical value and four patient-related factors. Source: Clin Pharmacokinet. 2019;58(6):767-780, Table 3." /></p>
        </Prose>
        <pre className="vz-code mt-5" tabIndex={0}><LocalizedText text={`CL  =  θCL  ×  (weight / 70)^0.75     size scaling
              ×  F·maturation             ≈ 1.0 in adults
              ×  F·age-decline            50% lower by age 61.6 y
              ×  F·creatinine             serum creatinine effect`} /></pre>
        <Prose className="mt-5">
          <p><LocalizedText text="With measured levels, the individual estimate starts from this population value and is adjusted to fit the patient’s levels. The adjustment is bounded: one unusual level cannot override the population data; it moves the estimate." /></p>
        </Prose>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/transparent-dosing/equations" className="vz-mbtn vz-mbtn--outline vz-mbtn--small"><LocalizedText text="All equations and constants" /></Link>
        </div>
      </Record>

      {/* ── WHERE THE MODEL COMES FROM ──────────────────────── */}
      <Record label="Sources" note="The published work the calculator rests on.">
        <Prose>
          <p><LocalizedText text="The population model is" />{" "}{COLIN_2019.shortName}<LocalizedText text=", a pooled population pharmacokinetic analysis of data from 14 studies (2,554 individuals) spanning neonates through elderly adults. It is used for every adult, at every body size. Published evaluation at BMI 40 or more is limited (Colin 2021: 15 of 49 obese adults), so review measured levels early in heavier patients." /></p>
        </Prose>
        <div className="mt-6 grid gap-3">
          {SOURCES.map((s) => (
            <Panel key={s.doi} className="!p-4 sm:!p-5">
              <p className="text-[15px] font-semibold leading-snug" style={{ color: INK }}><LocalizedText text={s.label} /></p>
              <p className="mt-1 text-[13.5px]" style={{ color: INK3 }}>{s.citation}</p>
              <p className="mt-2 text-[15px]" style={{ color: INK2 }}><LocalizedText text={s.note} /></p>
              <a href={`https://doi.org/${s.doi}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[13px]" style={{ color: "#1f5e96", textDecoration: "underline", textUnderlineOffset: 2 }}>
                doi:{s.doi}
              </a>
            </Panel>
          ))}
        </div>
      </Record>

      {/* ── WHAT HAS BEEN CHECKED ───────────────────────────── */}
      <Record label="What has been checked" note="Each row links to the full record.">
        <div className="overflow-x-auto">
          <table className="vz-ledger">
            <thead>
              <tr>
                <th scope="col"><LocalizedText text="Page" /></th>
                <th scope="col"><LocalizedText text="What it covers" /></th>
                <th scope="col"><LocalizedText text="Status" /></th>
              </tr>
            </thead>
            <tbody>
              {METHOD_PAGES.map((r) => (
                <tr key={r.href}>
                  <td className="whitespace-nowrap">
                    <Link href={r.href} className="font-semibold" style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}><LocalizedText text={r.title} /></Link>
                  </td>
                  <td style={{ color: INK2 }}><LocalizedText text={r.covers} /></td>
                  <td><Chip kind={r.kind}><LocalizedText text={r.status} /></Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-[70ch] text-[14px] leading-[1.5]" style={{ color: INK3 }}><LocalizedText text="“Developer-run” means a check written and executed by the developer against published values or simulated patients. None of these is independent clinical validation." /></p>
      </Record>

      {/* ── LIMITS ──────────────────────────────────────────── */}
      <Record label="Limits to keep in view" note="These apply to every result.">
        <ul className="grid gap-3">
          {LIMITS.map((t, i) => (
            <li key={i} className="flex gap-3 border-l-[3px] bg-white py-3 pl-4 pr-4 text-[15px] leading-[1.55]" style={{ borderColor: "#a32d2d", color: INK2, outline: `1px solid ${RULE}` }}>
              <span aria-hidden="true" style={{ color: "#a32d2d", fontWeight: 700 }}>✕</span>
              <span><LocalizedText text={t} /></span>
            </li>
          ))}
        </ul>
      </Record>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <Record label="Open the calculator" note="Free for individual clinicians; no account needed during launch." last>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={OPEN_ACCESS ? "/calculator" : "/register"} className="vz-mbtn vz-mbtn--primary"><LocalizedText text="Open the calculator" /></Link>
          <Link href="/pricing" className="vz-mbtn vz-mbtn--outline"><LocalizedText text="See pricing" /></Link>
        </div>
        <p className="mt-5 max-w-[70ch] text-[13.5px] leading-[1.5]" style={{ color: INK3 }}><LocalizedText text="Vancomyzer™ is a clinical decision-support tool for qualified healthcare professionals only. Not FDA-cleared or approved. Designed to meet the non-device clinical decision support criteria of FD&C Act §520(o)(1)(E); not reviewed by the FDA. Engineered by" />{" "}
          <a href="https://dosys.health" target="_blank" rel="noopener noreferrer" style={{ color: "#1f5e96", textDecoration: "underline" }}><LocalizedText text="Dōsys™" /></a>.
        </p>
      </Record>
    </div>
  );
}

export async function generateMetadata() {
  return localizeMetadata(englishMetadata, await requestLocale());
}
