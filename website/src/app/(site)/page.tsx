import type { Metadata } from "next";
import Link from "next/link";
import OpenCalculatorButton from "@/components/landing/OpenCalculatorButton";
import AucCurveIllustration from "@/components/landing/AucCurveIllustration";
import { OPEN_ACCESS } from "@/lib/openAccess";
import {
  COLIN_2019,
  COLIN_2021_OBESE_EVALUATION,
  HIGH_BMI_THRESHOLD_KG_M2,
} from "@/lib/pk/modelRegistry";

/**
 * Public landing page at "/".
 *
 * Lives in the (site) route group so it gets the marketing Header + Footer.
 * The calculator itself is at /calculator (src/app/calculator/page.tsx).
 *
 * Styling notes: the app always runs the basic theme, which forces h1–h3
 * colours and inline font-families. Dark bands therefore use the shared
 * `.manifesto-dark` / `.cta-primary` / `.cta-outline` classes (globals.css),
 * accent text inside them uses <span> rather than <p>, and colours are
 * inline styles or arbitrary Tailwind values (named slate/gray utilities are
 * remapped globally).
 *
 * Copy rules: plain clinical language; no invented statistics, testimonials
 * or outcome claims; cited facts only (published sources already referenced
 * on /transparent-dosing). Model names and citations come from
 * @/lib/pk/modelRegistry. Validation, regulatory and pricing wording follows
 * the approved wording bank from the 15 Sep 2026 review remediation. The
 * launch-period line follows OPEN_ACCESS so the page stays truthful when the
 * switch is turned off.
 */

export const metadata: Metadata = {
  title: "Vancomycin AUC Dosing Calculator — Free Bayesian Dosing Support | Vancomyzer™",
  description:
    `Free Bayesian, AUC-guided vancomycin dosing calculator for pharmacists, physicians and other clinicians. Empiric dosing from patient characteristics, refinement with one or two measured levels, the ${COLIN_2019.shortName} population model for all adults with a high-BMI advisory, and AUC24 targets aligned with the 2020 ASHP/IDSA/PIDS/SIDP consensus guideline.`,
  openGraph: {
    title: "Vancomyzer™ — Free Bayesian Vancomycin AUC Dosing Calculator",
    description:
      "AUC-guided vancomycin dosing support for clinicians: empiric regimens, refinement with one or two measured levels, and every model and equation documented in the open.",
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
      `${COLIN_2019.shortName} is used throughout the supported adult workflow. At a BMI of ${HIGH_BMI_THRESHOLD_KG_M2} kg/m² or higher, an advisory notes that published evaluation at that size is limited, and fat-free mass and alternative creatinine-clearance estimates are shown for context only. They do not change the calculation.`,
    source: COLIN_2021_OBESE_EVALUATION.citation,
  },
  {
    title: "Built-in safety checks",
    body:
      "Infusions are kept to a maximum rate of 10 mg/min and at least 60 minutes. Recommendations are withheld for dialysis or renal replacement therapy, and warnings flag severely reduced kidney function, questionable level timing and a poor fit to measured levels.",
  },
];

const EVIDENCE_LINKS = [
  {
    href: "/transparent-dosing",
    title: "Transparent Dosing",
    body: "Our approach in plain terms: the models, the published sources behind them, and what the calculator will not do.",
  },
  {
    href: "/transparent-dosing/equations",
    title: "Equations & Derivations",
    body: "The full equations behind every calculation, each with its primary citation.",
  },
  {
    href: "/transparent-dosing/cases",
    title: "Literature Reproducibility",
    body: "Published vancomycin cases run through the calculator. Same-model Colin 2019 reproductions are pass/fail; cases from other published models are shown for context only.",
  },
  {
    href: "/transparent-dosing/predictive-performance",
    title: "Predictive Performance",
    body: "A developer-run synthetic analysis (not real patients): predictions compared with simulated ICU patients generated from a different published model.",
  },
  {
    href: "/transparent-dosing/engine-crosscheck",
    title: "Engine Cross-Check",
    body: "A developer-run synthetic analysis (not real patients): our individualized estimates compared with Tucuxi, a separately built dosing program given the same priors, scored against pre-set acceptance criteria.",
  },
  {
    href: "/faq",
    title: "Frequently Asked Questions",
    body: "Inputs, methods, limitations and common clinical questions.",
  },
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

// Staggered hero entrance, disabled for reduced-motion users.
const PAGE_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .vz-rise { animation: vz-rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
  .vz-d1 { animation-delay: 0.05s; }
  .vz-d2 { animation-delay: 0.15s; }
  .vz-d3 { animation-delay: 0.25s; }
  .vz-d4 { animation-delay: 0.35s; }
}
@keyframes vz-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
`;

const CTA_PRIMARY_CLASS =
  "cta-primary inline-flex items-center justify-center gap-2 rounded-md px-7 py-3.5 text-sm font-bold uppercase tracking-wider transition hover:brightness-110";
const CTA_PRIMARY_STYLE = { background: "#00c9b1", color: "#0f172a", letterSpacing: "0.08em" };
const CTA_OUTLINE_CLASS =
  "cta-outline inline-flex items-center justify-center rounded-md border-2 px-7 py-3.5 text-center text-sm font-bold uppercase tracking-wider transition";
const CTA_OUTLINE_STYLE = { borderColor: "#cbd5e1", color: "#ffffff", letterSpacing: "0.08em" };

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className="block text-xs font-bold uppercase tracking-[0.18em]"
      style={{ color: dark ? "#00c9b1" : "#0f766e" }}
    >
      {children}
    </span>
  );
}

export default function LandingPage() {
  return (
    <div style={{ background: "#f8fafc", color: "#0f172a" }}>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section
        className="manifesto-dark relative overflow-hidden px-6 py-16 sm:py-24"
        style={{
          background:
            "radial-gradient(900px 480px at 88% -8%, rgba(0,201,177,0.16), transparent 62%), linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        {/* Faint chart-paper grid behind the hero */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            WebkitMaskImage: "radial-gradient(ellipse at 70% 35%, #000 15%, transparent 70%)",
            maskImage: "radial-gradient(ellipse at 70% 35%, #000 15%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="vz-rise vz-d1 mb-5">
              <Eyebrow dark>Vancomycin dosing support for clinicians</Eyebrow>
            </div>
            <h1
              className="vz-rise vz-d2 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl"
              style={{ color: "#ffffff" }}
            >
              Bayesian, AUC-guided vancomycin dosing{" "}
              <span style={{ color: "#00c9b1" }}>— free for clinicians.</span>
            </h1>
            <p
              className="vz-rise vz-d3 mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
              style={{ color: "#cbd5e1" }}
            >
              Start with an empiric regimen built from your patient&rsquo;s characteristics, then
              refine it with one or two measured levels. Targets follow the 2020 ASHP/IDSA/PIDS/SIDP
              consensus guideline, and the model, assumptions and limitations are shown with every
              result.
            </p>

            <p className="vz-rise vz-d4 mt-5 text-sm font-semibold sm:text-base" style={{ color: "#e2e8f0" }}>
              Adults receiving intermittent IV vancomycin only. For clinician review.
              Independent clinical validation is pending.
            </p>

            <div className="vz-rise vz-d4 mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <OpenCalculatorButton source="landing_hero" className={CTA_PRIMARY_CLASS} style={CTA_PRIMARY_STYLE}>
                Open Calculator <span aria-hidden="true">→</span>
              </OpenCalculatorButton>
              <Link href="/transparent-dosing" className={CTA_OUTLINE_CLASS} style={CTA_OUTLINE_STYLE}>
                See how it works
              </Link>
            </div>

            <div className="vz-rise vz-d4 mt-6 flex items-start gap-2.5">
              <svg
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00c9b1"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-semibold sm:text-base" style={{ color: "#e2e8f0" }}>
                {LAUNCH_LINE}
              </span>
            </div>
          </div>

          {/* Illustration is decorative context; phones keep the hero focused on the action. */}
          <div className="vz-rise vz-d3 hidden sm:block">
            <AucCurveIllustration />
          </div>
        </div>
      </section>

      {/* ── CAPABILITIES ───────────────────────────────────── */}
      <section className="px-6 py-16 sm:py-20" style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <Eyebrow>What it does</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0f172a" }}>
              From the first dose to level-guided adjustment.
            </h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "#334155" }}>
              Clinical decision support for adults receiving intermittent intravenous vancomycin, built
              on published models and guideline targets.
            </p>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c, i) => (
              <li
                key={c.title}
                className="flex flex-col rounded-lg border p-6"
                style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}
              >
                <span className="font-mono text-sm font-bold text-[#0f766e]">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-lg font-bold leading-snug" style={{ color: "#0f172a" }}>
                  {c.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: "#334155" }}>
                  {c.body}
                </p>
                {c.source && (
                  <span
                    className="mt-4 block border-t pt-3 text-xs"
                    style={{ borderTopColor: "#e2e8f0", color: "#64748b" }}
                  >
                    {c.source}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── EVIDENCE / TRUST ───────────────────────────────── */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Eyebrow>Check our work</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0f172a" }}>
              Review the evidence before you rely on it.
            </h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "#334155" }}>
              Every model, equation and published source is documented. Vancomyzer has not yet been
              validated in real patients. Its equations are checked against published values and
              synthetic test cases; external validation with patient data is planned. The results of
              those developer-run checks are public.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {EVIDENCE_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="group flex h-full flex-col rounded-lg border border-[#e2e8f0] bg-[#ffffff] p-5 transition hover:border-[#0d9488]"
                >
                  <span className="flex items-center justify-between gap-3 text-base font-bold text-[#0f172a]">
                    {l.title}
                    <span aria-hidden="true" className="text-[#0f766e] transition group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-[#475569]">{l.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── WHO IT'S FOR + SCOPE ───────────────────────────── */}
      <section
        className="px-6 py-16 sm:py-20"
        style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Who it&rsquo;s for</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0f172a" }}>
              Built for the clinicians who dose and monitor vancomycin.
            </h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {AUDIENCE.map((a) => (
                <li
                  key={a}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium"
                  style={{ borderColor: "#99f6e4", background: "#f0fdfa", color: "#115e59" }}
                >
                  {a}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed" style={{ color: "#475569" }}>
              Intended for qualified healthcare professionals and clinical trainees. Every
              recommendation must be independently reviewed by a licensed clinician before any change
              to therapy. Not intended for patients or caregivers.
            </p>
          </div>

          <div>
            <Eyebrow>Scope and limitations</Eyebrow>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0f172a" }}>
              Know where it applies.
            </h2>
            <div className="mt-6 rounded-md border-l-4 p-5" style={{ borderLeftColor: "#0d9488", background: "#f0fdfa" }}>
              <span className="block text-sm font-bold" style={{ color: "#115e59" }}>
                Designed for
              </span>
              <span className="mt-1 block text-base leading-relaxed" style={{ color: "#334155" }}>
                Adults (18 years and older) receiving intermittent intravenous vancomycin.
              </span>
            </div>
            <div className="mt-4 rounded-md border-l-4 p-5" style={{ borderLeftColor: "#dc2626", background: "#fef2f2" }}>
              <span className="block text-sm font-bold" style={{ color: "#991b1b" }}>
                Not designed for
              </span>
              <ul className="mt-2 space-y-1.5">
                {NOT_FOR.map((item) => (
                  <li key={item} className="flex gap-2.5 text-base leading-relaxed" style={{ color: "#334155" }}>
                    <span aria-hidden="true" style={{ color: "#dc2626", fontWeight: 700 }}>
                      ✕
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Regulatory statement — approved long-form wording (15 Sep 2026); RegulatoryFooter carries the short form. */}
        <div
          className="mx-auto mt-12 max-w-6xl rounded-lg border p-6"
          style={{ borderColor: "#cbd5e1", background: "#f8fafc" }}
        >
          <span className="block text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#475569" }}>
            Regulatory status
          </span>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "#334155" }}>
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
            style={{ color: "#0f766e" }}
          >
            Read the full medical disclaimer →
          </Link>
        </div>
      </section>

      {/* ── CLOSING CTA ────────────────────────────────────── */}
      <section className="manifesto-dark px-6 py-16 sm:py-20" style={{ background: "#0f172a" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: "#ffffff" }}>
            Open the calculator.
          </h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: "#cbd5e1" }}>
            {LAUNCH_LINE}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <OpenCalculatorButton source="landing_closing" className={CTA_PRIMARY_CLASS} style={CTA_PRIMARY_STYLE}>
              Open Calculator <span aria-hidden="true">→</span>
            </OpenCalculatorButton>
            {OPEN_ACCESS ? (
              <Link href="/pricing" className={CTA_OUTLINE_CLASS} style={CTA_OUTLINE_STYLE}>
                Department &amp; hospital plans
              </Link>
            ) : (
              <Link href="/register" className={CTA_OUTLINE_CLASS} style={CTA_OUTLINE_STYLE}>
                Create a free account
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
