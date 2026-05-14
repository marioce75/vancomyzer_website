import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Transparent Dosing — Vancomyzer™",
  description:
    "Vancomycin dosing should not be a black box. Vancomyzer is a transparent Bayesian dosing calculator built on the same Colin 2019 pooled prior the commercial tools use — with the math, the priors, and the confidence band in the open.",
  openGraph: {
    title: "Transparent Vancomycin Dosing — Vancomyzer™",
    description:
      "Every equation, every prior, every confidence interval is in the open. Free for clinicians.",
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
      "Every equation, every prior, every fit decision is visible in the UI. No clinical decision-support tool that hides its reasoning belongs in a pharmacy workflow. We render the Colin 2019 covariate equations next to your patient's computed CL. We show the residual on every Bayesian fit. Turn on Teaching Mode and you get plain-language PK explanations inline with each result.",
  },
  {
    n: "02",
    title: "Honest uncertainty.",
    body:
      "When the data can't constrain the answer, the UI says so — with an explicit confidence band on the concentration-time graph, not a confident-looking line. The band widens when no level is fit, narrows when two coherent levels are in. We'd rather be visibly humble than invisibly wrong.",
  },
  {
    n: "03",
    title: "The prior is published, peer-reviewed, and pooled from 14 studies.",
    body:
      "Not four. Not five. Not proprietary. Colin PJ et al, Clinical Pharmacokinetics 58:767–780, 2019: a pooled population PK analysis across 14 published vancomycin studies, n=2,554 patients, 8,303 measured concentrations, neonates through elderly. CC BY-NC. The same prior the commercial vendors quietly build on — we just tell you.",
  },
  {
    n: "04",
    title: "Free for the people who need it most.",
    body:
      "Pharmacy students, residents, individual clinicians: the full calculator is free, forever. Hospital tier exists for institutions that need EMR integration, audit logs, custom branding, and a Business Associate Agreement — not for the math itself. Basic dosing safety isn't gated behind a $50,000 contract.",
  },
  {
    n: "05",
    title: "Bayesian, not magic.",
    body:
      "Posterior MAP estimation with log-normal prior penalties on every PK parameter. A single observation cannot override decades of population-PK data — that's a feature, not a bug. When the fit can't explain a measured level within ~25% relative error, the UI surfaces a Fit Quality Advisory and tells you to draw a confirmatory level. It does not silently loosen the prior to make the curve pass through the dot.",
  },
  {
    n: "06",
    title: "Open methodology.",
    body:
      "The math you see in the FAQ is the math in the engine. Every model, every parameter, every safety guardrail is documented with its primary citation. The pediatric clamp, dialysis exclusion, and continuous-infusion exclusion are explicit because they haven't been validated, not because we're saving features for an upgrade tier.",
  },
];

const ANTI_PROMISES = [
  "We will not claim FDA clearance we don't have. Vancomyzer is non-device clinical decision support under 21st Century Cures Act §3060, scoped accordingly. The disclaimer on every page is real, not legal noise.",
  "We will not fit your patient on a single outlier level by quietly loosening the prior. The fit is bounded; the residual is shown; the advisory tells you when to draw another level.",
  "We will not pretend the calculator works for pediatrics, dialysis, continuous infusion, or extreme renal failure until those subpopulations have been validated and shipped with their own safety rails.",
  "We will not gate basic AUC-guided dosing behind a hospital contract. The free tier is the same engine as Hospital tier — only EMR integration, BAA, custom branding, and audit logs are paid features.",
  "We will not replace clinician judgment. Every recommendation comes with the math, the residuals, and the assumptions so a pharmacist can override it with full context.",
];

const SOURCES = [
  {
    label: "Colin PJ et al. — Vancomycin Pharmacokinetics Throughout Life: Pooled Population Analysis (14 studies, n=2,554)",
    citation: "Clin Pharmacokinet. 2019;58(6):767-780.",
    doi: "10.1007/s40262-018-0727-5",
    note: "Default adult prior. CC BY-NC.",
  },
  {
    label: "Smit C et al. — Vancomycin pharmacokinetics in morbid obesity",
    citation: "Br J Clin Pharmacol. 2020;86(2):303-317.",
    doi: "10.1111/bcp.14144",
    note: "Obesity-model CL formula (BMI ≥ 40).",
  },
  {
    label: "Zhang T et al. — External validation of the obesity vancomycin model",
    citation: "Clin Pharmacokinet. 2024;63:79-91.",
    doi: "10.1007/s40262-023-01324-5",
    note: "Independent validation cohort.",
  },
  {
    label: "Janmahasatian S et al. — Quantification of lean bodyweight (FFM equations)",
    citation: "Clin Pharmacokinet. 2005;44(10):1051-1065.",
    doi: "10.2165/00003088-200544100-00004",
    note: "V₁ and V₂ scaling in obesity branch.",
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
            Vancomycin dosing should not be a black box.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed sm:text-xl" style={{ color: "#cbd5e1" }}>
            Vancomyzer&trade; is a transparent Bayesian dosing calculator for clinical pharmacists.
            Every equation, every prior, every confidence interval is in the open — because the math
            behind your dose decisions should be auditable, not just trusted.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/register"
              className="inline-block rounded-md px-6 py-3 text-center text-sm font-bold uppercase tracking-wider transition"
              style={{ background: "#00c9b1", color: "#0f172a", letterSpacing: "0.08em" }}
            >
              Try Vancomyzer free →
            </Link>
            <Link
              href="/faq"
              className="inline-block rounded-md border-2 px-6 py-3 text-center text-sm font-bold uppercase tracking-wider transition"
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
            The state of vancomycin dosing tools is strange.
          </h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed sm:text-lg" style={{ color: "#334155" }}>
            <p>
              The two commercial leaders charge $25,000–$50,000 per hospital per year. They produce a
              confident dose recommendation. They will not show you the prior they used, the math they
              ran, the residual on the fit, or the source of their derivation cohort. If you ask, you
              get a sales-deck version of <em>&ldquo;trust us — we work with 1,000+ hospitals.&rdquo;</em>
            </p>
            <p>
              That&rsquo;s not clinical decision support. That&rsquo;s a vendor with a calculator behind a paywall.
            </p>
            <p>
              We built Vancomyzer differently. The math is in the open. The prior is the same Colin 2019
              pooled model the commercial tools quietly use — and we say so out loud. The confidence band
              shows you exactly how much the engine actually knows about your patient. The Bayesian fit
              is explained inline, in plain language, when you turn on Teaching Mode. And it&rsquo;s free for
              individual clinicians, forever.
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
            Six commitments that shape every line of code in the engine.
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
            Here&rsquo;s the actual Colin 2019 clearance equation Vancomyzer evaluates for your patient,
            verbatim from the engine source. It is the same equation a black-box tool would compute
            internally. The difference is whether you ever get to see it.
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
            <span style={{ color: "#94a3b8" }}>{"// Adult clearance — Colin 2019, two-compartment, weight + maturation + age decline + SCr"}</span>
            {"\n"}
            <span style={{ color: "#94a3b8" }}>{"// Source: Clin Pharmacokinet. 2019;58(6):767-780. Eqs 6-13, Table 3."}</span>
            {"\n\n"}
            <span style={{ color: "#00c9b1" }}>const</span>
            {" CL = THETA_CL\n  * "}
            <span style={{ color: "#fbbf24" }}>Math.pow</span>
            {"(weight_kg / 70, 0.75)  "}
            <span style={{ color: "#94a3b8" }}>{"// allometric size scaling"}</span>
            {"\n  * "}
            <span style={{ color: "#fbbf24" }}>FMat</span>
            {"(PMA_weeks)            "}
            <span style={{ color: "#94a3b8" }}>{"// sigmoidal maturation (≈1.0 for adults)"}</span>
            {"\n  * "}
            <span style={{ color: "#fbbf24" }}>FDecline</span>
            {"(PMA_years)          "}
            <span style={{ color: "#94a3b8" }}>{"// 50% reduction at age 61.6 years"}</span>
            {"\n  * "}
            <span style={{ color: "#fbbf24" }}>Math.exp</span>
            {"(-THETA_SCR * (scr_mgdl - SCRstd));"}
          </pre>

          <p className="mt-8 max-w-2xl text-base leading-relaxed" style={{ color: "#334155" }}>
            And the Bayesian posterior, in three lines:
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
            <span style={{ color: "#94a3b8" }}>{"// Posterior ∝ likelihood(observed levels | params) × prior(params)"}</span>
            {"\n"}
            <span style={{ color: "#94a3b8" }}>{"// MAP estimate via multi-start Nelder-Mead in log-space"}</span>
            {"\n"}
            <span style={{ color: "#94a3b8" }}>{"// Bounded — a single outlier observation cannot override the population prior"}</span>
          </pre>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed" style={{ color: "#64748b" }}>
            That&rsquo;s the entire trick. There is no proprietary algorithm. There is no closed-source
            Bayesian magic. Anyone with a graduate-level pharmacometrics course can audit the engine.
            That is the point.
          </p>
          <Link
            href="/transparent-dosing/equations"
            className="mt-6 inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider transition"
            style={{
              background: "#0f172a",
              color: "#00c9b1",
              border: "1px solid #1e293b",
              letterSpacing: "0.08em",
            }}
          >
            ▶ Full derivations &amp; equations
          </Link>
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
            Our default adult prior is Colin 2019, which is itself a <strong>pooled population PK
            analysis across 14 published studies</strong>, ~2,554 patients, ~8,303 vancomycin concentrations,
            spanning neonates through elderly. It was published explicitly to be the &ldquo;single coherent
            prior across populations&rdquo; reference for vancomycin dosing tools — and it&rsquo;s the same
            published model the commercial tools build on.
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

          <p className="mt-10 max-w-2xl text-sm italic" style={{ color: "#64748b" }}>
            &ldquo;We use a proprietary Bayesian model trained on data from our 1,000+ hospital partners.&rdquo;
            <br />
            — every commercial vendor&rsquo;s marketing page, paraphrased.
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
            Free for individual clinicians. No credit card. The full Bayesian engine, the Colin 2019
            prior, the obesity model, the confidence band — all of it.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/register"
              className="inline-block rounded-md px-8 py-3 text-sm font-bold uppercase tracking-wider transition"
              style={{ background: "#00c9b1", color: "#0f172a", letterSpacing: "0.08em" }}
            >
              Start free →
            </Link>
            <Link
              href="/pricing"
              className="inline-block rounded-md border-2 px-8 py-3 text-sm font-bold uppercase tracking-wider transition"
              style={{ borderColor: "#cbd5e1", color: "#ffffff", letterSpacing: "0.08em" }}
            >
              See pricing
            </Link>
          </div>
          <p className="mt-10 text-xs" style={{ color: "#64748b" }}>
            Vancomyzer&trade; is a clinical decision-support tool for licensed healthcare professionals.
            Not FDA-cleared as a medical device. Classified as non-device CDS under the 21st Century
            Cures Act §3060. Engineered by{" "}
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
