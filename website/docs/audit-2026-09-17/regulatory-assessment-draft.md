# Function-specific regulatory assessment — DRAFT for qualified counsel

Basis: FDA, *Clinical Decision Support Software — Guidance for Industry and FDA
Staff*, **January 29, 2026** (supersedes 6 Jan 2026), https://www.fda.gov/media/109618/download.
Not a legal opinion. Distinguishes: **non-device** (meets all four §520(o)(1)(E)
criteria) vs **enforcement discretion** (device, FDA does not intend to enforce)
vs **cleared/approved** (Vancomyzer is none of the latter and says so).

| Function | Criterion 1 (no images/IVD/signals) | Criterion 2 (analyses medical information) | Criterion 3 (support/recommend, not a specific directive) | Criterion 4 (independent review) | Assessment |
|---|---|---|---|---|---|
| Empiric regimen: emits "1250 mg q24h" as the recommendation | met | met | **At risk.** A single specific dose output resembles the guidance's device examples (e.g. Ex. 28, bolus insulin dose calculation). Mitigation present: candidate table is a prioritised list of options; the recommendation is one row of it. Whether "one option clinically appropriate" enforcement-discretion language applies is for counsel. | Basis is reviewable: model, equations, prior values, inputs, key inputs, assumptions, limitations, validation status (synthetic only) are shown in-app and on /transparent-dosing. Not time-critical in the guidance's sense (vancomycin maintenance dosing is reviewed over hours, not minutes) — counsel to confirm. | Likely non-device *only if* framed as a prioritised list with the clinician selecting; a bare directive weakens Criterion 3. |
| Bayesian adjustment: "Recommended adjustment 1000 mg q18h" | met | met | same as above; plus the review-hold state now withholds any directive on discordant data | same; fit diagnostics now exposed (prior/posterior, residuals, objective, convergence) which strengthens independent review | same |
| Loading-dose configurator / pulse simulation | met | met | provides a range and an editable dose — closer to "options" | reviewable | lower risk |
| ARC / high-BMI / age advisories, timing and fit warnings | met | met | informational | reviewable | non-device pattern |
| Concentration-time graph | met | met | display | — | non-device pattern |
| Note / PDF export | — | — | reproduces the above | — | follows the function it reproduces |

Automation-bias controls in the product: explicit "prior only" vs "Bayesian
fit" chips; uncertainty labels; review hold; stale-result obscuring; every
number traceable to the same canonical function.

**Not established by this document:** that relabelling makes the function
exempt; HIPAA business-associate status (see privacy-data-flow.md); state
privacy and FTC Health Breach Notification Rule applicability
(https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
to a consumer-facing open-access tool that records health values; whether the
clinical-use licence terms align with institutional paid use. Counsel decides.
Guideline basis for targets: ASHP/IDSA/PIDS/SIDP 2020 (https://www.idsociety.org/practice-guideline/vancomycin/) —
AUC/MIC 400–600 assuming MIC 1 mg/L for serious MRSA; the app states AUC and
the MIC-1 assumption separately.
