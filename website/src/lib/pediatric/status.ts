import {
  ACTIVE_FORMULATION,
  FORMULATION_STATEMENT,
  FORMULATION_STATUS,
  PEDIATRIC_ACK_STATEMENT,
  PEDIATRIC_ACK_STATEMENT_VERSION,
  COLIN_2019_DATASET_SUPPORT,
  COLIN_2019_SOURCES,
  PEDIATRIC_MODEL_MANIFEST_VERSION,
  PEDIATRIC_RESEARCH_NOTICE,
  PEDIATRIC_SCOPE,
} from "./colin2019/manifest";

/**
 * Research-preview status. Calculations are enabled for verified system
 * administrators only, after a per-session research acknowledgement, on the
 * supplementary-NONMEM parameterisation of Colin 2019 held as a candidate
 * pending the authors' clarification. Not clinically validated; not for
 * patient care.
 */
export const pediatricStatus = {
  status: "research_preview",
  calculationsEnabled: true,
  researchOnly: true,
  clinicalUseAllowed: false,
  model: "colin_2019",
  formulation: ACTIVE_FORMULATION,
  formulationStatus: FORMULATION_STATUS,
  formulationStatement: FORMULATION_STATEMENT,
  acknowledgement: { required: true, statement: PEDIATRIC_ACK_STATEMENT, version: PEDIATRIC_ACK_STATEMENT_VERSION },
  manifestVersion: PEDIATRIC_MODEL_MANIFEST_VERSION,
  supportedAgeRange: {
    postmenstrualAgeWeeksMin: PEDIATRIC_SCOPE.pmaWeeksMin,
    postnatalAgeYearsMaxExclusive: PEDIATRIC_SCOPE.postnatalAgeMaxYears,
    datasetGapPmaYears: { from: COLIN_2019_DATASET_SUPPORT.pediatricPmaGapYears.from, to: COLIN_2019_DATASET_SUPPORT.pediatricPmaGapYears.to, policy: "refused" },
    ageConvention: "PMA_years = postnatal_days/365.25 + gestational_weeks/52",
  },
  excluded: COLIN_2019_DATASET_SUPPORT.excludedByDesign,
  sources: COLIN_2019_SOURCES,
  message: PEDIATRIC_RESEARCH_NOTICE,
} as const;
