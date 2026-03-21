import type { ExistingRegimenEngineOutput } from "../types";
import type { ReviewStatus } from "@/types/calculator";

export function buildExistingRegimenReviewStatus(
  engineOutput: ExistingRegimenEngineOutput
): ReviewStatus {
  const sparse = engineOutput.level_count <= 1;
  const highUncertainty = engineOutput.posterior_fit?.uncertainty_label === "high";
  const coherent =
    engineOutput.level_count > 1 && engineOutput.posterior_fit?.fit_quality === "moderate";

  if (!engineOutput.used_posterior_refinement || engineOutput.level_count <= 0) {
    return {
      level: "prior_only",
      workflow_fit: "prior_only",
      banner_title: "Prior-based result",
      banner_body:
        "This result depends mainly on prior-model assumptions rather than measured-level refinement.",
      next_actions: [
        "Confirm the workflow fits an adult intermittent-infusion use case.",
        "Use measured levels when available for a more individualized fit.",
      ],
    };
  }

  if (sparse || highUncertainty) {
    return {
      level: "caution",
      workflow_fit: "single_level",
      banner_title: "Posterior result with limited certainty",
      banner_body:
        "Sparse or high-uncertainty level data can support review, but should not be overinterpreted as strong individualized precision.",
      next_actions: [
        "Confirm dose timing and infusion completion time.",
        "Consider repeat sampling if chronology or timing quality is weak.",
        "Review assumptions and scope before acting.",
      ],
    };
  }

  if (coherent) {
    return {
      level: "supported",
      workflow_fit: "multi_level_coherent",
      banner_title: "Posterior result with stronger coherence",
      banner_body:
        "The measured data are more coherent for this workflow, though clinician review and scope checks still matter.",
      next_actions: [
        "Confirm local protocol alignment before applying changes.",
        "Review assumptions and limitations alongside the dose suggestion.",
      ],
    };
  }

  return {
    level: "caution",
    workflow_fit: "single_level",
    banner_title: "Review workflow fit before acting",
    banner_body:
      "This result may be useful for review, but timing or data-quality limitations still need confirmation.",
    next_actions: [
      "Confirm chronology and same-interval timing.",
      "Review assumptions, limitations, and caution flags before acting.",
    ],
  };
}

export function buildInitialRegimenReviewStatus(): ReviewStatus {
  return {
    level: "prior_only",
    workflow_fit: "prior_only",
    banner_title: "Prior-only maintenance suggestion",
    banner_body:
      "This initial-regimen result is a prior-only maintenance suggestion without measured-level refinement.",
    next_actions: [
      "Use this as first-pass maintenance support, not individualized certainty.",
      "Reassess after measured levels are available.",
    ],
  };
}
