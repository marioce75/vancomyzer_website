import type { CandidateRegimen, ExposureBlock, PediatricRequest, PediatricResult } from './engine';
import { IS_MIN_ESS } from './colin2019/fit';
export interface ResearchRegimen extends CandidateRegimen {
  steady_state_auc24_interval: NonNullable<ExposureBlock['steady_state_auc24_interval']>;
  forecast_auc24_next24h: number | null;
}
export interface ResearchRegimens {
  status: 'available' | 'withheld' | 'no_match';
  reason: string;
  options: ResearchRegimen[];
  assumptions: string[];
}
/** A deliberately narrow research comparison, not a validated dose-adjustment policy. */
export function researchRegimens(result: PediatricResult, raw: PediatricRequest, forecast: (c: CandidateRegimen) => number | null): ResearchRegimens {
  const assumptions = [
    'Serious MRSA research scenario, MIC assumed 1 mg/L. Normal, stable renal function must be confirmed independently; serum creatinine alone does not establish it.',
    'Search limited to the existing pediatric grid within 60–80 mg/kg/day, q6–8h, and at most 3600 mg/day. This borrows the guideline initial-dose envelope; it is not a comprehensive dose-adjustment policy, including after measured levels.',
    'Only point-estimate steady-state AUC24 400–600 mg·h/L and trough below 15 mg/L are shortlisted. These filters do not establish safety or target attainment for an individual.',
    'Ranked by distance to AUC24 500, then lower daily dose. This is a transparent software tie-break, not evidence that the first option is clinically superior.',
    '90% model intervals describe steady-state parameter uncertainty only; external clinical calibration is lacking. Forecast points preserve entered history and next-dose time; no candidate forecast interval is provided.',
    'Colin supplementary formulation remains a research candidate pending author clarification. Not for patient care.'
  ];
  const stop=(reason:string):ResearchRegimens=>({status:'withheld',reason,options:[],assumptions});
  if (raw.research_regimen_context?.serious_mrsa_mic1 !== true || raw.research_regimen_context?.normal_stable_renal_function !== true) return stop('Confirm the research target and independently assessed normal, stable renal function to compare regimens.');
  if (raw.patient.unstable_renal_function === true || raw.patient.renal_replacement_therapy === true || raw.patient.ecmo === true || (raw.patient.route && raw.patient.route !== 'iv')) return stop('This clinical context is outside the regimen-search scope.');
  if (result.derived.postnatal_age_years < 0.25 || result.derived.postnatal_age_years >= 18) return stop('Automatic research selection is withheld below 3 months and at 18 years or older. A separately reviewed neonatal policy is required.');
  if (result.input_review.items.length) return stop('Input-review flags require individual review; confirming an unusual input does not enable automatic regimen selection.');
  if (result.level_count && (!result.posterior || !result.posterior.fit.converged || !result.posterior.fit.posterior_sampling || result.posterior.fit.posterior_sampling.effective_sample_size < IS_MIN_ESS || result.posterior.fit.predicted_at_levels.some(x=>Math.abs(x.standardisedResidual)>3))) return stop('Posterior fit or uncertainty diagnostics do not support ranking research regimens.');
  const best=result.posterior ?? result.prior;
  const interval=best.exposure.steady_state_auc24_interval;
  if (!interval || ![interval.lower,interval.median,interval.upper].every(Number.isFinite)) return stop('Model uncertainty is unavailable.');
  const options=result.candidate_regimens.filter(c=> {
    const daily=c.dose_mg*24/c.interval_hours;
    const mgkg=daily/result.derived.weight_kg;
    return [6,8].includes(c.interval_hours) && mgkg>=60-1e-9 && mgkg<=80+1e-9 && daily<=3600 && c.auc24>=400 && c.auc24<=600 && c.trough<15 && c.infusion_minutes>=60 && c.dose_mg/c.infusion_minutes<=10;
  }).map(c=> {
    const ratio=c.auc24/best.exposure.steady_state_auc24;
    return {...c,dose_mg_per_kg:c.dose_mg/result.derived.weight_kg,
      flags:[...c.flags,...(c.dose_mg*24/c.interval_hours>3000?['Above 3000 mg/day: guideline calls for close concentration/renal monitoring.']:[]),...(interval.lower*ratio<400 || interval.upper*ratio>600?['Model interval extends outside the target; point estimate is not assurance.']:[])],
      steady_state_auc24_interval:{...interval,lower:interval.lower*ratio,median:interval.median*ratio,upper:interval.upper*ratio},forecast_auc24_next24h:forecast(c)};
  }).sort((a,b)=>Math.abs(a.auc24-500)-Math.abs(b.auc24-500) || a.dose_mg*24/a.interval_hours-b.dose_mg*24/b.interval_hours || a.interval_hours-b.interval_hours);
  return {status:options.length?'available':'no_match',reason:options.length?'Model-ranked research options; compare before explicitly applying.':'No regimen in this limited pediatric search meets the point-estimate filters. No fallback dose is recommended.',options,assumptions};
}
