export interface EmpiricLoadingDoseInput {
  actual_body_weight_kg: number;
}

export interface EmpiricLoadingDoseRecommendation {
  suggested_dose_mg: number;
  basis: string;
}

const LOADING_DOSE_MG_PER_KG = 25;
const MAX_LOADING_DOSE_MG = 3000;

function roundDoseMg(mg: number): number {
  const rounded = Math.round(mg / 250) * 250;
  if (rounded < 250) return 250;
  return rounded;
}

export function buildEmpiricLoadingDose(
  input: EmpiricLoadingDoseInput
): EmpiricLoadingDoseRecommendation {
  const abw = Math.max(0, input.actual_body_weight_kg);
  const dose = Math.min(
    MAX_LOADING_DOSE_MG,
    roundDoseMg(abw * LOADING_DOSE_MG_PER_KG)
  );

  return {
    suggested_dose_mg: dose,
    basis: `Guideline-aligned optional empiric loading-dose estimate using actual body weight at ${LOADING_DOSE_MG_PER_KG} mg/kg, capped at ${MAX_LOADING_DOSE_MG} mg. This does not encode severity, indication, or local protocol.`,
  };
}
