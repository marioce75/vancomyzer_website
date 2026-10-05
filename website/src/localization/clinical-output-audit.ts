/** Local synthetic fixture report; run with tsx and an explicit output path. */
import { writeFileSync } from "node:fs";
import { computeInitialRegimen } from "../lib/initialRegimen";
import { runExistingRegimenPipeline } from "../lib/pk/runExistingRegimenPipeline";
import { translateGeneratedText } from "./generatedText";
const patient = { age: 55, weight_kg: 70, serum_creatinine_mg_dl: 1, height_cm: 170, sex: "male" as const };
const cases = {
  initial: computeInitialRegimen(patient),
  oneLevel: runExistingRegimenPipeline({ patient, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 3 }] }),
  twoLevels: runExistingRegimenPipeline({ patient, regimen: { dose_mg: 1500, interval_hours: 12, infusion_duration_hours: 1.5, doses_given: 5 }, levels: [{ value_mcg_ml: 30, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 }, { value_mcg_ml: 12, collection_time: "2026-03-15T17:30:00Z", time_since_last_dose_hours: 11.5 }] }),
};
const fields = new Set(["interpretation_summary", "quick_summary", "clinical_note", "safety_message", "recommended_action", "data_quality_summary", "banner_body", "banner_title"]);
const rows: { fixture: string; path: string; en: string; es: string; fr: string; numericalTokensPreserved: boolean }[] = [];
function visit(value: unknown, path: string, fixture: string) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && fields.has(key)) {
      const es = translateGeneratedText(item, "es"), fr = translateGeneratedText(item, "fr");
      const numbers = (s: string) => JSON.stringify(s.match(/\d+(?:[.,]\d+)*/g));
      rows.push({ fixture, path: `${path}.${key}`, en: item, es, fr, numericalTokensPreserved: numbers(item) === numbers(es) && numbers(item) === numbers(fr) });
    } else visit(item, `${path}.${key}`, fixture);
  }
}
Object.entries(cases).forEach(([name, result]) => {
  if ("ok" in result && result.ok === false) throw new Error(`${name}: fixture failed validation`);
  visit(result, name, name);
});
if (!process.argv[2]) throw new Error("Provide the local output JSON path");
writeFileSync(process.argv[2], JSON.stringify({ notice: "Synthetic fixtures only. Side-by-side output review, not a claim of exhaustive translation or clinical validation. Unknown sentences remain English.", rows }, null, 2));
if (rows.some(row => !row.numericalTokensPreserved)) throw new Error("Localization changed numeric tokens");
console.log(`${rows.length} generated output fields; numerical tokens preserved in Spanish and French.`);
