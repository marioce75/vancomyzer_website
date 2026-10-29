'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { pediatricStatus } from '@/lib/pediatric/status';
import type { PediatricRequest, PediatricResult, PediatricRefusal, PediatricVerificationRequired, ExposureBlock, InputReviewItem } from '@/lib/pediatric/engine';
import { formatOffset, parseWallClock, resolveLocalWithChoice, zoneChoices } from '@/lib/pediatric/localTime';

type AgeUnit = PediatricRequest['patient']['postnatal_age']['unit'];
interface DoseRow { start: string; dose: string; minutes: string; offset?: number }
interface LevelRow { time: string; conc: string; offset?: number }
type ApiResult = (PediatricResult & { curve?: Array<{ time_hours: number; prior: number; posterior?: number }> }) | PediatricRefusal | PediatricVerificationRequired | { status: 'acknowledgement_required'; message: string } | { error: string };
type AckState = 'loading' | 'required' | 'acknowledged' | 'unavailable';

const field = 'block w-full h-9 px-2.5 border rounded-md text-sm border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600';
const fieldErr = 'block w-full h-9 px-2.5 border rounded-md text-sm border-red-500 ring-1 ring-red-500 bg-red-50 text-gray-900';
const label = 'block text-xs font-semibold text-slate-600 mb-0.5';
const f1 = (x: number | null | undefined, d = 1) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(d) : '—');
const f3 = (x: number | null | undefined) => (typeof x === 'number' && Number.isFinite(x) ? (x < 1 ? x.toPrecision(3) : x.toFixed(2)) : '—');
/**
 * Wall-clock entry + selected zone → ISO instant with explicit offset. Never
 * Date.parse on a local string: non-existent times (DST gap) are reported,
 * repeated times (DST fold) require an explicit offset choice, and the resolved
 * offset and UTC instant are shown beside each field.
 */
type Resolution = { kind: 'ok'; iso: string; utc: string; offset: number } | { kind: 'fold'; message: string; options: Array<{ offset: number; iso: string }> } | { kind: 'gap' | 'invalid' | 'empty'; message: string };
const resolve = (local: string, zone: string, offset?: number): Resolution => {
  if (!local) return { kind: 'empty', message: 'Enter a date and time.' };
  const w = parseWallClock(local);
  if (!w) return { kind: 'invalid', message: 'Incomplete or impossible date/time.' };
  const r = resolveLocalWithChoice(w, zone, offset);
  if (r.kind === 'ok') return { kind: 'ok', iso: r.instant.iso, utc: new Date(r.instant.ms).toISOString().replace('.000Z', 'Z'), offset: r.instant.offsetMinutes };
  if (r.kind === 'fold') return { kind: 'fold', message: r.message, options: r.options.map((o) => ({ offset: o.offsetMinutes, iso: o.iso })) };
  return { kind: r.kind, message: r.message };
};
const Resolved = ({ r }: { r: Resolution }) => r.kind === 'ok'
  ? <span className="text-[11px] text-gray-500">= {r.iso} (UTC {r.utc})</span>
  : r.kind === 'empty' ? null : <span className="text-[11px] text-red-700">{r.message}</span>;
const FoldChoice = ({ r, value, onChange, label }: { r: Resolution; value?: number; onChange: (o: number) => void; label: string }) => r.kind === 'fold'
  ? <select aria-label={label} className={field + ' mt-1'} value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))}><option value="">Choose the offset in force…</option>{r.options.map((o, i) => <option key={o.offset} value={o.offset}>{formatOffset(o.offset)} ({i === 0 ? 'first' : 'second'} occurrence → {o.iso})</option>)}</select>
  : null;

export default function PediatricWorkspace() {
  const { data: session, status } = useSession();
  const user = session?.user as Record<string, unknown> | undefined;
  const [age, setAge] = useState('6'); const [ageUnit, setAgeUnit] = useState<AgeUnit>('years');
  const [ga, setGa] = useState(''); const [weight, setWeight] = useState('20'); const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg');
  const [scr, setScr] = useState('0.4'); const [scrUnit, setScrUnit] = useState<'mg/dL' | 'umol/L'>('mg/dL');
  const [rrt, setRrt] = useState(false); const [ecmo, setEcmo] = useState(false); const [nonIv, setNonIv] = useState(false); const [unstable, setUnstable] = useState(false);
  const [ack, setAck] = useState<AckState>('loading'); const [ackChecked, setAckChecked] = useState(false); const [ackError, setAckError] = useState<string | null>(null);
  const [dose, setDose] = useState('300'); const [interval, setInterval_] = useState('6'); const [infusion, setInfusion] = useState('60'); const [nextDose, setNextDose] = useState('');
  const [doses, setDoses] = useState<DoseRow[]>([]); const [levels, setLevels] = useState<LevelRow[]>([]);
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<ApiResult | null>(null); const [netError, setNetError] = useState<string | null>(null);
  const [zone, setZone] = useState<string>(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } });
  const [nextDoseOffset, setNextDoseOffset] = useState<number | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  const zones = useMemo(() => zoneChoices(), []);
  const nextDoseRes = useMemo(() => resolve(nextDose, zone, nextDoseOffset), [nextDose, zone, nextDoseOffset]);
  const doseRes = useMemo(() => doses.map((d) => resolve(d.start, zone, d.offset)), [doses, zone]);
  const levelRes = useMemo(() => levels.map((l) => resolve(l.time, zone, l.offset)), [levels, zone]);
  const timeProblems = [...(doses.length || nextDose ? [nextDoseRes] : []), ...doseRes, ...levelRes].filter((r) => r.kind !== 'ok').length;
  const ageDays = useMemo(() => { const v = Number(age); const k = { days: 1, weeks: 7, months: 365.25 / 12, years: 365.25 }[ageUnit]; return Number.isFinite(v) ? v * k : NaN; }, [age, ageUnit]);
  const gaRequired = Number.isFinite(ageDays) && ageDays < 365.25;
  useEffect(() => { setResult(null); setVerified(false); }, [age, ageUnit, ga, weight, weightUnit, scr, scrUnit, rrt, ecmo, nonIv, unstable, dose, interval, infusion, nextDose, doses, levels, zone]);
  const authed = status === 'authenticated' && user?.role === 'admin' && user?.mfaPending !== true;
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try { const r = await fetch('/api/admin/pediatric', { cache: 'no-store' }); const j = await r.json(); if (!cancelled) setAck(r.ok && j.acknowledged === true ? 'acknowledged' : r.ok ? 'required' : 'unavailable'); }
      catch { if (!cancelled) setAck('unavailable'); }
    })();
    return () => { cancelled = true; };
  }, [authed]);

  if (!authed) return <p>Verified admin sign-in required.</p>;

  const errors: Record<string, string> = result && 'field_errors' in result ? result.field_errors : {};
  const buildRequest = (): PediatricRequest => ({
    patient: {
      postnatal_age: { value: Number(age), unit: ageUnit },
      ...(ga.trim() !== '' ? { gestational_age_weeks: Number(ga) } : {}),
      weight: { value: Number(weight), unit: weightUnit },
      serum_creatinine: { value: Number(scr), unit: scrUnit },
      renal_replacement_therapy: rrt, ecmo, route: nonIv ? 'other' : 'iv', unstable_renal_function: unstable,
    },
    regimen: { dose_mg: Number(dose), interval_hours: Number(interval), infusion_minutes: Number(infusion), ...(nextDose.trim() !== '' && doses.length ? { next_dose_start: nextDoseRes.kind === 'ok' ? nextDoseRes.iso : nextDose } : {}) },
    ...(doses.length ? { doses: doses.map((d, i) => ({ start: doseRes[i].kind === 'ok' ? (doseRes[i] as { iso: string }).iso : d.start, dose_mg: Number(d.dose), infusion_minutes: Number(d.minutes) })) } : {}),
    ...(levels.length ? { levels: levels.map((l, i) => ({ time: levelRes[i].kind === 'ok' ? (levelRes[i] as { iso: string }).iso : l.time, concentration_mg_l: Number(l.conc) })) } : {}),
    ...(verified ? { inputs_verified: true } : {}),
  });
  const submit = async () => {
    if (timeProblems > 0) { setNetError('Resolve the highlighted date/time entries first: enter every dose and sample time and, with a dose history, the next planned dose time. Non-existent or repeated local times need the zone or offset chosen.'); return; }
    setBusy(true); setNetError(null);
    try {
      const res = await fetch('/api/admin/pediatric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildRequest()) });
      const j = (await res.json()) as ApiResult;
      if ('status' in j && j.status === 'acknowledgement_required') { setAck('required'); setAckChecked(false); setResult(null); }
      else setResult(j);
    } catch { setNetError('The calculation request failed. Check the connection and sign-in.'); }
    setBusy(false);
  };
  const acknowledge = async () => {
    setAckError(null);
    try {
      const r = await fetch('/api/admin/pediatric/acknowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledge: true, version: pediatricStatus.acknowledgement.version }) });
      if (r.ok) setAck('acknowledged'); else setAckError(((await r.json()) as { error?: string }).error ?? 'Acknowledgement was not accepted.');
    } catch { setAckError('The acknowledgement request failed.'); }
  };
  const setDoseOffset = (i: number, o: number) => setDoses(doses.map((x, j) => j === i ? { ...x, offset: o } : x));
  const setLevelOffset = (i: number, o: number) => setLevels(levels.map((x, j) => j === i ? { ...x, offset: o } : x));
  const addDose = () => setDoses((d) => [...d, { start: '', dose, minutes: infusion }]);
  const addLevel = () => setLevels((l) => [...l, { time: '', conc: '' }]);
  const ok = result && 'status' in result && result.status === 'ok' ? (result as PediatricResult & { curve?: ApiResult extends infer R ? never : never }) as PediatricResult & { curve?: Array<{ time_hours: number; prior: number; posterior?: number }> } : null;

  return <section className="max-w-6xl space-y-6">
    <header>
      <p className="text-sm font-semibold text-blue-700">ADMIN RESEARCH PREVIEW</p>
      <h1 className="text-3xl font-bold">Vancomyzer Pediatric</h1>
      <p className="mt-2 text-gray-600">Colin 2019 pooled population model · supplementary-NONMEM parameterisation held as a research candidate · manifest {pediatricStatus.manifestVersion}</p>
    </header>
    <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-semibold">Research only — not independently clinically validated — not for patient care.</p>
      <p>{pediatricStatus.message}</p>
      <p className="mt-1">{pediatricStatus.formulationStatement} The discrepancy between the article and its supplement is not treated as resolved.</p>
    </div>

    {ack !== 'acknowledged' && <div className="rounded-xl border border-blue-300 bg-blue-50 p-5 space-y-3 text-sm" role="region" aria-label="Research acknowledgement">
      <h2 className="text-lg font-semibold">Research acknowledgement for this session</h2>
      {ack === 'loading' && <p>Checking this session&apos;s acknowledgement…</p>}
      {ack === 'unavailable' && <p className="text-red-700">The acknowledgement status could not be loaded. Reload the page or sign in again.</p>}
      {(ack === 'required' || ack === 'unavailable') && <>
        <p>The calculator stays locked on the server until you acknowledge the following for this sign-in session (version {pediatricStatus.acknowledgement.version}):</p>
        <blockquote className="border-l-4 border-blue-400 pl-3 italic">{pediatricStatus.acknowledgement.statement}</blockquote>
        <label className="flex items-start gap-2"><input type="checkbox" checked={ackChecked} onChange={(e) => setAckChecked(e.target.checked)} aria-label="I have read and accept the research acknowledgement" /> <span>I have read and accept this statement.</span></label>
        <div className="flex items-center gap-3">
          <button type="button" disabled={!ackChecked} onClick={() => void acknowledge()} className="h-10 px-5 rounded-md text-white font-semibold disabled:opacity-50" style={{ background: '#1e4d8c' }}>Acknowledge for this session</button>
          {ackError && <span className="text-red-700">{ackError}</span>}
        </div>
      </>}
    </div>}

    {ack === 'acknowledged' && <>
    <form className="rounded-xl border bg-white p-5 space-y-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <h2 className="text-lg font-semibold">Patient</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label className={label}>Postnatal age</label><div className="flex gap-1"><input aria-label="Postnatal age" className={errors['patient.postnatal_age'] ? fieldErr : field} inputMode="decimal" value={age} onChange={(e) => setAge(e.target.value)} /><select aria-label="Postnatal age unit" className={field + ' w-28'} value={ageUnit} onChange={(e) => setAgeUnit(e.target.value as AgeUnit)}>{(['days', 'weeks', 'months', 'years'] as AgeUnit[]).map((u) => <option key={u}>{u}</option>)}</select></div>{errors['patient.postnatal_age'] && <span className="text-xs text-red-600">{errors['patient.postnatal_age']}</span>}</div>
        <div><label className={label}>Gestational age at birth (weeks){gaRequired ? ' — required' : ' — optional, 40 assumed'}</label><input aria-label="Gestational age weeks" className={errors['patient.gestational_age_weeks'] ? fieldErr : field} inputMode="decimal" placeholder={gaRequired ? 'e.g. 32' : '40'} value={ga} onChange={(e) => setGa(e.target.value)} />{errors['patient.gestational_age_weeks'] && <span className="text-xs text-red-600">{errors['patient.gestational_age_weeks']}</span>}</div>
        <div><label className={label}>Weight</label><div className="flex gap-1"><input aria-label="Weight" className={errors['patient.weight'] ? fieldErr : field} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /><select aria-label="Weight unit" className={field + ' w-20'} value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as 'kg' | 'g')}><option>kg</option><option>g</option></select></div>{errors['patient.weight'] && <span className="text-xs text-red-600">{errors['patient.weight']}</span>}</div>
        <div><label className={label}>Serum creatinine</label><div className="flex gap-1"><input aria-label="Serum creatinine" className={errors['patient.serum_creatinine'] ? fieldErr : field} inputMode="decimal" value={scr} onChange={(e) => setScr(e.target.value)} /><select aria-label="Creatinine unit" className={field + ' w-28'} value={scrUnit} onChange={(e) => setScrUnit(e.target.value as 'mg/dL' | 'umol/L')}><option>mg/dL</option><option>umol/L</option></select></div>{errors['patient.serum_creatinine'] && <span className="text-xs text-red-600">{errors['patient.serum_creatinine']}</span>}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={rrt} onChange={(e) => setRrt(e.target.checked)} /> Dialysis, haemodiafiltration or CRRT (excluded)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={ecmo} onChange={(e) => setEcmo(e.target.checked)} /> ECMO (excluded)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={nonIv} onChange={(e) => setNonIv(e.target.checked)} /> Non-intravenous route (excluded)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={unstable} onChange={(e) => setUnstable(e.target.checked)} /> Unstable renal function (flag)</label>
      </div>
      <p className="text-xs text-gray-600">Postmenstrual ages inside the dataset gap ({pediatricStatus.supportedAgeRange.datasetGapPmaYears.from}–{pediatricStatus.supportedAgeRange.datasetGapPmaYears.to} years; for a term birth about 40 to 661 days postnatal) are refused; no acknowledgement can override that.</p>
      {['patient.renal_replacement_therapy', 'patient.ecmo', 'patient.route'].filter((k) => errors[k]).map((k) => <p key={k} className="text-sm text-red-700">{errors[k]}</p>)}

      <h2 className="text-lg font-semibold">Current or planned maintenance regimen</h2>
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        <div><label className={label}>Dose (mg)</label><input aria-label="Regimen dose mg" className={errors['regimen.dose_mg'] ? fieldErr : field} inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} />{errors['regimen.dose_mg'] && <span className="text-xs text-red-600">{errors['regimen.dose_mg']}</span>}</div>
        <div><label className={label}>Interval (h)</label><input aria-label="Regimen interval hours" className={errors['regimen.interval_hours'] ? fieldErr : field} inputMode="decimal" value={interval} onChange={(e) => setInterval_(e.target.value)} />{errors['regimen.interval_hours'] && <span className="text-xs text-red-600">{errors['regimen.interval_hours']}</span>}</div>
        <div><label className={label}>Infusion (min)</label><input aria-label="Regimen infusion minutes" className={errors['regimen.infusion_minutes'] ? fieldErr : field} inputMode="decimal" value={infusion} onChange={(e) => setInfusion(e.target.value)} />{errors['regimen.infusion_minutes'] && <span className="text-xs text-red-600">{errors['regimen.infusion_minutes']}</span>}</div>
      </div>
      <h2 className="text-lg font-semibold">Time zone of the entries</h2>
      <div className="max-w-xl"><label className={label}>Zone in which the dose and level times below were recorded</label><select aria-label="Time zone" className={field} value={zone} onChange={(e) => setZone(e.target.value)}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select><p className="text-xs text-gray-600 mt-1">Every time is sent to the server as an instant with an explicit offset. A local time that did not exist (clocks skipped forward) is refused; one that occurred twice (clocks went back) needs the offset chosen. The resolved offset and UTC instant are shown beside each entry.</p></div>
      <div className="max-w-xl"><label className={label}>Next planned dose start <span className="font-normal">(required with a dose history; must be after the last infusion and after every level)</span></label><input aria-label="Next planned dose start" type="datetime-local" className={errors['regimen.next_dose_start'] ? fieldErr : field} value={nextDose} onChange={(e) => { setNextDose(e.target.value); setNextDoseOffset(undefined); }} /> {nextDose && <Resolved r={nextDoseRes} />}<FoldChoice r={nextDoseRes} value={nextDoseOffset} onChange={setNextDoseOffset} label="Next planned dose offset" />{errors['regimen.next_dose_start'] && <span className="block text-xs text-red-600">{errors['regimen.next_dose_start']}</span>}<p className="text-xs text-gray-600 mt-1">Enter the next planned dose time; it is never filled in or inferred. Forecast AUC24 covers the 24 h from that time. A level at or after that time is refused: record the doses actually given, or set this field.</p></div>

      <h2 className="text-lg font-semibold">Actual doses given <span className="text-sm font-normal text-gray-500">(required for levels; start time, mg, infusion minutes)</span></h2>
      {errors.doses && <p className="text-sm text-red-700">{errors.doses}</p>}
      <div className="space-y-2">
        {doses.map((d, i) => <div key={i} className="grid grid-cols-[1fr_6rem_6rem_auto] gap-2 items-end">
          <div><label className={label}>Start</label><input aria-label={`Dose ${i + 1} start`} type="datetime-local" className={errors[`doses[${i}].start`] || doseRes[i].kind === 'gap' || doseRes[i].kind === 'fold' ? fieldErr : field} value={d.start} onChange={(e) => setDoses(doses.map((x, j) => j === i ? { ...x, start: e.target.value, offset: undefined } : x))} /><Resolved r={doseRes[i]} /><FoldChoice r={doseRes[i]} value={d.offset} onChange={(o) => setDoseOffset(i, o)} label={`Dose ${i + 1} offset`} /></div>
          <div><label className={label}>mg</label><input aria-label={`Dose ${i + 1} mg`} className={errors[`doses[${i}].dose_mg`] ? fieldErr : field} inputMode="decimal" value={d.dose} onChange={(e) => setDoses(doses.map((x, j) => j === i ? { ...x, dose: e.target.value } : x))} /></div>
          <div><label className={label}>min</label><input aria-label={`Dose ${i + 1} infusion minutes`} className={errors[`doses[${i}].infusion_minutes`] ? fieldErr : field} inputMode="decimal" value={d.minutes} onChange={(e) => setDoses(doses.map((x, j) => j === i ? { ...x, minutes: e.target.value } : x))} /></div>
          <button type="button" className="h-9 px-3 text-sm border rounded-md" onClick={() => setDoses(doses.filter((_, j) => j !== i))}>Remove</button>
          {['start', 'dose_mg', 'infusion_minutes'].filter((k) => errors[`doses[${i}].${k}`]).map((k) => <span key={k} className="col-span-4 text-xs text-red-600">{errors[`doses[${i}].${k}`]}</span>)}
        </div>)}
        <button type="button" className="h-9 px-3 text-sm border rounded-md bg-gray-50" onClick={addDose}>+ Add dose</button>
      </div>

      <h2 className="text-lg font-semibold">Measured levels <span className="text-sm font-normal text-gray-500">(mg/L = mcg/mL; sample time)</span></h2>
      {errors.levels && <p className="text-sm text-red-700">{errors.levels}</p>}
      <div className="space-y-2">
        {levels.map((l, i) => <div key={i} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-end">
          <div><label className={label}>Sample time</label><input aria-label={`Level ${i + 1} time`} type="datetime-local" className={errors[`levels[${i}].time`] || levelRes[i].kind === 'gap' || levelRes[i].kind === 'fold' ? fieldErr : field} value={l.time} onChange={(e) => setLevels(levels.map((x, j) => j === i ? { ...x, time: e.target.value, offset: undefined } : x))} /><Resolved r={levelRes[i]} /><FoldChoice r={levelRes[i]} value={l.offset} onChange={(o) => setLevelOffset(i, o)} label={`Level ${i + 1} offset`} /></div>
          <div><label className={label}>mg/L</label><input aria-label={`Level ${i + 1} concentration`} className={errors[`levels[${i}].concentration_mg_l`] ? fieldErr : field} inputMode="decimal" value={l.conc} onChange={(e) => setLevels(levels.map((x, j) => j === i ? { ...x, conc: e.target.value } : x))} /></div>
          <button type="button" className="h-9 px-3 text-sm border rounded-md" onClick={() => setLevels(levels.filter((_, j) => j !== i))}>Remove</button>
          {['time', 'concentration_mg_l'].filter((k) => errors[`levels[${i}].${k}`]).map((k) => <span key={k} className="col-span-3 text-xs text-red-600">{errors[`levels[${i}].${k}`]}</span>)}
          {errors[`levels[${i}]`] && <span className="col-span-3 text-xs text-red-600">{errors[`levels[${i}]`]}</span>}
        </div>)}
        <button type="button" className="h-9 px-3 text-sm border rounded-md bg-gray-50" onClick={addLevel}>+ Add level</button>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="h-10 px-5 rounded-md text-white font-semibold disabled:opacity-50" style={{ background: '#1e4d8c' }}>{busy ? 'Calculating…' : 'Calculate (research only)'}</button>
        {netError && <span className="text-sm text-red-700">{netError}</span>}
        {result && 'error' in result && <span className="text-sm text-red-700">{result.error}</span>}
        {result && 'status' in result && result.status !== 'ok' && result.status !== 'needs_verification' && <span className="text-sm text-red-700">{(result as PediatricRefusal).message}</span>}
      </div>
    </form>

    {result && 'status' in result && result.status === 'needs_verification' && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5 space-y-3 text-sm">
      <h2 className="text-lg font-semibold">Verify these inputs before any calculation</h2>
      <p>{(result as PediatricVerificationRequired).message}</p>
      <ReviewList items={(result as PediatricVerificationRequired).input_review} />
      <label className="flex items-start gap-2"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} aria-label="I have verified the flagged values against the chart" /> <span>I have checked the flagged values (weight, unit, age) against the chart and they are correct.</span></label>
      <button type="button" disabled={!verified || busy} onClick={() => void submit()} className="h-10 px-5 rounded-md text-white font-semibold disabled:opacity-50" style={{ background: '#b91c1c' }}>Calculate with verified inputs (research only)</button>
    </div>}

    {ok && <Results r={ok} />}
    </>}

    <div className="rounded-xl border bg-white p-5 space-y-2 text-sm">
      <h2 className="text-lg font-semibold">Scope, evidence and limits</h2>
      <p>Supported: intravenous vancomycin, postmenstrual age ≥ {pediatricStatus.supportedAgeRange.postmenstrualAgeWeeksMin} weeks to postnatal age under 18 years, weight 0.4–160 kg, excluding postmenstrual ages {pediatricStatus.supportedAgeRange.datasetGapPmaYears.from}–{pediatricStatus.supportedAgeRange.datasetGapPmaYears.to} years (no source study enrolled them). Excluded by the source dataset: {pediatricStatus.excluded.join('; ')}. Age convention: {pediatricStatus.supportedAgeRange.ageConvention}. Inclusion of a population in the pooled fit does not establish clinical validation for it.</p>
      <p>Sources: <a className="text-blue-700 underline" href={pediatricStatus.sources.article}>article</a> · <a className="text-blue-700 underline" href={pediatricStatus.sources.supplementNonmem}>NONMEM supplement</a> · <a className="text-blue-700 underline" href={pediatricStatus.sources.guideline2020}>2020 consensus guideline</a>. The guideline&apos;s 400–600 mg·h/L target is for serious MRSA infection at MIC 1 mg/L; pediatric evidence is largely extrapolated from adults.</p>
      <p>Nothing entered here is stored. The adult calculator is a separate workflow and is unchanged.</p>
    </div>
  </section>;
}

function ReviewList({ items }: { items: InputReviewItem[] }) {
  const label: Record<InputReviewItem['category'], string> = { verify: 'VERIFY', outside_model_population: 'OUTSIDE MODEL POPULATION', clinical_validity_unknown: 'CLINICAL VALIDITY UNKNOWN' };
  const colour: Record<InputReviewItem['category'], string> = { verify: 'bg-red-100 text-red-800', outside_model_population: 'bg-amber-100 text-amber-800', clinical_validity_unknown: 'bg-slate-200 text-slate-800' };
  return <ul className="space-y-2">{items.map((it, i) => <li key={i}><span className={'text-[11px] font-semibold px-1.5 py-0.5 rounded mr-2 ' + colour[it.category]}>{label[it.category]}</span>{it.message} <span className="text-xs text-gray-500">Source: {it.source}</span></li>)}</ul>;
}

function Results({ r }: { r: PediatricResult & { curve?: Array<{ time_hours: number; prior: number; posterior?: number }> } }) {
  const basisLabel: Record<PediatricResult['estimate_basis'], string> = { prior_only: 'Population prior only (no level used)', posterior_one_level: 'Bayesian posterior — one level', posterior_two_level: 'Bayesian posterior — two levels', posterior_multi_level: `Bayesian posterior — ${r.level_count} levels` };
  const best = r.posterior ?? r.prior;
  const inBand = (a: number | null | undefined) => typeof a === 'number' ? (a < r.target.auc24_low ? 'below 400' : a > r.target.auc24_high ? 'above 600' : 'within 400–600') : '—';
  const Exposure = ({ e, title }: { e: ExposureBlock; title: string }) => <div className="rounded-lg border p-3 space-y-1 text-sm">
    <p className="font-semibold">{title}</p>
    <p>Steady-state AUC24: <b>{f1(e.steady_state_auc24, 0)}</b> mg·h/L {e.steady_state_auc24_interval && <span className="text-gray-600">(median {f1(e.steady_state_auc24_interval.median, 0)}; 90%: {f1(e.steady_state_auc24_interval.lower, 0)}–{f1(e.steady_state_auc24_interval.upper, 0)})</span>} · {inBand(e.steady_state_auc24)}</p>
    <p>Forecast AUC24, next 24 h from the next planned dose: <b>{e.forecast_auc24_next24h === null ? 'no dose history' : f1(e.forecast_auc24_next24h, 0)}</b> {e.forecast_auc24_interval && <span className="text-gray-600">(90%: {f1(e.forecast_auc24_interval.lower, 0)}–{f1(e.forecast_auc24_interval.upper, 0)})</span>}</p>
    {r.timeline && <p className="text-gray-600">Forecast window: {r.timeline.forecast_window.start.replace('.000Z', 'Z')} to {r.timeline.forecast_window.end.replace('.000Z', 'Z')} ({r.timeline.next_dose_anchor === 'regimen.next_dose_start' ? 'next dose as entered' : 'last dose + interval'}{r.timeline.last_level_hours !== null ? `; last level at ${f1(r.timeline.last_level_hours)} h` : ''}).</p>}
    <p>Previous 24 h from recorded doses: {e.observed_window_auc24 === null ? '—' : f1(e.observed_window_auc24, 0)} · Steady-state peak/trough: {f1(e.steady_state_peak)} / {f1(e.steady_state_trough)} mg/L · t½β {f1(e.terminal_half_life_hours)} h</p>
  </div>;
  return <div className="space-y-4">
    <div className="rounded-xl border bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Result</h2>
        <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">{basisLabel[r.estimate_basis]}</span>
        <span className="text-xs font-semibold px-2 py-1 rounded bg-amber-100 text-amber-800">RESEARCH ONLY · {r.formulation}</span>
      </div>
      <p className="text-sm text-gray-700">Model PMA {r.derived.pma_years.toFixed(4)} y ({f1(r.derived.pma_weeks, 2)} wk; clinical PMA {f1(r.derived.pma_weeks_clinical, 2)} wk; GA {r.derived.gestational_age_weeks} wk{r.derived.gestational_age_assumed ? ', assumed' : ''}; postnatal {f1(r.derived.postnatal_age_days, 1)} d) · weight {f3(r.derived.weight_kg)} kg · SCr {f3(r.derived.scr_mg_dl)} mg/dL (age-standard {f3(r.derived.scr_std_mg_dl)}) · Fmat {f3(r.derived.covariate_factors.fMat)} · Fage {f3(r.derived.covariate_factors.fAge)} · Fscr {f3(r.derived.covariate_factors.fScr)}</p>
      <div className="grid md:grid-cols-2 gap-3">
        <Exposure e={r.prior.exposure} title="Population prior (η = 0)" />
        {r.posterior ? <Exposure e={r.posterior.exposure} title="Individual posterior (MAP)" /> : <div className="rounded-lg border border-dashed p-3 text-sm text-gray-500">No posterior: add the actual doses and at least one measured level.</div>}
      </div>
      <table className="text-sm w-full max-w-2xl"><thead><tr className="text-left text-gray-500"><th>Parameter</th><th>Prior</th><th>Posterior</th><th>η (SD)</th></tr></thead><tbody>
        {(['CL', 'V1', 'V2', 'Q'] as const).map((k) => <tr key={k} className="border-t"><td className="py-1">{k} ({k === 'CL' || k === 'Q' ? 'L/h' : 'L'})</td><td>{f3(r.prior.parameters[k])}</td><td>{r.posterior ? f3(r.posterior.parameters[k]) : '—'}</td><td>{r.posterior?.parameters.eta && k !== 'Q' ? `${r.posterior.parameters.eta[k].toFixed(3)} (${r.posterior.fit.eta_sd ? r.posterior.fit.eta_sd[k].toFixed(3) : 'n/a'})` : k === 'Q' ? 'no η in model' : '—'}</td></tr>)}
      </tbody></table>
      {r.posterior && <div className="text-sm">
        <p className="font-semibold">Fit</p>
        <p>Objective {f3(r.posterior.fit.objective)} (data {f3(r.posterior.fit.nll)}, prior penalty {f3(r.posterior.fit.prior_penalty)}); {r.posterior.fit.converged ? 'converged' : 'not converged'} in {r.posterior.fit.iterations} iterations from {r.posterior.fit.starts} starts. Intervals: {r.posterior.fit.posterior_sampling ? `${r.posterior.fit.posterior_sampling.method.replace(/_/g, ' ')}, ${r.posterior.fit.posterior_sampling.draws} draws, effective sample size ${r.posterior.fit.posterior_sampling.effective_sample_size.toFixed(0)}` : 'none'}; η SDs in the table are the Laplace diagnostic.</p>
        <table className="w-full max-w-2xl mt-1"><thead><tr className="text-left text-gray-500"><th>Level time (h from dose 1)</th><th>Observed</th><th>Predicted</th><th>Residual / σ</th></tr></thead><tbody>
          {r.posterior.fit.predicted_at_levels.map((p, i) => <tr key={i} className="border-t"><td>{f1(p.timeHours)}</td><td>{f1(p.observed)}</td><td>{f1(p.predicted)}</td><td>{f1(p.standardisedResidual, 2)}</td></tr>)}
        </tbody></table>
      </div>}
      <p className="text-sm text-gray-700">Sensitivity (article transcription of Eq. 6): CL {f3(r.sensitivity.article_transcription.CL)} L/h, steady-state AUC24 {f1(r.sensitivity.article_transcription.steady_state_auc24, 0)}; fitted/article clearance ratio {f3(r.sensitivity.clearance_ratio_fitted_to_article)}.</p>
      {r.curve && r.curve.length > 1 && <Curve curve={r.curve} />}
    </div>

    <div className="rounded-xl border bg-white p-5 space-y-2">
      <h2 className="text-lg font-semibold">Candidate regimens <span className="text-sm font-normal text-gray-500">(steady state, {r.posterior ? 'posterior' : 'prior'} parameters; research only)</span></h2>
      <p className="text-sm">{r.target.statement}</p>
      <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr className="text-left text-gray-500"><th>mg/kg</th><th>Dose (mg)</th><th>Interval</th><th>Infusion</th><th>mg/kg/day</th><th>AUC24</th><th>Peak</th><th>Trough</th><th>Flags</th></tr></thead><tbody>
        {r.candidate_regimens.map((c, i) => <tr key={i} className={'border-t ' + (c.in_target ? 'bg-green-50' : '')}><td>{c.dose_mg_per_kg}</td><td>{c.dose_mg}</td><td>q{c.interval_hours}h</td><td>{c.infusion_minutes} min</td><td>{f1(c.daily_dose_mg_per_kg, 0)}</td><td className="font-semibold">{f1(c.auc24, 0)}</td><td>{f1(c.peak)}</td><td>{f1(c.trough)}</td><td className="text-xs text-amber-700">{c.flags.join('; ')}</td></tr>)}
      </tbody></table></div>
      <p className="text-xs text-gray-500">Current regimen with {r.posterior ? 'posterior' : 'prior'} parameters: AUC24 {f1(best.exposure.steady_state_auc24, 0)} ({inBand(best.exposure.steady_state_auc24)}).</p>
    </div>

    {r.input_review.items.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><p className="font-semibold">Input review{r.input_review.verified ? ' (flagged values verified by the administrator)' : ''}</p><ReviewList items={r.input_review.items} /></div>}
    {r.timeline && <div className="rounded-xl border bg-white p-4 text-sm"><p className="font-semibold">Dose history as modelled (chronological; row numbers as entered)</p><table className="w-full max-w-3xl mt-1"><thead><tr className="text-left text-gray-500"><th>Row</th><th>Start</th><th>End of infusion</th><th>h from dose 1</th><th>mg</th><th>min</th></tr></thead><tbody>{r.timeline.doses.map((d) => <tr key={d.row} className="border-t"><td>{d.row}</td><td>{d.start.replace('.000Z', 'Z')}</td><td>{d.end.replace('.000Z', 'Z')}</td><td>{f1(d.start_hours)}</td><td>{d.dose_mg}</td><td>{d.infusion_minutes}</td></tr>)}</tbody></table>{r.timeline.levels.length > 0 && <table className="w-full max-w-3xl mt-2"><thead><tr className="text-left text-gray-500"><th>Level row</th><th>Time</th><th>h from dose 1</th><th>mg/L</th></tr></thead><tbody>{r.timeline.levels.map((l) => <tr key={l.row} className="border-t"><td>{l.row}</td><td>{l.time.replace('.000Z', 'Z')}</td><td>{f1(l.time_hours)}</td><td>{l.concentration_mg_l}</td></tr>)}</tbody></table>}<p className="text-xs text-gray-600 mt-1">Next planned dose {r.timeline.next_planned_dose.replace('.000Z', 'Z')} ({r.timeline.next_dose_anchor === 'regimen.next_dose_start' ? 'as entered' : 'last dose + interval'}); forecast window {r.timeline.forecast_window.start.replace('.000Z', 'Z')} to {r.timeline.forecast_window.end.replace('.000Z', 'Z')}.</p></div>}
    {r.warnings.filter((w) => !r.input_review.items.some((it) => it.message === w)).length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><p className="font-semibold">Warnings</p><ul className="list-disc pl-5">{r.warnings.filter((w) => !r.input_review.items.some((it) => it.message === w)).map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
    <div className="grid md:grid-cols-2 gap-3 text-sm">
      <div className="rounded-xl border bg-white p-4"><p className="font-semibold">Assumptions</p><ul className="list-disc pl-5">{r.assumptions.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
      <div className="rounded-xl border bg-white p-4"><p className="font-semibold">Model limitations</p><ul className="list-disc pl-5">{r.limitations.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
    </div>
  </div>;
}

function Curve({ curve }: { curve: Array<{ time_hours: number; prior: number; posterior?: number }> }) {
  const W = 720, H = 220, L = 44, B = 28;
  const tMax = curve[curve.length - 1].time_hours;
  const cMax = Math.max(1, ...curve.map((p) => Math.max(p.prior, p.posterior ?? 0))) * 1.1;
  const x = (t: number) => L + (t / tMax) * (W - L - 8);
  const y = (c: number) => H - B - (c / cMax) * (H - B - 8);
  const path = (key: 'prior' | 'posterior') => curve.filter((p) => typeof p[key] === 'number').map((p, i) => `${i ? 'L' : 'M'}${x(p.time_hours).toFixed(1)},${y(p[key] as number).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl" role="img" aria-label="Predicted concentration-time curve">
    {ticks.map((f) => <g key={f}><line x1={L} x2={W - 8} y1={y(f * cMax)} y2={y(f * cMax)} stroke="#e5e7eb" /><text x={L - 4} y={y(f * cMax) + 4} fontSize="10" textAnchor="end" fill="#6b7280">{(f * cMax).toFixed(0)}</text></g>)}
    {ticks.map((f) => <text key={f} x={x(f * tMax)} y={H - 10} fontSize="10" textAnchor="middle" fill="#6b7280">{(f * tMax).toFixed(0)} h</text>)}
    <path d={path('prior')} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 3" />
    {curve.some((p) => typeof p.posterior === 'number') && <path d={path('posterior')} fill="none" stroke="#1e4d8c" strokeWidth="2" />}
    <text x={W - 8} y={14} fontSize="10" textAnchor="end" fill="#374151">dashed grey: prior · blue: posterior · mg/L vs hours from dose 1 (planned regimen continued)</text>
  </svg>;
}
