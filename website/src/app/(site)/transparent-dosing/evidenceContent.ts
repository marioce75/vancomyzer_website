import { COLIN_2019, MODEL_MANIFEST_VERSION } from "@/lib/pk/modelRegistry";
import { RERUN_2026 } from "@/lib/validation/engineCrosscheck2026";
// What to look at when reviewing a calculation. Unordered: these are not steps.
export const REVIEW_POINTS = [
  { title: "Population-model equations", body: `The ${COLIN_2019.shortName} equations describe how patient characteristics affect the starting estimates. The calculator then adjusts those estimates to measured blood levels. Reviewing that adjustment requires more than checking one equation.` },
  { title: "Fit to measured levels", body: "Bayesian estimates combine the population model with measured levels, fitted to the doses actually given, including a loading dose when one is entered. The calculator shows measured-versus-predicted differences and flags a poor fit for clinical review." },
  { title: "90% credible band", body: "The shaded band shows the middle 90% of concentrations from 400 simulated sets of pharmacokinetic values. It reflects uncertainty in the model estimates, updated with blood levels when available. It excludes measurement error, so it is not a range for predicting a future blood test result. Its reliability in patients has not been established." },
  { title: "Published starting model", body: `${COLIN_2019.citation} ${COLIN_2019.sourcePopulation} Published model evidence does not establish clinical validation of Vancomyzer.` },
  { title: "Scope", body: "Vancomyzer supports adults receiving intermittent intravenous vancomycin. Pediatric dosing, dialysis and continuous infusion are outside its scope. Independent clinical validation is pending." },
  { title: "Access", body: "The core calculator is free. Paid plans add account features. All plans use the same calculation method; see the pricing page for current terms." },
];

export const LIMITS = [
  "Vancomyzer is not FDA-cleared or approved. Its intended regulatory basis and limitations are described in the medical disclaimer.",
  "A poor fit to measured levels calls for review of timing, data quality and the clinical situation. It does not establish that a proposed regimen is appropriate.",
  "Published-case checks and synthetic comparisons are developer-run software checks, not independent clinical validation.",
  "The clinician must review a recommendation against the patient’s condition, local protocol and therapeutic drug monitoring.",
];

export const SOURCES = [
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

export const METHOD_PAGES = [
  { href: "/transparent-dosing/equations", title: "Equations and derivations", covers: "Every equation and constant the calculator uses, with the reference check for a typical adult.", status: "Published model", kind: "ok" as const },
  { href: "/transparent-dosing/cases", title: "Literature reproducibility", covers: "Published vancomycin cases run through the calculator. Selected population predictions are pass/fail checks; cases from other models provide context.", status: "Developer-run", kind: "ok" as const },
  { href: "/transparent-dosing/predictive-performance", title: "Predictive performance", covers: "200 simulated ICU patients using a model adapted from published research. Each prediction is checked against a concentration not used to calculate it.", status: "Developer-run", kind: "ok" as const },
  { href: "/transparent-dosing/engine-crosscheck", title: "Comparison with Tucuxi", covers: `The same starting assumptions and simulated blood levels compared in two programs. Their approaches to blood-level uncertainty differ.${RERUN_2026.version === MODEL_MANIFEST_VERSION && RERUN_2026.maxRelDiffPct === 0 ? " Repeating the Vancomyzer calculations gave the same estimates for these cases." : ""}`, status: "Developer-run", kind: "ok" as const },
  { href: "/transparent-dosing/software-checks#reference", title: "Independent reference calculation", covers: "Concentration, AUC and dose-history calculations compared with a separate mathematical calculation, including 40 random loading-dose schedules; agreement within one part in a million.", status: "Developer-run", kind: "ok" as const },
  { href: "/transparent-dosing/software-checks#loading-dose", title: "Loading-dose handling", covers: "Levels drawn after a loading dose are fitted to the doses actually given, removing the overestimate that comes from recording the load as a maintenance dose.", status: "Developer-run", kind: "ok" as const },
  { href: "/transparent-dosing/software-checks#band", title: "Uncertainty band coverage", covers: "Synthetic patients: how often the true concentration falls inside the 90% band, under the calculator's assumptions and selected published variability estimates.", status: "Not yet validated", kind: "warn" as const },
  { href: "/transparent-dosing/predictive-performance#validation-plan", title: "Independent clinical validation", covers: "Retrospective and prospective evaluation with patient data at a participating institution.", status: "Pending", kind: "warn" as const },
];
