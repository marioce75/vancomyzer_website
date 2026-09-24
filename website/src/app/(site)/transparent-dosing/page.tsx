import type { Metadata } from "next";
import Link from "next/link";
import { OPEN_ACCESS } from "@/lib/openAccess";
import { COLIN_2019 } from "@/lib/pk/modelRegistry";
import { PageHeader, Record, H3, Prose, Chip, Panel, INK, INK2, INK3, RULE } from "@/components/site/Record";

export const metadata: Metadata = {
  alternates: { canonical: "https://vancomyzer.com/transparent-dosing" },
  title: "Evidence — Vancomyzer™",
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

// What to look at when reviewing a calculation. Unordered: these are not steps.
const REVIEW_POINTS = [
  { title: "Population-model equations", body: `The ${COLIN_2019.shortName} covariate equations are shown next to the estimated pharmacokinetic parameters. Bayesian fitting also uses numerical optimization; it is not a calculation that can be reproduced by substituting inputs into one equation.` },
  { title: "Fit to measured levels", body: "Bayesian estimates combine the population model with measured levels. The calculator shows measured-versus-predicted differences and flags a poor fit for clinical review." },
  { title: "90% credible band", body: "The shaded band is the 5th–95th percentile of concentrations simulated from 400 parameter sets drawn from the posterior (sampling-importance-resampling around the MAP fit), or from the population prior before any level. Parameter uncertainty only: assay error is excluded, so it is not a prediction interval for a new level. It is conditional on the calculator's prior variances and residual error model, and is model-based and not yet validated against measured patient levels." },
  { title: "Published starting model", body: `${COLIN_2019.citation} ${COLIN_2019.sourcePopulation} Published model evidence does not establish clinical validation of Vancomyzer.` },
  { title: "Scope", body: "Vancomyzer supports adults receiving intermittent intravenous vancomycin. Pediatric dosing, dialysis and continuous infusion are outside its scope. Independent clinical validation is pending." },
  { title: "Access", body: "The core calculator is free. Paid plans add account features. All plans use the same calculation method; see the pricing page for current terms." },
];

const LIMITS = [
  "Vancomyzer is not FDA-cleared or approved. Its intended regulatory basis and limitations are described in the medical disclaimer.",
  "A poor fit to measured levels calls for review of timing, data quality and the clinical situation. It does not establish that a proposed regimen is appropriate.",
  "Published-case checks and synthetic comparisons are developer-run software checks, not independent clinical validation.",
  "The clinician must review a recommendation against the patient’s condition, local protocol and therapeutic drug monitoring.",
];

const SOURCES = [
  {
    label: COLIN_2019.displayName,
    citation: COLIN_2019.citation,
    doi: COLIN_2019.doi,
    note: "The population model, used for every adult at every body size. CC BY-NC.",
  },
  {
    label: "Janmahasatian S et al. — Quantification of lean bodyweight (FFM equations)",
    citation: "Clin Pharmacokinet. 2005;44(10):1051-1065.",
    doi: "10.2165/00003088-200544100-00004",
    note: "Fat-free mass is displayed for context at BMI 40 or more; it does not change the Colin 2019 calculation.",
  },
  {
    label: "Rybak MJ et al. — Therapeutic monitoring of vancomycin (ASHP/IDSA/PIDS/SIDP 2020)",
    citation: "Am J Health Syst Pharm. 2020;77(11):835-864.",
    doi: "10.1093/ajhp/zxaa036",
    note: "Source of the AUC₂₄ 400–600 mg·h/L target.",
  },
];

const METHOD_PAGES = [
  { href: "/transparent-dosing/equations", title: "Equations and derivations", covers: "Every equation and constant the calculator uses, with the reference check for a typical adult.", status: "Published model", kind: "ok" as const },
  { href: "/transparent-dosing/cases", title: "Literature reproducibility", covers: "Published vancomycin cases run through the calculator. Same-model cases are pass/fail; cases from other models are context only.", status: "Developer-run", kind: "ok" as const },
  { href: "/transparent-dosing/predictive-performance", title: "Predictive performance", covers: "200 synthetic ICU patients from a different published model; one held-out concentration each. Not real patients.", status: "Developer-run", kind: "ok" as const },
  { href: "/transparent-dosing/engine-crosscheck", title: "Comparison with Tucuxi", covers: "The same prior and the same simulated levels given to a separately built program, scored against pre-set criteria.", status: "Developer-run", kind: "ok" as const },
  { href: "/transparent-dosing/predictive-performance#validation-plan", title: "Independent clinical validation", covers: "Retrospective and prospective evaluation with patient data at a participating institution.", status: "Pending", kind: "warn" as const },
];

export default function TransparentDosingPage() {
  return (
    <div style={{ color: INK }}>
      <PageHeader
        kicker="Evidence and methods"
        title="How Vancomyzer calculates a regimen, and what has been checked."
        lede={
          <>
            Vancomyzer is a Bayesian vancomycin dosing calculator for clinicians. This page explains the
            model it uses, how measured levels change an estimate, and which checks have been run.
            Vancomyzer has not yet been validated in real patients.
          </>
        }
      >
        <div className="mt-[26px] flex flex-wrap gap-3">
          <Link href="/transparent-dosing/equations" className="vz-mbtn vz-mbtn--primary">
            Equations and derivations
          </Link>
          <Link href="/faq" className="vz-mbtn vz-mbtn--outline">
            Frequently asked questions
          </Link>
        </div>
      </PageHeader>

      {/* ── WHY THIS PAGE EXISTS ────────────────────────────── */}
      <Record label="Why it is shown" note="What a reviewer needs to see.">
        <Prose>
          <p>
            A dose recommendation is only reviewable if the prior, the fit and the evidence behind the
            model are visible. Some tools show a number without them. Commercial platforms add EHR
            integration, population-specific models and implementation support; compare those against
            your institution&rsquo;s needs. Vancomyzer shows the model, the assumptions and the evidence
            behind each estimate, and the core calculator is free for individual clinicians.
          </p>
          <p>
            The {COLIN_2019.shortName} prior is documented with its primary citation. A model-based 90% credible
            band (not yet validated against patient levels) shows how much a fit can and cannot say. The Bayesian step is explained in
            plain language inside the calculator (turn on <strong>Teaching mode</strong> in the
            calculator&rsquo;s settings).
          </p>
        </Prose>
      </Record>

      {/* ── HOW TO REVIEW A CALCULATION ─────────────────────── */}
      <Record label="Reviewing a calculation" note="Six things to look at. They are not steps.">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {REVIEW_POINTS.map((p) => (
            <div key={p.title}>
              <h3 className="text-[16px] font-semibold" style={{ color: INK }}>{p.title}</h3>
              <p className="mt-1.5 text-[15px] leading-[1.55]" style={{ color: INK2 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </Record>

      {/* ── THE CLEARANCE EQUATION ──────────────────────────── */}
      <Record label="The clearance equation" note="The same equation for every adult.">
        <H3>Vancomycin clearance, {COLIN_2019.shortName}</H3>
        <Prose className="mt-3">
          <p>
            Clearance is the product of a typical value and four covariate factors. Source: Clin
            Pharmacokinet. 2019;58(6):767-780, Table 3.
          </p>
        </Prose>
        <pre className="vz-code mt-5" tabIndex={0}>{`CL  =  θCL  ×  (weight / 70)^0.75     size scaling
              ×  F·maturation             ≈ 1.0 in adults
              ×  F·age-decline            50% lower by age 61.6 y
              ×  F·creatinine             serum creatinine effect`}</pre>
        <Prose className="mt-5">
          <p>
            With measured levels, the individual estimate starts from this population value and is
            adjusted to fit the patient&rsquo;s levels. The adjustment is bounded: one unusual level
            cannot override the population data; it moves the estimate.
          </p>
        </Prose>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/transparent-dosing/equations" className="vz-mbtn vz-mbtn--outline vz-mbtn--small">
            All equations and constants
          </Link>
        </div>
      </Record>

      {/* ── WHERE THE MODEL COMES FROM ──────────────────────── */}
      <Record label="Sources" note="The published work the calculator rests on.">
        <Prose>
          <p>
            The population model is {COLIN_2019.shortName}, a pooled population pharmacokinetic analysis
            of data from 14 studies (2,554 individuals) spanning neonates through elderly adults. It is
            used for every adult, at every body size. Published evaluation at BMI 40 or more is limited
            (Colin 2021: 15 of 49 obese adults), so review measured levels early in heavier patients.
          </p>
        </Prose>
        <div className="mt-6 grid gap-3">
          {SOURCES.map((s) => (
            <Panel key={s.doi} className="!p-4 sm:!p-5">
              <p className="text-[15px] font-semibold leading-snug" style={{ color: INK }}>{s.label}</p>
              <p className="mt-1 text-[13.5px]" style={{ color: INK3 }}>{s.citation}</p>
              <p className="mt-2 text-[15px]" style={{ color: INK2 }}>{s.note}</p>
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
                <th scope="col">Page</th>
                <th scope="col">What it covers</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {METHOD_PAGES.map((r) => (
                <tr key={r.href}>
                  <td className="whitespace-nowrap">
                    <Link href={r.href} className="font-semibold" style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}>{r.title}</Link>
                  </td>
                  <td style={{ color: INK2 }}>{r.covers}</td>
                  <td><Chip kind={r.kind}>{r.status}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-[70ch] text-[14px] leading-[1.5]" style={{ color: INK3 }}>
          &ldquo;Developer-run&rdquo; means a check written and executed by the developer against published
          values or simulated patients. None of these is independent clinical validation.
        </p>
      </Record>

      {/* ── LIMITS ──────────────────────────────────────────── */}
      <Record label="Limits to keep in view" note="These apply to every result.">
        <ul className="grid gap-3">
          {LIMITS.map((t, i) => (
            <li key={i} className="flex gap-3 border-l-[3px] bg-white py-3 pl-4 pr-4 text-[15px] leading-[1.55]" style={{ borderColor: "#a32d2d", color: INK2, outline: `1px solid ${RULE}` }}>
              <span aria-hidden="true" style={{ color: "#a32d2d", fontWeight: 700 }}>✕</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Record>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <Record label="Open the calculator" note="Free for individual clinicians; no account needed during launch." last>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={OPEN_ACCESS ? "/calculator" : "/register"} className="vz-mbtn vz-mbtn--primary">
            Open the calculator
          </Link>
          <Link href="/pricing" className="vz-mbtn vz-mbtn--outline">
            See pricing
          </Link>
        </div>
        <p className="mt-5 max-w-[70ch] text-[13.5px] leading-[1.5]" style={{ color: INK3 }}>
          Vancomyzer&trade; is a clinical decision-support tool for qualified healthcare professionals
          only. Not FDA-cleared or approved. Designed to meet the non-device clinical decision support
          criteria of FD&amp;C Act §520(o)(1)(E); not reviewed by the FDA. Engineered by{" "}
          <a href="https://dosys.health" target="_blank" rel="noopener noreferrer" style={{ color: "#1f5e96", textDecoration: "underline" }}>Dōsys&trade;</a>.
        </p>
      </Record>
    </div>
  );
}
