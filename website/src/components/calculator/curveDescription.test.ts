/**
 * Banner and legend must name the same curve (curveDescription.ts).
 * Synthetic cases only; no PK calculation is involved.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { describeMeasuredLevels, describeSelectedCurve, MEASURED_REFERENCE_PREFIX, singleDoseBannerCaption, singleDoseBannerCaptionText, singleDoseView, type CurveSelection } from "./curveDescription";

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

test("no regimen selected or proposed: legend says the single dose is drawn alone, banner says no regimen is shown", () => {
  // Reached when the recommendation is blocked (no candidate carries is_recommended) and no row is selected.
  const sel: CurveSelection = { ...loadOnly, viewingCurrent: false, activeOption: null };
  const legend = describeSelectedCurve(sel);
  assert.equal(legend, "loading dose 2000 mg × 1, no further doses");
  const caption = singleDoseBannerCaption("given", legend, "none");
  assert.equal(caption.curve, legend);
  const text = singleDoseBannerCaptionText(caption);
  assert.equal(text, "Graph shows: loading dose 2000 mg × 1, no further doses. No maintenance regimen is shown; the graph has only this dose.");
  assert.ok(!/repeated|projection after|Select a candidate/.test(text));
  // Only when the response has no single-dose curve at all may the legend admit the illustrative repeat.
  assert.equal(describeSelectedCurve({ ...sel, hasSingleDoseCurve: false }), "loading dose 2000 mg repeated every 12 h (illustrative)");
  // A single maintenance dose in the same state is never called a loading dose.
  assert.equal(
    describeSelectedCurve({ ...sel, singleDoseStatus: "single", regimen: { dose_mg: 1000, interval_hours: 12, doses_given: 1 } }),
    "single dose 1000 mg × 1, no further doses",
  );
});

test("engine-recommended toggle names the suggested regimen after the dose given", () => {
  const sel: CurveSelection = { ...loadOnly, viewingCurrent: false, activeOption: null, showEngineRecommended: true, engineRecommended: { dose_mg: 1000, interval_hours: 12 } };
  assert.equal(describeSelectedCurve(sel), "loading dose 2000 mg, then 1000 mg q12h (suggested regimen)");
  assert.equal(describeSelectedCurve({ ...sel, engineRecommended: null }), "suggested regimen");
});

test("the boolean form of the banner view still maps to current / option", () => {
  assert.deepEqual(singleDoseBannerCaption("given", "x", true).after, singleDoseBannerCaption("given", "x", "current").after);
  assert.deepEqual(singleDoseBannerCaption("given", "x", false).after, singleDoseBannerCaption("given", "x", "option").after);
});

test("banner view: no regimen proposed means 'none' even when the 'as entered' row is the only row", () => {
  const opt = { dose_mg: 2000, interval_hours: 12 };
  assert.equal(singleDoseView({ viewingCurrent: true, activeOption: opt, regimenProposed: true }), "current");
  assert.equal(singleDoseView({ viewingCurrent: false, activeOption: opt, regimenProposed: true }), "option");
  assert.equal(singleDoseView({ viewingCurrent: false, activeOption: null, regimenProposed: true }), "none");
  // Review-required refusal: the workspace shows the entered row by itself; there is no candidate to select.
  assert.equal(singleDoseView({ viewingCurrent: true, activeOption: opt, regimenProposed: false }), "none");
});

// ── Measured levels vs. projected candidates (second review, item 5) ────────

const enteredLabel = "current regimen 1000 mg q12h, from the first dose";
const oneLevel = { levels: [{ time_hours: 71, concentration: 9 }], hoursAfterLastDose: [11], enteredHistoryLabel: enteredLabel, dosesGiven: 6 };

test("the entered-history curve carries its measured levels on the solid line, with their time anchor", () => {
  const d = describeMeasuredLevels({ ...oneLevel, solidIsEnteredHistory: true, hasEnteredHistoryCurve: true })!;
  assert.equal(d.placement, "solid");
  assert.equal(d.legend, "Measured (entered history)");
  assert.equal(d.referenceLabel, null);
  assert.equal(d.note, null);
  assert.deepEqual(d.anchors, ["Level 1: 9 mg/L, 11 h after the start of dose 6 (T+71 h on this curve)"]);
});

test("a candidate projection never carries the measured levels: they move to a dotted entered-history curve", () => {
  const d = describeMeasuredLevels({ ...oneLevel, solidIsEnteredHistory: false, hasEnteredHistoryCurve: true })!;
  assert.equal(d.placement, "reference");
  assert.equal(d.legend, "Measured (on the dotted entered-history curve, not on the projection)");
  // The legend prints this after "Levels measured under:".
  assert.equal(d.referenceLabel, enteredLabel);
  assert.equal(MEASURED_REFERENCE_PREFIX, "Levels measured under");
  assert.match(d.note!, /^The solid curve is a projection of a regimen not yet given\. Measured levels were drawn under the entered history and are plotted on its dotted curve at their own times, not on the projection\.$/);
  // The anchor is the level's own time on the entered history's axis, and says which curve that is.
  assert.deepEqual(d.anchors, ["Level 1: 9 mg/L, 11 h after the start of dose 6 (T+71 h on the dotted entered-history curve)"]);
});

test("without an entered-history curve the levels are not plotted on a projection at all, and the legend says so", () => {
  const d = describeMeasuredLevels({ ...oneLevel, solidIsEnteredHistory: false, hasEnteredHistoryCurve: false })!;
  assert.equal(d.placement, "hidden");
  assert.equal(d.legend, "Measured (not plotted)");
  assert.match(d.note!, /are not plotted on the projection\.$/);
  assert.deepEqual(d.anchors, ["Level 1: 9 mg/L, 11 h after the start of dose 6"]);
});

test("a level after one dose is anchored to the dose given; several levels each keep their own anchor", () => {
  const single = describeMeasuredLevels({ levels: [{ time_hours: 6, concentration: 22 }], hoursAfterLastDose: [6], solidIsEnteredHistory: false, hasEnteredHistoryCurve: true, enteredHistoryLabel: "loading dose 2000 mg × 1, no further doses", dosesGiven: 1 })!;
  assert.deepEqual(single.anchors, ["Level 1: 22 mg/L, 6 h after the start of the dose given (T+6 h on the dotted entered-history curve)"]);
  assert.equal(single.referenceLabel, "loading dose 2000 mg × 1, no further doses");
  const two = describeMeasuredLevels({ levels: [{ time_hours: 26, concentration: 30 }, { time_hours: 35.5, concentration: 12 }], hoursAfterLastDose: [2, 11.5], solidIsEnteredHistory: true, hasEnteredHistoryCurve: true, enteredHistoryLabel: enteredLabel, dosesGiven: 3 })!;
  assert.deepEqual(two.anchors, [
    "Level 1: 30 mg/L, 2 h after the start of dose 3 (T+26 h on this curve)",
    "Level 2: 12 mg/L, 11.5 h after the start of dose 3 (T+35.5 h on this curve)",
  ]);
});

test("no measured level, nothing to describe", () => {
  assert.equal(describeMeasuredLevels({ levels: [], hoursAfterLastDose: [], solidIsEnteredHistory: false, hasEnteredHistoryCurve: true, enteredHistoryLabel: enteredLabel }), null);
});

test("stale state: without the entered time after the dose, the anchor carries only what the response holds", () => {
  // While inputs are being edited the form's hours and dose count no longer
  // belong to the result on screen; the workspace then passes neither.
  const d = describeMeasuredLevels({ levels: [{ time_hours: 71, concentration: 9 }], hoursAfterLastDose: [], solidIsEnteredHistory: true, hasEnteredHistoryCurve: true, enteredHistoryLabel: enteredLabel })!;
  assert.deepEqual(d.anchors, ["Level 1: 9 mg/L (T+71 h on this curve)"]);
  const hidden = describeMeasuredLevels({ levels: [{ time_hours: 71, concentration: 9 }], hoursAfterLastDose: [undefined], solidIsEnteredHistory: false, hasEnteredHistoryCurve: false, enteredHistoryLabel: enteredLabel })!;
  assert.deepEqual(hidden.anchors, ["Level 1: 9 mg/L"]);
});
