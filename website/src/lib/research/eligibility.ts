/**
 * Eligibility criteria engine for the IRB validation study.
 *
 * Evaluates each research patient against inclusion and exclusion criteria.
 * Pure function — no side effects, no database access.
 */

import type { ResearchPatient, DosingRecord, LevelRecord, EligibilityResult } from "@/types/research";

// Study window: January 2020 – December 2024
const STUDY_START = "2020-01-01";
const STUDY_END = "2024-12-31";

export function evaluateEligibility(
  patient: ResearchPatient,
  doses: DosingRecord[],
  levels: LevelRecord[]
): EligibilityResult {
  // ── Inclusion criteria (all must be met) ──
  const inclusion = [
    { criterion: "Age ≥ 18 years", met: patient.age >= 18 },
    { criterion: "At least 2 vancomycin doses administered", met: doses.length >= 2 },
    { criterion: "At least 1 serum vancomycin concentration recorded", met: levels.length >= 1 },
    { criterion: "SCr available", met: patient.scr_baseline > 0 },
    { criterion: "Weight available", met: patient.weight_kg > 0 },
    { criterion: "Height available", met: patient.height_cm > 0 },
    { criterion: "Age available", met: patient.age > 0 },
    { criterion: "Sex available", met: patient.sex === "male" || patient.sex === "female" },
  ];

  // ── Exclusion criteria (any one triggers exclusion) ──
  const hasLevelDuringInfusion = levels.some(l => l.during_infusion === 1);
  const hasLevelInDistribution = levels.some(l => l.in_distribution_phase === 1);
  const enrollmentInWindow =
    patient.enrollment_date >= STUDY_START && patient.enrollment_date <= STUDY_END;

  const exclusion = [
    { criterion: "Renal replacement therapy (CRRT, HD, PD)", triggered: patient.rrt === 1 },
    { criterion: "Level drawn during infusion", triggered: hasLevelDuringInfusion },
    { criterion: "Level drawn in distribution phase (<2h post-infusion)", triggered: hasLevelInDistribution },
    { criterion: "Enrollment date outside study window (Jan 2020 – Dec 2024)", triggered: !enrollmentInWindow },
    { criterion: "Age < 18 years", triggered: patient.age < 18 },
  ];

  const allInclusionMet = inclusion.every(c => c.met);
  const anyExclusionTriggered = exclusion.some(c => c.triggered);

  const exclusion_reasons = exclusion
    .filter(c => c.triggered)
    .map(c => c.criterion);

  if (!allInclusionMet) {
    const missing = inclusion.filter(c => !c.met).map(c => `Missing: ${c.criterion}`);
    exclusion_reasons.push(...missing);
  }

  return {
    eligible: allInclusionMet && !anyExclusionTriggered,
    inclusion,
    exclusion,
    exclusion_reasons,
  };
}
