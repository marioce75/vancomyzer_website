/**
 * Reproducible synthetic cohort for the engine cross-check (Vancomyzer vs an
 * independent MIPD engine such as Tucuxi). Replaces the unsaved one-off scripts
 * behind the 30 May 2026 snapshot.
 *
 *   npx tsx src/lib/validation/crosscheck/generateFixtures.ts [seed] [n]
 *
 * Writes fixtures/crosscheck-seed<seed>-n<n>.json with, per patient: inputs,
 * the TRUE parameters (Goti 2018-based generator, developer choices — see
 * predictive/goti2018.ts), the regimen, and the two observed levels with the
 * committed residual error (GOTI_2018_RESIDUAL). Synthetic only — no patients.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeRng } from "../predictive/rng";
import { sampleCohort } from "../predictive/syntheticIcuPopulation";
import { gotiIndividualParameters, addResidualError, GOTI_2018_RESIDUAL } from "../predictive/goti2018";
import { concentrationAtTime } from "@/lib/pk/steadyStateTwoCompartment";
import { MODEL_MANIFEST_VERSION } from "@/lib/pk/modelRegistry";

const seed = Number(process.argv[2] ?? 42);
const n = Number(process.argv[3] ?? 200);
const DOSE_MG_PER_KG = 15, INTERVAL_HR = 12, T_INF_HR = 1.5, DOSES_BEFORE_SAMPLING = 5;
const T_PEAK = T_INF_HR + 1.5, T_TROUGH = INTERVAL_HR - 0.5;
const round250 = (mg: number) => Math.max(500, Math.min(3000, Math.round(mg / 250) * 250));

const rng = makeRng(seed);
const cohort = sampleCohort(rng, n);
const patients = cohort.map((p, i) => {
  const truth = gotiIndividualParameters({ weight_kg: p.weight_kg, crcl_ml_min: p.crcl_ml_min }, rng);
  const dose_mg = round250(DOSE_MG_PER_KG * p.weight_kg);
  const reg = { ...truth, dose_mg, tau: INTERVAL_HR, T_inf: T_INF_HR };
  const true_peak = concentrationAtTime({ ...reg, t: T_PEAK });
  const true_trough = concentrationAtTime({ ...reg, t: T_TROUGH });
  return {
    id: `p${i + 1}`,
    patient: { age: Math.round(p.age_yr), weight_kg: Math.round(p.weight_kg * 10) / 10, height_cm: Math.round(p.height_cm), sex: p.sex, serum_creatinine_mg_dl: Math.round(p.scr_mg_dl * 100) / 100 },
    truth,
    regimen: { dose_mg, interval_hours: INTERVAL_HR, infusion_duration_hours: T_INF_HR, doses_given: DOSES_BEFORE_SAMPLING, steady_state_confirmed: true },
    // Steady-state design: dose history = infinite train of the same regimen.
    levels: [
      { time_since_last_dose_hours: T_PEAK, value_mcg_ml: addResidualError(true_peak, rng), true_value: true_peak },
      { time_since_last_dose_hours: T_TROUGH, value_mcg_ml: addResidualError(true_trough, rng), true_value: true_trough },
    ],
  };
});

const out = {
  generated_at: new Date().toISOString(),
  generator: "src/lib/validation/crosscheck/generateFixtures.ts",
  seed, n,
  engine_manifest_at_generation: MODEL_MANIFEST_VERSION,
  truth_model: "Goti 2018-based individual parameters (predictive/goti2018.ts), between-subject variability per GOTI_2018_OMEGA",
  residual_error_model: GOTI_2018_RESIDUAL,
  design: { dose_mg_per_kg: DOSE_MG_PER_KG, interval_hours: INTERVAL_HR, infusion_hours: T_INF_HR, doses_before_sampling: DOSES_BEFORE_SAMPLING, sample_times_h_after_dose_start: [T_PEAK, T_TROUGH], horizon: "steady_state (confirmed)" },
  units: { concentration: "mg/L (= mcg/mL)", CL: "L/h", V: "L", time: "h" },
  patients,
};
const file = join(__dirname, "fixtures", `crosscheck-seed${seed}-n${n}.json`);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`wrote ${file} (${patients.length} patients)`);
