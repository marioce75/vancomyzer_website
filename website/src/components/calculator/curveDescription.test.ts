/**
 * Banner and legend must name the same curve (curveDescription.ts).
 * Synthetic cases only; no PK calculation is involved.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { describeSelectedCurve, singleDoseBannerCaption, singleDoseBannerCaptionText, type CurveSelection } from "./curveDescription";

const loadOnly: CurveSelection = {
  singleDose: true,
  singleDoseStatus: "given",
  regimen: { dose_mg: 2000, interval_hours: 12, doses_given: 1, loading_dose_mg: 2000 },
  viewingCurrent: true,
  activeOption: { dose_mg: 2000, interval_hours: 12 },
  hasSingleDoseCurve: true,
  actualHistory: false,
  showEngineRecommended: false,
  hasEngineRecommendedCurve: true,
};

test("current single-dose curve: banner says no further doses, same words as the legend", () => {
  const legend = describeSelectedCurve(loadOnly);
  assert.equal(legend, "loading dose 2000 mg × 1, no further doses");
  const caption = singleDoseBannerCaption("given", legend, true);
  assert.equal(caption.curve, legend);
  const text = singleDoseBannerCaptionText(caption);
  assert.equal(text, "Graph shows: loading dose 2000 mg × 1, no further doses. Select a candidate regimen to see it continued with maintenance doses.");
  assert.ok(!text.includes("followed by"), "banner must not claim maintenance is drawn");
});

test("proposed maintenance selected: banner and legend both say dose, then regimen", () => {
  const sel: CurveSelection = { ...loadOnly, viewingCurrent: false, activeOption: { dose_mg: 750, interval_hours: 12 } };
  const legend = describeSelectedCurve(sel);
  assert.equal(legend, "loading dose 2000 mg, then 750 mg q12h");
  const caption = singleDoseBannerCaption("given", legend, false);
  assert.equal(caption.curve, legend);
  const text = singleDoseBannerCaptionText(caption);
  assert.ok(/maintenance regimen below/.test(text));
  assert.ok(!text.includes("no further doses"));
});

test("single maintenance dose without a loading dose is called a single dose", () => {
  const sel: CurveSelection = { ...loadOnly, singleDoseStatus: "single", regimen: { dose_mg: 1000, interval_hours: 12, doses_given: 1 }, activeOption: { dose_mg: 1000, interval_hours: 12 } };
  assert.equal(describeSelectedCurve(sel), "single dose 1000 mg × 1, no further doses");
  assert.equal(describeSelectedCurve({ ...sel, viewingCurrent: false, activeOption: { dose_mg: 500, interval_hours: 12 } }), "single dose 1000 mg, then 500 mg q12h");
});

test("Empiric preview: suggested dose is marked not given in legend and banner, whichever row is selected", () => {
  const sel: CurveSelection = { ...loadOnly, singleDoseStatus: "suggested", regimen: { dose_mg: 2000, interval_hours: 12, doses_given: 1 } };
  const current = describeSelectedCurve(sel);
  assert.equal(current, "suggested loading dose 2000 mg (not given) × 1, no further doses");
  const option = describeSelectedCurve({ ...sel, viewingCurrent: false, activeOption: { dose_mg: 500, interval_hours: 8 } });
  assert.equal(option, "suggested loading dose 2000 mg (not given), then 500 mg q8h");
  for (const [legend, viewingCurrent] of [[current, true], [option, false]] as const) {
    const caption = singleDoseBannerCaption("suggested", legend, viewingCurrent);
    assert.equal(caption.before[0], "Preview only.");
    assert.equal(caption.curve, legend);
    assert.ok(/not part of the dosing history/.test(singleDoseBannerCaptionText(caption)));
  }
});

test("multi-dose histories describe the entered history on the current row and the option from the first dose otherwise", () => {
  const base: CurveSelection = { ...loadOnly, singleDose: false, actualHistory: true };
  assert.equal(
    describeSelectedCurve({ ...base, regimen: { dose_mg: 750, interval_hours: 12, doses_given: 2, loading_dose_mg: 2000 } }),
    "entered history: 2000 mg loading dose, then 750 mg q12h × 1",
  );
  assert.equal(
    describeSelectedCurve({ ...base, regimen: { dose_mg: 1000, interval_hours: 12, doses_given: 3 } }),
    "entered history: 1000 mg q12h × 3",
  );
  assert.equal(
    describeSelectedCurve({ ...base, regimen: { dose_mg: 1000, interval_hours: 12, doses_given: 6 }, actualHistory: false }),
    "current regimen 1000 mg q12h, from the first dose",
  );
  assert.equal(
    describeSelectedCurve({ ...base, regimen: { dose_mg: 1000, interval_hours: 12, doses_given: 3 }, viewingCurrent: false, activeOption: { dose_mg: 1000, interval_hours: 18 } }),
    "1000 mg q18h, from the first dose (no loading dose)",
  );
});
