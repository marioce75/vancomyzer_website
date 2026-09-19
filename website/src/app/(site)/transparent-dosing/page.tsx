import type { Metadata } from "next";
import Link from "next/link";
import { OPEN_ACCESS } from "@/lib/openAccess";
import {
  COLIN_2019,
} from "@/lib/pk/modelRegistry";

export const metadata: Metadata = {
  title: "Transparent Dosing — Vancomyzer™",
  description:
    "Vancomyzer is a transparent Bayesian vancomycin dosing calculator: the model, the priors and an illustrative uncertainty band are shown in the open, with every equation documented and cited.",
  openGraph: {
    title: "Transparent Vancomycin Dosing — Vancomyzer™",
    description:
      "Every equation and every prior is documented in the open, with an illustrative uncertainty band on the concentration-time graph. Free for clinicians.",
    type: "website",
    url: "https://vancomyzer.com/transparent-dosing",
    siteName: "Vancomyzer™",
  },
  twitter: {
    card: "summary_large_image",
    title: "Transparent Vancomycin Dosing — Vancomyzer™",
    description:
      "The math behind your dose decisions should be auditable, not just trusted.",
  },
};

const PRINCIPLES = [
  {
    n: "01",
    title: "Show the math.",
    body:
      `The calculator shows the equations, starting estimates and reasons behind each result. Vancomyzer shows its reasoning, not just its result. We show the ${COLIN_2019.shortName} covariate equations next to your patient's estimated clearance (CL). For each Bayesian estimate, we show the difference between the measured and predicted drug level. Turn on Teaching Mode and you get plain-language pharmacokinetic explanations alongside each result.`,
  },
  {
    n: "02",
    title: "Honest uncertainty.",
    body:
      "When the available measurements leave uncertainty, the calculator shows it — with an illustrative uncertainty band around the predicted concentration-time curve, not a statistical confidence, credible or prediction interval, and not a falsely confident single line. The band widens when no level is fit, narrows when two coherent levels are in. We'd rather be visibly humble than invisibly wrong.",
  },
  {
    n: "03",
    title: "The prior is published, peer-reviewed, and pooled from 14 studies.",
    body:
      `${COLIN_2019.citation} ${COLIN_2019.sourcePopulation} Vancomyzer shows the model, assumptions and evidence behind each estimate.`,
  },
  {
    n: "04",
    title: "Free for the people who need it most.",
    body:
      "Pharmacy students, residents, individual clinicians: the full calculator is free, permanently. Institutional plans add workflow features for hospitals and health systems — team audit logs are live today; EMR/EHR integration, SSO, custom branding and a Business Associate Agreement are not yet available. None of it changes the math clinicians rely on.",
  },
  {
    n: "05",
    title: "Bayesian, not magic.",
    body:
      "Posterior MAP estimation with log-normal prior penalties on every PK parameter. A single observation cannot override decades of population-PK data — this is an intentional safeguard. When the fit can't explain a measured level within ~25% relative error, the calculator displays a Fit Quality Advisory and tells you to draw a confirmatory level. It does not silently loosen the prior to make the curve pass through the dot.",
  },
  {
    n: "06",
    title: "Open methodology.",
    body:
      "The Colin 2019 equations and parameter values shown throughout this site are drawn from the same set of model equations and values used by the calculator. Every model, every parameter, every safety guardrail is documented with its primary citation. The limits on pediatric use, dialysis and continuous infusion are stated explicitly because Vancomyzer is not designed for those populations, not because we're saving features for an upgrade tier.",
  },
];

const ANTI_PROMISES = [
  "We will not claim FDA clearance we don't have. Vancomyzer™ is not FDA-cleared or approved; it is designed to meet the non-device clinical decision support criteria of FD&C Act §520(o)(1)(E). The disclaimer on every page is real, not legal noise.",
  "We will not fit your patient on a single outlier level by quietly loosening the prior. The fit is bounded; the residual is shown; the advisory tells you when to draw another level.",
  "We will not pretend the calculator works for pediatrics, dialysis, continuous infusion, or extreme renal failure until those subpopulations have been validated and made available with appropriate safety checks.",
  "Basic AUC-guided dosing will not require a hospital contract. Every plan uses the same calculation method; paid plans add workflow features such as PDF export, notes, calculation history and team audit logs.",
  "We will not replace clinician judgment. Every recommendation comes with the math, the residuals, and the assumptions so a pharmacist can override it with full context.",
];

const SOURCES = [
  {
    label: COLIN_2019.displayName,
    citation: COLIN_2019.citation,
    doi: COLIN_2019.doi,
    note: "Default adult prior, used for every adult at any body size. CC BY-NC.",
  },
  {
    label: "Janmahasatian S et al. — Quantification of lean bodyweight (FFM equations)",
    citation: "Clin Pharmacokinet. 2005;44(10):1051-1065.",
    doi: "10.2165/00003088-200544100-00004",
    note: "Fat-free mass is displayed for clinical context; it does not change the Colin 2019 calculation.",
  },
  {
    label: "Rybak MJ et al. — Therapeutic monitoring of vancomycin (ASHP/IDSA/PIDS/SIDP 2020)",
    citation: "Am J Health Syst Pharm. 2020;77(11):835-864.",
    doi: "10.1093/ajhp/zxaa036",
    note: "AUC-guided dosing target (400–600 mg·h/L) source guideline.",
  },
];

export default function TransparentDosingPage() {
  return (
    <main style={{ background: "#f8fafc", color: "#0f172a" }}>
      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="manifesto-dark px-6 py-20 sm:py-28" style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" }}>
        <div className="mx-auto max-w-4xl">
          <p
            className="mb-6 text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: "#00c9b1" }}
          >
            Transparent Dosing — A Position
          </p>
          <h1
            className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl"
            style={{ color: "#ffffff" }}
          >
            Show the model. Show the evidence. Show the uncertainty.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed sm:text-xl" style={{ color: "#cbd5e1" }}>
            Vancomyzer&trade; is a transparent Bayesian dosing calculator for clinical pharmacists.
            Every equation and every prior is in the open, with an illustrative uncertainty band
            — because the math behind your dose decisions should be auditable, not just trusted.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href={OPEN_ACCESS ? "/calculator" : "/register"}
              className="cta-primary inline-block rounded-md px-6 py-3 text-center text-sm font-bold uppercase tracking-wider transition"
              style={{ background: "#00c9b1", color: "#0f172a", letterSpacing: "0.08em" }}
            >
              Try Vancomyzer free →
            </Link>
            <Link
              href="/faq"
              className="cta-outline inline-block rounded-md border-2 px-6 py-3 text-center text-sm font-bold uppercase tracking-wider transition"
              style={{ borderColor: "#cbd5e1", color: "#ffffff", letterSpacing: "0.08em" }}
            >
              Read the methods →
            </Link>
          </div>
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ──────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0f172a" }}>
            Not every vancomycin dosing tool shows its work.
          </h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed sm:text-lg" style={{ color: "#334155" }}>
            <p>
              Some tools produce a confident dose recommendation without showing the prior they
              used, the math they ran, the residual on the fit, or the evidence behind the model
              — so a clinician has no way to check the reasoning before it reaches a patient.
            </p>
            <p>
              Commercial platforms offer capabilities such as EHR integration, population-specific
              models and implementation support; compare options against your own institution&rsquo;s
              needs. Vancomyzer takes a transparency-first approach to the same problem: it shows
              the model, the assumptions and the evidence behind each estimate.
            </p>
            <p>
              The math is in the open. The {COLIN_2019.shortName} prior is documented with its
              primary citation. An illustrative uncertainty band shows how much the fit can and
              cannot say about your patient. The Bayesian fit is explained inline, in plain
              language, when you turn on Teaching Mode. And the calculator is free for individual
              clinicians, permanently.
            </p>
          </div>
        </div>
      </section>

      {/* ── PRINCIPLES ─────────────────────────────────────── */}
      <section className="px-6 py-20" style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0f172a" }}>
            What we believe
          </h2>
          <p className="mt-3 text-sm" style={{ color: "#64748b" }}>
            Six commitments that shape every calculation.
          </p>
          <div className="mt-12 space-y-12">
            {PRINCIPLES.map((p) => (
              <div key={p.n} className="grid gap-4 sm:grid-cols-[80px_1fr] sm:gap-8">
                <div
                  className="text-3xl font-extrabold"
                  style={{ color: "#00c9b1", fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {p.n}
                </div>
                <div>
                  <h3 className="text-xl font-bold leading-tight" style={{ color: "#0f172a" }}>
                    {p.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed" style={{ color: "#334155" }}>
                    {p.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE MATH, EXPOSED ───────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0f172a" }}>
            The math, exposed.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: "#334155" }}>
            Here&rsquo;s the actual {COLIN_2019.shortName} clearance equation Vancomyzer uses for
            your patient, shown here rather than computed out of view.
          </p>

          <pre
            className="mt-8 overflow-x-auto rounded-lg p-6 text-xs leading-relaxed sm:text-sm"
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.7,
            }}
          >
            <span style={{ color: "#94a3b8" }}>{"Vancomycin clearance (CL) — Colin 2019, two-compartment model"}</span>
            {"\n"}
            <span style={{ color: "#94a3b8" }}>{"Source: Clin Pharmacokinet. 2019;58(6):767-780, Table 3"}</span>
            {"\n\n"}
            <span style={{ color: "#00c9b1" }}>CL</span>
            {" = θ·CL  ×  (weight / 70)"}
            <span style={{ color: "#fbbf24" }}>{"^0.75"}</span>
            {"        "}
            <span style={{ color: "#94a3b8" }}>{"← size (weight) scaling"}</span>
            {"\n           ×  "}
            <span style={{ color: "#fbbf24" }}>F·maturation</span>
            {"             "}
            <span style={{ color: "#94a3b8" }}>{"← ≈ 1.0 in adults"}</span>
            {"\n           ×  "}
            <span style={{ color: "#fbbf24" }}>F·age-decline</span>
            {"            "}
            <span style={{ color: "#94a3b8" }}>{"← 50% lower by age 61.6 yr"}</span>
            {"\n           ×  "}
            <span style={{ color: "#fbbf24" }}>F·creatinine</span>
            {"             "}
            <span style={{ color: "#94a3b8" }}>{"← serum creatinine effect"}</span>
          </pre>

          <p className="mt-8 max-w-2xl text-base leading-relaxed" style={{ color: "#334155" }}>
            And the Bayesian step, in plain terms:
          </p>

          <pre
            className="mt-4 overflow-x-auto rounded-lg p-6 text-xs leading-relaxed sm:text-sm"
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.7,
            }}
          >
            <span style={{ color: "#94a3b8" }}>{"Individualized estimate  =  the population starting estimate,"}</span>
            {"\n"}
            <span style={{ color: "#94a3b8" }}>{"                            adjusted to best fit your patient's"}</span>
            {"\n"}
            <span style={{ color: "#94a3b8" }}>{"                            measured vancomycin levels."}</span>
            {"\n\n"}
            <span style={{ color: "#94a3b8" }}>{"It is bounded: one unusual level cannot override the"}</span>
            {"\n"}
            <span style={{ color: "#94a3b8" }}>{"population data — it only nudges the estimate."}</span>
          </pre>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed" style={{ color: "#64748b" }}>
            That&rsquo;s the entire approach. Nothing is hidden and nothing is withheld.
            Any clinician trained in pharmacokinetics can review exactly how it works. That is the point.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/transparent-dosing/equations"
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition"
              style={{
                background: "#0f172a",
                color: "#00c9b1",
                border: "1px solid #1e293b",
                letterSpacing: "0.08em",
              }}
            >
              ▶ Full derivations &amp; equations
            </Link>
            <Link
              href="/transparent-dosing/cases"
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition"
              style={{
                background: "#0f172a",
                color: "#00c9b1",
                border: "1px solid #1e293b",
                letterSpacing: "0.08em",
              }}
            >
              ▶ Literature reproducibility
            </Link>
            <Link
              href="/transparent-dosing/predictive-performance"
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition"
              style={{
                background: "#0f172a",
                color: "#00c9b1",
                border: "1px solid #1e293b",
                letterSpacing: "0.08em",
              }}
            >
              ▶ Predictive performance
            </Link>
            <Link
              href="/transparent-dosing/engine-crosscheck"
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition"
              style={{
                background: "#0f172a",
                color: "#00c9b1",
                border: "1px solid #1e293b",
                letterSpacing: "0.08em",
              }}
            >
              ▶ Engine cross-check
            </Link>
          </div>
          <p className="mt-3 text-xs" style={{ color: "#64748b" }}>
            Literature Reproducibility lists the published vancomycin cases we run through the
            calculator: the Colin 2019 cases are pass/fail reproductions of the same model, and
            cases built on other published models are shown for context only, not as pass/fail tests. Predictive Performance and Engine Cross-Check are developer-run
            synthetic analyses, not real-patient validation. Predictive Performance compares
            Vancomyzer against 200 synthetic ICU patients generated from a different published
            model. Engine Cross-Check compares Vancomyzer against Tucuxi, a separately built
            dosing program, when both are given the same priors — a reproducible run scored against
            pre-set criteria (18 Sep 2026), with the earlier snapshot retained.
          </p>
        </div>
      </section>

      {/* ── WHERE THE DATA COMES FROM ──────────────────────── */}
      <section className="px-6 py-20" style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0f172a" }}>
            Where the data comes from.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: "#334155" }}>
            One of the more common arguments against free Bayesian tools is that they rely on too few
            studies — that priors derived from one study per subpopulation are statistically fragile.
            The argument is correct as stated. It is also not what Vancomyzer does.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "#334155" }}>
            Our default adult prior is {COLIN_2019.shortName}, itself a <strong>pooled population PK
            analysis of data from 14 studies</strong> (2,554 individuals), spanning neonates
            through elderly adults. Vancomyzer shows the model, assumptions and evidence behind each
            estimate.
          </p>

          <div className="mt-10 space-y-5">
            {SOURCES.map((s) => (
              <div
                key={s.doi}
                className="rounded-md border p-5"
                style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}
              >
                <p className="text-sm font-bold leading-snug" style={{ color: "#0f172a" }}>
                  {s.label}
                </p>
                <p className="mt-1 text-xs" style={{ color: "#64748b" }}>
                  {s.citation}
                </p>
                <p className="mt-2 text-sm" style={{ color: "#334155" }}>
                  {s.note}
                </p>
                <a
                  href={`https://doi.org/${s.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-mono"
                  style={{ color: "#00c9b1" }}
                >
                  doi:{s.doi} ↗
                </a>
              </div>
            ))}
          </div>

          <p className="mt-10 max-w-2xl text-sm leading-relaxed" style={{ color: "#64748b" }}>
            The {COLIN_2019.shortName} population model is used throughout the supported adult workflow.
            Published evaluation at BMI 40 or more is limited (Colin 2021: 15 of 49 obese adults).
            Review measured levels and the stated assumptions before making a dosing decision.
          </p>
        </div>
      </section>

      {/* ── ANTI-PROMISES ──────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0f172a" }}>
            What we won&rsquo;t do.
          </h2>
          <p className="mt-3 text-base leading-relaxed" style={{ color: "#334155" }}>
            Promises about what a tool <em>does</em> are easy. Promises about what it <em>refuses to do</em> are
            where the safety actually lives.
          </p>
          <ul className="mt-8 space-y-5">
            {ANTI_PROMISES.map((promise, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-md border-l-4 p-4"
                style={{ borderColor: "#dc2626", background: "#fef2f2" }}
              >
                <span style={{ color: "#dc2626", fontWeight: 700, flexShrink: 0 }}>✕</span>
                <p className="text-base leading-relaxed" style={{ color: "#334155" }}>
                  {promise}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="manifesto-dark px-6 py-20" style={{ background: "#0f172a", color: "#ffffff" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: "#ffffff" }}>
            Open the calculator.
          </h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: "#cbd5e1" }}>
            Free for individual clinicians, permanently. No credit card. The full calculator, the{" "}
            {COLIN_2019.shortName} model, an illustrative uncertainty band — all of it, shown in the
            open.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href={OPEN_ACCESS ? "/calculator" : "/register"}
              className="cta-primary inline-block rounded-md px-8 py-3 text-sm font-bold uppercase tracking-wider transition"
              style={{ background: "#00c9b1", color: "#0f172a", letterSpacing: "0.08em" }}
            >
              Start free →
            </Link>
            <Link
              href="/pricing"
              className="cta-outline inline-block rounded-md border-2 px-8 py-3 text-sm font-bold uppercase tracking-wider transition"
              style={{ borderColor: "#cbd5e1", color: "#ffffff", letterSpacing: "0.08em" }}
            >
              See pricing
            </Link>
          </div>
          <p className="mt-10 text-xs" style={{ color: "#64748b" }}>
            Vancomyzer&trade; is a clinical decision-support tool for qualified healthcare
            professionals only. Not FDA-cleared or approved. Designed to meet the non-device
            clinical decision support criteria of FD&amp;C Act §520(o)(1)(E); not reviewed by
            the FDA. Engineered by{" "}
            <a href="https://dosys.health" target="_blank" rel="noopener noreferrer" style={{ color: "#00c9b1" }}>
              Dōsys&trade;
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
