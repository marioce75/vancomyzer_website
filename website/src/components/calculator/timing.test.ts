import assert from 'node:assert/strict';
import { test } from 'node:test';
import { timingDraft, withTiming, switchTimingMode, withManualHours, timingIsValid, requestLevel, buildDateTime, isEnteredLevel, type LevelDraft, type TimingDraft } from './levelTiming';
import { nextInputRevision, responseIsCurrent, resultIsCurrent } from './inputRevision';
import { clinicalDraftReplacer, clinicalDraftReviver } from '@/lib/parseClinicalNumber';
const blank = (): LevelDraft => ({ value_mcg_ml: 0, collection_time: '', time_since_last_dose_hours: 0 });
const complete: TimingDraft = { dateMode: true, doseDate: '2026-10-11', doseTime: '08:00', levelDate: '2026-10-11', levelTime: '19:00' };
const sample = () => withTiming({ ...blank(), value_mcg_ml: 10 }, complete);
test('second row times use displayed default dates without calendar edits', () => {
  let level = { ...blank(), value_mcg_ml: 20 };
  level = withTiming(level, { ...timingDraft(level, '2026-10-11'), doseTime: '08:00' });
  assert.equal(timingIsValid(level), false);
  level = withTiming(level, { ...timingDraft(level, '2026-10-11'), levelTime: '11:00' });
  assert.equal(level.time_since_last_dose_hours, 3);
  assert.equal(timingIsValid(level), true);
});
for (const [field, value] of [['levelTime', ''], ['doseTime', ''], ['doseTime', '20:00'], ['levelDate', '-10-11'], ['doseDate', '202-10-11'], ['levelTime', '14:'], ['levelTime', '25:00'], ['levelDate', '2026-02-30']] as const) {
  test(`invalid edit ${field}=${value} clears derived timing; repeated re-entry recovers`, () => {
    let level = sample();
    for (let i = 0; i < 3; i++) {
      level = withTiming(level, { ...complete, [field]: value });
      assert.equal(level.collection_time, '');
      assert.ok(Number.isNaN(level.time_since_last_dose_hours));
      assert.equal(timingIsValid(level), false);
      assert.equal(isEnteredLevel(level), true);
      const restored = JSON.parse(JSON.stringify(level, clinicalDraftReplacer), clinicalDraftReviver);
      assert.equal(timingIsValid(restored), false);
      assert.equal(timingDraft(restored, '2027-01-01')[field], value);
      level = withTiming(level, complete);
      assert.equal(level.time_since_last_dose_hours, 11);
      assert.equal(timingIsValid(level), true);
    }
  });
}
test('remove/re-add second row never resurrects its old draft or mode', () => {
  let rows = [sample(), switchTimingMode(sample(), complete)];
  rows = [rows[0]];
  rows.push(blank());
  assert.equal(timingDraft(rows[1], '2026-10-12').dateMode, true);
  assert.equal(timingDraft(rows[1], '2026-10-12').levelTime, '');
  assert.equal(timingIsValid(rows[0]), true);
});
test('mode switching requires fresh manual hours and retains calendar draft', () => {
  let level = switchTimingMode(sample(), complete);
  assert.equal(timingIsValid(level), false);
  level = withManualHours(level, 7.47);
  assert.equal(timingIsValid(level), true);
  assert.equal(level.time_since_last_dose_hours, 7.47);
  level = switchTimingMode(level, level.timing!);
  assert.equal(level.time_since_last_dose_hours, 11);
  assert.equal(timingIsValid(level), true);
});
test('remount restores legacy calendar row with the same infusion-start reference', () => {
  const request = requestLevel(sample());
  assert.deepEqual(timingDraft(request, '2028-01-01'), complete);
  assert.deepEqual(requestLevel(withTiming(request, timingDraft(request, '2028-01-01'))), request);
});
test('cross-midnight/zero remain chronological; invalid dates never normalize', () => {
  assert.equal(withTiming(blank(), { ...complete, doseTime: '23:00', levelDate: '2026-10-12', levelTime: '02:00' }).time_since_last_dose_hours, 3);
  assert.equal(withTiming(blank(), { ...complete, levelTime: '08:00' }).time_since_last_dose_hours, 0);
  assert.equal(buildDateTime('2026-02-29', '12:00'), null);
  assert.ok(buildDateTime('2028-02-29', '12:00'));
});
test('API contract strips UI metadata', () => {
  assert.deepEqual(Object.keys(requestLevel(sample())).sort(), ['collection_time', 'time_since_last_dose_hours', 'value_mcg_ml']);
});
test('locale-only renders preserve freshness; A→B→A and superseded responses remain stale', () => {
  const inputs = { levels: [sample()], regimen: { dose_mg: 1000, interval_hours: 12 } };
  const first = nextInputRevision({ key: '', revision: 0 }, inputs);
  let current = first;
  for (const locale of ['en', 'es', 'fr', 'pt-BR', 'en']) {
    assert.ok(locale);
    current = nextInputRevision(current, JSON.parse(JSON.stringify(inputs)));
    assert.equal(current.revision, first.revision);
    assert.equal(resultIsCurrent(first.revision, current.revision), true);
  }
  current = nextInputRevision(current, { ...inputs, levels: [withTiming(sample(), { ...complete, levelTime: '' })] });
  assert.equal(responseIsCurrent(1, 1, first.revision, current.revision), false);
  assert.equal(resultIsCurrent(first.revision, current.revision), false);
  current = nextInputRevision(current, inputs);
  assert.equal(responseIsCurrent(1, 1, first.revision, current.revision), false);
  assert.equal(responseIsCurrent(1, 2, current.revision, current.revision), false);
  assert.equal(responseIsCurrent(2, 2, current.revision, current.revision), true);
  assert.equal(resultIsCurrent(null, current.revision), false);
});

// Exercise real component event handlers with a small hook dispatcher. These
// tests do not claim browser/DOM coverage; native visual QA remains separate.
import React from 'react';
import DatePartInput from './DatePartInput';
import LevelEntryTable from './LevelEntryTable';
type Node = React.ReactElement<Record<string, unknown>>;
function nodes(tree: React.ReactNode): Node[] {
  if (!React.isValidElement(tree)) return [];
  const node = tree as Node;
  return [node, ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(nodes)];
}
function hooks<P>(component: (props: P) => React.ReactNode) {
  const cells: unknown[] = [];
  let index = 0;
  const internals = (React as unknown as { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: { ReactCurrentDispatcher: { current: unknown } } }).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const dispatcher = {
    useState(initial: unknown) {
      const i = index++;
      if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial;
      return [cells[i], (v: unknown) => { cells[i] = typeof v === 'function' ? v(cells[i]) : v; }];
    },
    useRef(initial: unknown) { const i = index++; if (!(i in cells)) cells[i] = { current: initial }; return cells[i]; },
    useCallback(callback: unknown) { return callback; },
    // Tests render controlled values themselves; no DOM or passive effect scheduler.
    useEffect() {},
  };
  return (props: P) => {
    index = 0;
    const saved = internals.ReactCurrentDispatcher.current;
    internals.ReactCurrentDispatcher.current = dispatcher;
    try { return nodes(component(props)); } finally { internals.ReactCurrentDispatcher.current = saved; }
  };
}
test('DatePartInput reports clearing a date segment immediately and preserves partial re-entry', () => {
  const render = hooks(DatePartInput);
  let value = '2026-10-11';
  const props = () => ({ value, onChange: (v: string) => { value = v; } });
  for (const year of ['', '2', '20', '202', '2026']) {
    const input = render(props()).find(n => n.props['aria-label'] === 'Year')!;
    assert.ok(input);
    (input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: year } });
    assert.equal(value, `${year}-10-11`);
  }
});
test('real row handlers retain rapid timing/concentration edits and invalidate a cleared sample', () => {
  const render = hooks(LevelEntryTable);
  let levels: LevelDraft[] = [blank(), blank()];
  const props = () => ({ levels, onChange: (next: LevelDraft[]) => { levels = next; } });
  let tree = render(props());
  const dose = tree.filter(n => n.props.placeholder === 'e.g. 0800')[1];
  const draw = tree.filter(n => n.props.placeholder === 'e.g. 1435')[1];
  const concentration = tree.filter(n => n.props.placeholder === 'e.g. 18.5')[1];
  // Deliberately no render between these events: reproduces rapid edits.
  (dose.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '0800' } });
  (draw.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '1900' } });
  (concentration.props.onValueChange as (v: number) => void)(10);
  assert.equal(levels[1].value_mcg_ml, 10);
  assert.equal(levels[1].time_since_last_dose_hours, 11);
  assert.equal(timingIsValid(levels[1]), true);
  tree = render(props());
  (tree.filter(n => n.props.placeholder === 'e.g. 1435')[1].props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '' } });
  assert.equal(levels[1].collection_time, '');
  assert.equal(timingIsValid(levels[1]), false);
  levels = [levels[0]];
  render(props());
  levels = [...levels, blank()];
  tree = render(props());
  assert.equal(tree.filter(n => n.props.placeholder === 'e.g. 1435')[1].props.value, '');
});
import { restoreLevelDrafts } from './levelTiming';
test('pre-fix session calendar timestamps cannot silently survive the migration', () => {
  const oldCalendar = requestLevel(sample());
  const oldManual = withManualHours(blank(), 3);
  const restored = restoreLevelDrafts([oldCalendar, oldManual, blank()], undefined);
  assert.equal(restored[0].value_mcg_ml, 10);
  assert.equal(restored[0].collection_time, '');
  assert.equal(timingIsValid(restored[0]), false);
  assert.deepEqual(restored[1], oldManual);
  assert.deepEqual(restored[2], blank());
  assert.deepEqual(restoreLevelDrafts([sample()], 1), [sample()]);
});
import { runExistingRegimenPipeline } from '@/lib/pk/runExistingRegimenPipeline';
test('valid calendar/manual timing produces quantitatively identical PK outputs to explicit known-good requests', () => {
  const patient = { age: 55, weight_kg: 70, height_cm: 170, sex: 'male' as const, serum_creatinine_mg_dl: 1 };
  const regimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 100 / 60, doses_given: 5, steady_state_confirmed: false };
  for (const manual of [false, true]) {
    for (const count of [1, 2]) {
      const hours = [3, 11].slice(0, count);
      const known = hours.map((h, i) => ({ value_mcg_ml: [20, 10][i], time_since_last_dose_hours: h, collection_time: manual ? new Date(Date.UTC(2000, 0, 1, h)).toISOString() : new Date(`2026-10-11T${h + 8}:00:00`).toISOString() }));
      const edited = hours.map((h, i) => {
        const row = { ...blank(), value_mcg_ml: [20, 10][i] };
        return requestLevel(manual ? withManualHours(row, h) : withTiming(row, { ...complete, levelTime: `${h + 8}:00` }));
      });
      assert.deepEqual(edited, known);
      const expected = runExistingRegimenPipeline({ patient, regimen, levels: known });
      const actual = runExistingRegimenPipeline({ patient, regimen, levels: edited });
      assert.ok(!('ok' in actual && actual.ok === false));
      assert.deepEqual(actual, expected); // Includes all numerical parameters, exposures and curve points.
    }
  }
});
