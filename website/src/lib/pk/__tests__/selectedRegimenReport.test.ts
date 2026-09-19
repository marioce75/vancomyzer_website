import assert from "node:assert/strict";
import { runExistingRegimenPipeline } from "../runExistingRegimenPipeline";
import { generateReportHTML } from "../../generateReport";

const result = runExistingRegimenPipeline({
  patient: { age: 55, weight_kg: 80, height_cm: 175, serum_creatinine_mg_dl: 1 },
  regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 2, doses_given: 3, steady_state_confirmed: false },
  levels: [{ value_mcg_ml: 15, time_since_last_dose_hours: 10 }],
}) as any;
assert.ok(!result.error_type, "fabricated measured case should calculate");
const recommended = result.frequency_options.find((o: any) => o.is_recommended);
assert.ok(recommended && recommended.dose_mg !== 1000);
assert.notEqual(recommended.auc24, result.auc24);
for (const option of result.frequency_options) {
  const text = option.interpretation_summary;
  const [current, selected] = text.split(" Selected regimen steady-state projection");
  assert.ok(current.includes(`Current regimen: 1000 mg every 12 h.`));
  assert.ok(current.includes(`AUC24 ${result.auc24} mg·h/L`), "entered regimen retains its own exposure");
  assert.ok(selected.includes(`(${option.dose_mg} mg every ${option.interval_hours} h)`));
  assert.ok(selected.includes(`AUC24 ${option.auc24} mg·h/L`));
  const html = generateReportHTML({
    age: 55, weight_kg: 80, serum_creatinine_mg_dl: 1, mode: "existing_regimen",
    recommended_dose: String(option.dose_mg), recommended_interval_hours: option.interval_hours,
    recommended_infusion_duration_hours: option.infusion_duration_hours,
    auc24: option.auc24, peak: option.peak, trough: option.trough,
    interpretation_summary: text, clinical_note: option.clinical_note,
  });
  assert.ok(html.includes(`Infuse over ${option.infusion_duration_hours} hours`));
  assert.ok(html.includes(`AUC24 ${result.auc24} mg·h/L`));
  assert.ok(html.includes(`AUC24 ${option.auc24} mg·h/L`));
}
console.log(`Selected-regimen report: ${result.frequency_options.length} distinct options retain current and selected exposure labels.`);
