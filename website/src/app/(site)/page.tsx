import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import OpenCalculatorButton from "@/components/landing/OpenCalculatorButton";
import SyntheticExample from "@/components/landing/SyntheticExample";
import { OPEN_ACCESS } from "@/lib/openAccess";
import {
  COLIN_2019,
  COLIN_2021_OBESE_EVALUATION,
  HIGH_BMI_THRESHOLD_KG_M2,
} from "@/lib/pk/modelRegistry";

/**
 * Public landing page at "/" — Direction A ("Clinical record"), Sep 2026.
 *
 * Lives in the (site) route group so it gets the marketing Header + Footer.
 * The calculator itself is at /calculator (src/app/calculator/page.tsx).
 *
 * Styling notes: the app always runs the basic theme, which forces h1–h3
 * colours and inline font-families; marketing headings opt into the serif
 * display face with `.vz-serif`, buttons use `.vz-mbtn`, sections use the
 * `.vz-record` margin-column grid (globals.css, "Direction A" block).
 *
 * Copy rules: plain clinical language; no invented statistics, testimonials
 * or outcome claims; cited facts only (published sources already referenced
 * on /transparent-dosing). Model names and citations come from
 * @/lib/pk/modelRegistry. Validation, regulatory and pricing wording follows
 * the approved wording bank from the 15 Sep 2026 review remediation. The
 * launch-period line follows OPEN_ACCESS so the page stays truthful when the
 * switch is turned off. The screenshot is the real calculator for a
 * labelled fictional case; it is never edited.
 */

export const metadata: Metadata = {
  title: "Vancomycin AUC Dosing Calculator — Free Bayesian Dosing Support | Vancomyzer™",
  description:
    `Free Bayesian, AUC-guided vancomycin dosing calculator for pharmacists, physicians and other clinicians. Empiric dosing from patient characteristics, refinement with one or two measured levels, the ${COLIN_2019.shortName} population model for all adults with a high-BMI advisory, and AUC24 targets aligned with the 2020 ASHP/IDSA/PIDS/SIDP consensus guideline.`,
  alternates: { canonical: "https://vancomyzer.com/" },
  openGraph: {
    title: "Vancomyzer™ — Free Bayesian Vancomycin AUC Dosing Calculator",
    description:
      "AUC-guided vancomycin dosing support for clinicians: empiric regimens, refinement with one or two measured levels, with published methods and stated limitations.",
    type: "website",
    url: "https://vancomyzer.com",
    siteName: "Vancomyzer™",
  },
  twitter: {
    card: "summary",
    title: "Vancomyzer™ — Free Bayesian Vancomycin AUC Dosing Calculator",
    description:
      "AUC-guided vancomycin dosing support for pharmacists, physicians and other clinicians.",
  },
};

// Pricing facts: the core calculator is free, permanently. During the launch
// period PDF export, note copy and interpretation are also free with no
// account; afterwards they return to Individual Pro.
const LAUNCH_LINE = OPEN_ACCESS
  ? "The core calculator is free, permanently. During our launch period, PDF export, note copy and result interpretation are free too — no account needed."
  : "The core calculator is free for individual clinicians, permanently — create a free account or sign in to get started.";

const FICTIONAL_CASE_CAPTION =
  "Fictional case for illustration — synthetic inputs (58 y, 82 kg, 172 cm, SCr 1.1 mg/dL, no RRT). Not a patient. Screenshot of the current calculator, unaltered.";

const CAPABILITIES: { title: string; body: string; source?: string }[] = [
  {
    title: "AUC₂₄-guided targets",
    body:
      "Suggested regimens aim for an AUC₂₄ of 400–600 mg·h/L, the target range recommended for serious MRSA infections (assuming an MIC of 1 mg/L) by the 2020 ASHP/IDSA/PIDS/SIDP vancomycin consensus guideline.",
    source: "Rybak MJ et al. Am J Health Syst Pharm. 2020;77(11):835-864.",
  },
  {
    title: "Empiric dosing from patient characteristics",
    body:
      "Before any levels are available, get a suggested starting regimen, including loading-dose guidance, based on age, weight, serum creatinine and other patient characteristics.",
  },
  {
    title: "Refinement with one or two levels",
    body:
      "Enter one or two measured vancomycin levels and the estimate is individualized to your patient with Bayesian methods. The adjustment is bounded, so one unusual level cannot override the population data.",
  },
  {
    title: `${COLIN_2019.shortName} pooled population model`,
    body:
      "A published, peer-reviewed analysis that pools 14 vancomycin studies. Vancomyzer shows the model, assumptions and evidence behind each estimate.",
    source: COLIN_2019.citation,
  },
  {
    title: "One model for all adults, with a high-BMI advisory",
    body:
      `${COLIN_2019.shortName} is used for every adult, at every body size. At a BMI of ${HIGH_BMI_THRESHOLD_KG_M2} kg/m² or higher, an advisory notes that published evaluation at that size is limited, and fat-free mass and alternative creatinine-clearance estimates are shown for context only. They do not change the calculation.`,
    source: COLIN_2021_OBESE_EVALUATION.citation,
  },
  {
    title: "Built-in safety checks",
    body:
      "Infusions are kept to a maximum rate of 10 mg/min and at least 60 minutes. Recommendations are withheld for dialysis or renal replacement therapy, and warnings flag severely reduced kidney function, questionable level timing and a poor fit to measured levels.",
  },
];

// Evidence status: published model evidence and developer-run checks are kept
// apart from the pending independent validation. Each row links to its page.
const EVIDENCE_STATUS: { item: string; covers: string; status: string; kind: "ok" | "warn"; href: string }[] = [
  { item: "Population model", covers: `${COLIN_2019.shortName} two-compartment model; population-model equations and references (Bayesian fitting also uses numerical optimization)`, status: "Published", kind: "ok", href: "/transparent-dosing/equations" },
  { item: "Literature reproducibility", covers: "Published vancomycin cases run through the calculator; same-model reproductions are pass/fail", status: "Developer-run", kind: "ok", href: "/transparent-dosing/cases" },
  { item: "Predictive performance", covers: "Synthetic analysis (not real patients): predictions against simulated ICU patients from a different published model", status: "Developer-run", kind: "ok", href: "/transparent-dosing/predictive-performance" },
  { item: "Comparison with Tucuxi", covers: "Synthetic analysis: individualized estimates compared with Tucuxi, a separately built program, against pre-set acceptance criteria", status: "Developer-run", kind: "ok", href: "/transparent-dosing/engine-crosscheck" },
  { item: "Independent clinical validation", covers: "Study with patient data at a participating institution", status: "Pending", kind: "warn", href: "/transparent-dosing" },
  { item: "FDA review", covers: "Designed to meet non-device CDS criteria, FD&C §520(o)(1)(E); not reviewed by the FDA", status: "Not reviewed", kind: "warn", href: "/disclaimer" },
];

const AUDIENCE = [
  "Pharmacists",
  "Physicians",
  "Nurse practitioners",
  "Physician assistants",
  "Residents",
  "Students",
];

const NOT_FOR = [
  "Pediatric patients",
  "Patients on dialysis or other renal replacement therapy",
  "Continuous-infusion vancomycin",
];

const INK = "#14232f";
const INK2 = "#4a5a68";
const INK3 = "#546471";
const RULE = "#cbd6e0";
const ACTION = "#1f5e96";

function Section({
  id,
  label,
  note,
  children,
  last = false,
}: {
  id?: string;
  label: string;
  note?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section id={id} className="mx-auto max-w-[1180px] px-4 sm:px-6" style={{ borderBottom: last ? "none" : `1px solid ${RULE}` }}>
      <div className="vz-record py-12 md:py-[72px]">
        <div className="pt-2.5">
          <span className="block text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: INK3 }}>{label}</span>
          {note && <span className="mt-2 block text-[13px] leading-[1.45]" style={{ color: INK3 }}>{note}</span>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="vz-serif text-[clamp(26px,3vw,36px)] leading-[1.15]" style={{ color: INK }}>
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="vz-serif text-[22px] leading-[1.25]" style={{ color: INK }}>
      {children}
    </h3>
  );
}

function Chip({ kind, children }: { kind: "ok" | "warn" | "crit"; children: React.ReactNode }) {
  return (
    <span className={`vz-mchip vz-mchip--${kind}`}>
      {children}
    </span>
  );
}

export default function LandingPage() {
  return (
    <div style={{ color: INK }}>
      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-4 sm:px-6" style={{ borderBottom: `1px solid ${RULE}` }}>
        <div className="py-14 md:pb-14 md:pt-[72px]">
          <span className="mb-[18px] block text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: INK3 }}>
            Vancomycin dosing support for clinicians
          </span>
          <h1 className="vz-serif max-w-[22ch] text-[clamp(34px,4.6vw,56px)] leading-[1.08]" style={{ color: INK }}>
            Vancomycin AUC calculator for adult patients.
          </h1>
          <p className="mt-[22px] max-w-[60ch] text-xl leading-[1.5]" style={{ color: INK2 }}>
            Estimate a starting regimen or use measured levels to compare dosing options. Targets follow
            the 2020 ASHP/IDSA/PIDS/SIDP consensus guideline. Review the model assumptions and
            limitations before using an estimate.
          </p>
          <p className="mt-4 max-w-[60ch] text-[15px] font-semibold" style={{ color: INK2 }}>
            Adults receiving intermittent IV vancomycin only. For clinician review. Independent clinical
            validation is pending.
          </p>
          <div className="mt-[30px] flex flex-wrap gap-3">
            <OpenCalculatorButton source="landing_hero" className="vz-mbtn vz-mbtn--primary">
              Open the calculator
            </OpenCalculatorButton>
            <Link href="#how" className="vz-mbtn vz-mbtn--outline">
              How it works
            </Link>
          </div>
          <p className="mt-5 max-w-[70ch] text-[15px]" style={{ color: INK2 }}>{LAUNCH_LINE}</p>
        </div>
      </section>

      {/* ── HOW A RESULT IS BUILT ──────────────────────────── */}
      <Section id="how" label="How it works" note="Patient inputs, dosing estimates and model details.">
        <figure className="border bg-white p-2.5" style={{ borderColor: RULE, boxShadow: "0 1px 2px rgba(20,35,47,.06), 0 12px 32px -12px rgba(31,94,150,.25)" }}>
          <Image
            src="/images/calculator-result-fictional.png"
            alt="Vancomyzer calculator result screen: patient inputs on the left, recommended regimen 750 mg every 12 h with AUC 521.5 in target, a concentration–time graph, candidate regimens and PK parameters."
            width={1600}
            height={1000}
            sizes="(max-width: 1200px) 100vw, 960px"
            className="block h-auto w-full border"
            style={{ borderColor: RULE }}
            priority
          />
          <figcaption className="px-1 pb-0.5 pt-2.5 text-[13px] leading-[1.45]" style={{ color: INK3 }}>
            {FICTIONAL_CASE_CAPTION}
          </figcaption>
        </figure>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          <div>
            <H3>1 · Patient</H3>
            <p className="mt-2" style={{ color: INK2 }}>
              Age, weight, height, serum creatinine and renal replacement status. Estimated creatinine
              clearance is shown for context; the dose is calculated from serum creatinine as the{" "}
              {COLIN_2019.shortName} covariate.
            </p>
          </div>
          <div>
            <H3>2 · Recommendation</H3>
            <p className="mt-2" style={{ color: INK2 }}>
              Dose, interval and infusion duration. AUC₂₄ is compared with the 400–600 mg·h/L target; peak and trough are reported separately. Relevant cautions appear below the recommendation.
            </p>
          </div>
          <div>
            <H3>3 · Alternatives and parameters</H3>
            <p className="mt-2" style={{ color: INK2 }}>
              Other regimens computed from the same parameters, the four PK parameters, the method, and
              a note you can copy into the chart.
            </p>
          </div>
        </div>
      </Section>

      {/* ── SYNTHETIC EXAMPLE (computed by the engine, labelled) ── */}
      <Section label="Synthetic example" note="Computed by the current calculator from stated inputs; not a patient.">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
          <div>
            <H2>What a starting-regimen comparison looks like</H2>
            <p className="mt-2.5 max-w-[60ch] text-lg" style={{ color: INK2 }}>
              The table is produced by the same calculation method as the application for a stated set
              of synthetic inputs. It is an illustration of the output, not evidence of clinical
              validation, and the regimens are not for use with a patient.
            </p>
          </div>
          <SyntheticExample />
        </div>
      </Section>

      {/* ── CAPABILITIES ───────────────────────────────────── */}
      <Section label="What it does" note="For adults receiving intermittent intravenous vancomycin.">
        <H2>From the first dose to level-guided adjustment</H2>
        <dl className="mt-7 grid gap-x-10 gap-y-7 md:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="border-t pt-4" style={{ borderTopColor: RULE }}>
              <dt className="text-[17px] font-semibold" style={{ color: INK }}>{c.title}</dt>
              <dd className="mt-1.5 text-[15.5px] leading-relaxed" style={{ color: INK2 }}>
                {c.body}
                {c.source && (
                  <span className="mt-2 block text-[13px]" style={{ color: INK3 }}>{c.source}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── EVIDENCE STATUS ────────────────────────────────── */}
      <Section id="evidence" label="Evidence status" note="What has been checked, by whom, and what has not.">
        <H2>Review the evidence before you rely on it</H2>
        <p className="mb-6 mt-2.5 max-w-[60ch] text-xl leading-[1.5]" style={{ color: INK2 }}>
          Method pages document the model equations, assumptions and sources. Vancomyzer has not yet
          been validated in real patients; published model evidence and developer-run checks are not
          independent validation. This table keeps them apart, and every row links to the full record.
        </p>
        <div className="overflow-x-auto" tabIndex={0} aria-label="Evidence status table; scrolls horizontally on small screens">
          <table className="vz-ledger">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">What it covers</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {EVIDENCE_STATUS.map((r) => (
                <tr key={r.item}>
                  <td className="whitespace-nowrap font-semibold">
                    <Link href={r.href} className="underline underline-offset-2" style={{ color: INK }}>
                      {r.item}
                    </Link>
                  </td>
                  <td style={{ color: INK2 }}>{r.covers}</td>
                  <td><Chip kind={r.kind}>{r.status}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-[30px] flex flex-wrap gap-3">
          <Link href="/transparent-dosing" className="vz-mbtn vz-mbtn--outline">Methods, equations and published checks</Link>
          <Link href="/faq" className="vz-mbtn vz-mbtn--outline">Frequently asked questions</Link>
        </div>
      </Section>

      {/* ── SCOPE ──────────────────────────────────────────── */}
      <Section label="Scope" note="Who it is for, and where it does not apply.">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <H3>Designed for</H3>
            <p className="mt-2" style={{ color: INK2 }}>
              Adults (18 years and older) receiving intermittent intravenous vancomycin.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Intended users">
              {AUDIENCE.map((a) => (
                <li key={a} className="border px-3 py-1.5 text-sm font-medium" style={{ borderColor: RULE, background: "#ffffff", color: INK }}>
                  {a}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: INK2 }}>
              Intended for qualified healthcare professionals and clinical trainees. Every
              recommendation must be independently reviewed by a licensed clinician before any change
              to therapy. Not intended for patients or caregivers.
            </p>
          </div>
          <div>
            <H3>Not designed for</H3>
            <ul className="mt-3 grid gap-2.5">
              {NOT_FOR.map((item) => (
                <li key={item} className="flex gap-2.5 text-base leading-relaxed" style={{ color: INK }}>
                  <span aria-hidden="true" style={{ color: "#a32d2d", fontWeight: 700 }}>✕</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: INK2 }}>
              Recommendations are withheld when renal replacement therapy is selected. Continuous
              infusion and pediatric dosing use different models and are out of scope.
            </p>
          </div>
        </div>
      </Section>

      {/* ── PRICING + REGULATORY ───────────────────────────── */}
      <Section label="Pricing" note="Free for individual clinicians; site licences by bed count." last>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div>
            <H2>Open the calculator</H2>
            <p className="mt-2.5 max-w-[60ch] text-lg" style={{ color: INK2 }}>{LAUNCH_LINE}</p>
          </div>
          <div className="flex flex-wrap gap-3 md:flex-col">
            <OpenCalculatorButton source="landing_closing" className="vz-mbtn vz-mbtn--primary">
              Open the calculator
            </OpenCalculatorButton>
            {OPEN_ACCESS ? (
              <Link href="/pricing" className="vz-mbtn vz-mbtn--outline">Hospital Site licenses</Link>
            ) : (
              <Link href="/register" className="vz-mbtn vz-mbtn--outline">Create a free account</Link>
            )}
          </div>
        </div>

        {/* Regulatory statement — approved long-form wording (15 Sep 2026); RegulatoryFooter carries the short form. */}
        <div className="mt-10 border bg-white px-[18px] py-4" style={{ borderColor: RULE }}>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: INK }}>
            Regulatory status
          </span>
          <p className="text-sm leading-relaxed" style={{ color: INK2 }}>
            Vancomyzer&trade; is designed to meet the criteria for non-device clinical decision support
            in section 520(o)(1)(E) of the Federal Food, Drug, and Cosmetic Act (added by section 3060
            of the 21st Century Cures Act). It has not been cleared, approved or otherwise reviewed by
            the FDA. It is intended for licensed healthcare professionals, who must independently review
            the basis for each recommendation. It supports, and does not replace, clinical judgment:
            review every recommendation against the patient&rsquo;s clinical status, institutional
            protocols and therapeutic drug monitoring before any change to therapy.
          </p>
          <Link
            href="/disclaimer"
            className="mt-3 inline-block text-sm font-semibold underline underline-offset-2"
            style={{ color: ACTION }}
          >
            Read the full medical disclaimer
          </Link>
        </div>
      </Section>
    </div>
  );
}
