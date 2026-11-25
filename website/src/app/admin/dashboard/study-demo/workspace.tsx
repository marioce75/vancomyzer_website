"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import CalculatorLayout from "@/components/calculator/CalculatorLayout";
import CalculatorActionBar from "@/components/calculator/CalculatorActionBar";
import InputSection from "@/components/calculator/InputSection";
import Advisory from "@/components/calculator/Advisory";
import { draftFromPreset, trainingCurve, trainingInput, type TrainingDose, type TrainingDraft } from "@/lib/studyDemo/trainingDraft";
import { LIMITS, predictAtDraw, type TimedCaseInput, type TimedPredictionResult } from "@/lib/studyTimed/predictAtDraw";

type FictionalCase = { title: string; story: string; input: TimedCaseInput };
const BANNER = "Fictional case only • Research demo • Not for patient care";
const muted = { color: "var(--color-secondary)" };
const input = "vz-input !h-8 min-w-0";
const button = "rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-highlight)] disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-0.5 block text-xs font-semibold" style={muted}>{label}</span>{children}</label>;
}

function Panel({ id, title, className = "", children }: { id: string; title: string; className?: string; children: ReactNode }) {
  return <section aria-labelledby={id} className={`vz-panel ${className}`}>
    <div className="vz-panel-head"><h2 id={id} className="vz-panel-title m-0">{title}</h2></div>
    <div className="p-3 text-sm" style={muted}>{children}</div>
  </section>;
}

function StudyCurve({ points }: { points: ReturnType<typeof trainingCurve> }) {
  if (!points.length) return <div className="flex h-40 items-center justify-center text-center text-xs">Calculate to see the concentration profile from the first dose to the draw.</div>;
  const last = points[points.length - 1];
  const max = Math.max(5, Math.ceil(Math.max(...points.map((p) => p.concentration)) / 5) * 5);
  const x = (h: number) => 47 + h / last.hour * 405;
  const y = (c: number) => 173 - c / max * 139;
  const line = points.map((p) => `${x(p.hour).toFixed(2)},${y(p.concentration).toFixed(2)}`).join(" ");
  return <svg viewBox="0 0 475 209" className="mx-auto block max-h-[350px] w-full" role="img" aria-label="Predicted concentration-time profile ending at the first draw">
    <text x="47" y="16" fill="currentColor" fontSize="11">Concentration (mg/L)</text>
    {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1="47" x2="452" y1={y(f * max)} y2={y(f * max)} stroke="var(--color-border)" /><text x="40" y={y(f * max) + 4} textAnchor="end" fill="currentColor" fontSize="10">{Number((f * max).toFixed(1))}</text></g>)}
    <polyline points={line} fill="none" stroke="var(--color-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    <line x1="452" x2="452" y1="34" y2="174" stroke="var(--color-secondary)" strokeDasharray="4 4" />
    <circle cx="452" cy={y(last.concentration)} r="4" fill="var(--color-primary)" />
    <text x="47" y="188" fill="currentColor" fontSize="10">0 h</text>
    <text x="452" y="188" textAnchor="end" fill="currentColor" fontSize="10">{Number(last.hour.toFixed(3))} h · draw</text>
    <text x="248" y="205" textAnchor="middle" fill="currentColor" fontSize="11">Hours after first dose</text>
  </svg>;
}

export default function StudyDemoWorkspace({ cases }: { cases: FictionalCase[] }) {
  const [selected, setSelected] = useState(0);
  const preset = cases[selected];
  const [draft, setDraft] = useState(() => draftFromPreset(cases[0].input));
  const [edited, setEdited] = useState(false);
  const [output, setOutput] = useState<{ result: TimedPredictionResult; points: ReturnType<typeof trainingCurve> } | null>(null);
  const [lab, setLab] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const rowKey = useRef(cases[0].input.doses.length);
  const result = output?.result;

  function clear() {
    revision.current++;
    setOutput(null);
    setLab(null);
    setError("");
    setBusy(false);
  }

  function reset(index = selected) {
    clear();
    setSelected(index);
    const fresh = draftFromPreset(cases[index].input);
    setDraft(fresh);
    rowKey.current = fresh.doses.length;
    setEdited(false);
  }

  function change(f: (d: TrainingDraft) => TrainingDraft) {
    clear();
    setEdited(true);
    setDraft(f);
  }

  function setDose(key: number, field: "start" | "mg" | "minutes", value: string) {
    change((d) => ({ ...d, complete: false, doses: d.doses.map((dose) => dose.key === key ? { ...dose, [field]: value } : dose) }));
  }

  function addDose() {
    const dose: TrainingDose = { key: rowKey.current++, start: "", mg: "", minutes: "" };
    change((d) => ({ ...d, complete: false, doses: [...d.doses, dose] }));
  }

  function calculate() {
    clear();
    // No request, clipboard, browser storage or logging: all entered values stay in memory.
    const entered = trainingInput(preset.input, draft);
    const p = predictAtDraw(entered);
    setOutput({ result: p, points: trainingCurve(entered, p) });
  }

  async function reveal() {
    if (edited || result?.status !== "predicted") return;
    const pending = revision.current;
    setBusy(true);
    try {
      // Only the immutable preset ID/action can be transmitted; no training-draft object enters this closure.
      const response = await fetch("/api/admin/study-demo", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: preset.input.study_case_id, action: "reveal" }),
      });
      if (!response.ok) throw new Error("Preset lab result unavailable");
      const data = await response.json();
      if (revision.current === pending) setLab(data.fictional_lab_result_mg_l);
    } catch {
      if (revision.current === pending) setError("The preset lab result is unavailable. The prediction above is unchanged.");
    } finally {
      if (revision.current === pending) setBusy(false);
    }
  }

  const left = <div className="flex min-h-full flex-col">
    <InputSection id="study-patient" title="Patient" completed hint="Fictional preset">
      <p className="m-0 mb-2 text-xs" style={muted}>{edited ? "Preset patient details are unchanged. The dosing or sampling timeline has been edited." : preset.story}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label="Age (years)"><input className={input} readOnly value={preset.input.age_years} /></Field>
        <Field label="Weight (kg)"><input className={input} readOnly value={preset.input.weight_kg} /></Field>
      </div>
      <p className="vz-kicker mb-1 mt-2 border-t border-[var(--color-border)] pt-1.5">Renal function</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label="Serum creatinine (mg/dL)"><input className={input} readOnly value={preset.input.serum_creatinine_mg_dl} /></Field>
        <Field label="Renal replacement therapy"><input className={input} readOnly value={preset.input.renal_replacement_therapy ? "Yes" : "No"} /></Field>
      </div>
      <p className="mb-0 mt-1.5 text-[11px]" style={muted}>Height, sex and measured drug levels aren’t inputs to this timed forecast.</p>
    </InputSection>
    <InputSection id="study-history" title="Dosing history" completed={draft.doses.length > 0 && draft.complete}>
      <p id="study-time-help" className="mb-2 text-xs" style={muted}>Enter doses actually given, not scheduled doses. All training dates and times below use UTC.</p>
      <div className="space-y-2">
        {draft.doses.map((d, i) => <fieldset key={d.key} className="min-w-0 border border-[var(--color-border)] px-2 pb-2 pt-1">
          <legend className="px-1 text-xs font-bold">Dose {i + 1}</legend>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="vz-kicker">Actual IV administration</span>
            <button type="button" className={button} aria-label={`Remove dose ${i + 1}`} onClick={() => change((p) => ({ ...p, complete: false, doses: p.doses.filter((row) => row.key !== d.key) }))}>Remove</button>
          </div>
          <Field label="Start date and time (UTC)"><input className={input} type="datetime-local" step="1" aria-label={`Dose ${i + 1} start date and time (UTC)`} autoComplete="off" value={d.start} onChange={(e) => setDose(d.key, "start", e.target.value)} /></Field>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <Field label="Dose (mg)"><input className={input} type="number" step="any" inputMode="decimal" aria-label={`Dose ${i + 1} amount (mg)`} autoComplete="off" value={d.mg} onChange={(e) => setDose(d.key, "mg", e.target.value)} /></Field>
            <Field label="Infusion duration (minutes)"><input className={input} type="number" step="any" inputMode="decimal" aria-label={`Dose ${i + 1} infusion duration (minutes)`} autoComplete="off" value={d.minutes} onChange={(e) => setDose(d.key, "minutes", e.target.value)} /></Field>
          </div>
        </fieldset>)}
      </div>
      <button type="button" className={`mt-2 ${button}`} onClick={addDose} disabled={draft.doses.length >= LIMITS.maxDoses}>+ Add dose</button>
      <label className="mt-2 flex items-start gap-2 text-xs" style={muted}>
        <input type="checkbox" checked={draft.complete} className="mt-0.5" onChange={(e) => { const complete = e.target.checked; change((d) => ({ ...d, complete })); }} />
        <span>All administrations from the first dose through the draw are listed.</span>
      </label>
    </InputSection>
    <InputSection id="study-draw" title="First blood draw" completed={!!draft.draw}>
      <Field label="Draw date and time (UTC)"><input className={input} type="datetime-local" step="1" autoComplete="off" value={draft.draw} onChange={(e) => { const draw = e.target.value; change((d) => ({ ...d, draw, complete: false })); }} /></Field>
      <p className="mb-0 mt-1.5 text-xs" style={muted}>Enter the collection time only. The measured concentration does not enter the prediction.</p>
    </InputSection>
    <div className="sticky bottom-0 z-10 mt-auto border-t px-3 py-2" style={{ borderTopColor: "var(--color-border)", background: "var(--color-card)", boxShadow: "0 -4px 12px rgba(0,0,0,0.06)" }}>
      <CalculatorActionBar onCalculate={calculate} onReset={() => reset()} />
    </div>
  </div>;

  const right = <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 lg:p-2.5">
    <div className="vz-results">
      <Panel id="study-result" title="Predicted concentration at the draw" className="vz-area-band">
        {result?.status === "predicted" ? <>
          <div role="status" className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <strong className="vz-num text-4xl" style={{ color: "var(--color-primary)" }}>{result.predicted_concentration_mg_l!.toFixed(2)} <span className="text-xl">mg/L</span></strong>
            <span>At {Number(result.draw_elapsed_hours!.toFixed(3))} h after the first dose · {result.doses_used} {result.doses_used === 1 ? "dose" : "doses"} used</span>
          </div>
          {result.warnings.map((w) => <div key={w.code} className="mt-2"><Advisory severity="caution" title={w.message} /></div>)}
        </> : result?.status === "refused" ? <div role="alert"><strong>No prediction</strong><ul className="ml-5 list-disc">{result.reasons.map((r, i) => <li key={`${r.code}-${i}`}>{r.message}</li>)}</ul></div>
          : <Advisory severity="info" title={edited ? "Inputs updated" : "Ready to calculate"} summary="Review the actual dose history and draw time, then press Calculate." role="status" />}
        <p className="mb-0 mt-2 border-t border-[var(--color-border)] pt-2 text-xs">No measured level used. No steady-state assumption. No dose recommendation.</p>
      </Panel>
      <Panel id="study-curve" title="Concentration-time profile" className="vz-area-graph">
        <StudyCurve points={output?.points ?? []} />
      </Panel>
      <aside aria-label="Study and calculation details" className="vz-area-side flex min-w-0 flex-col gap-2">
        <Panel id="study-compare" title="Fictional lab comparison">
          {edited ? <p>Edited training timeline. The preset lab result does not apply. Reset to the original preset to reveal it.</p>
            : lab !== null ? <p role="status">Fictional lab result: <strong>{lab.toFixed(1)} mg/L</strong><br />Prediction minus fictional result: {(result!.predicted_concentration_mg_l! - lab).toFixed(2)} mg/L. Invented for this demo.</p>
              : <button type="button" className={button} disabled={result?.status !== "predicted" || busy} onClick={reveal}>Reveal fictional lab result</button>}
          {error && <p role="alert" className="mt-2">{error}</p>}
        </Panel>
        <Panel id="study-details" title="Calculation details">
          <p>Same pinned timed-draw model as the offline study package. Actual dose history is used only through the first draw.</p>
          {result?.status === "predicted" && <p className="mt-2 break-words text-xs">Unrounded: {result.predicted_concentration_mg_l} mg/L<br />{result.release}</p>}
        </Panel>
      </aside>
    </div>
  </div>;

  return <div className="vz-app relative" style={{ background: "var(--color-bg)", color: "var(--color-primary)" }}
    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); calculate(); } }}>
    <header className="shrink-0 border-b border-[var(--color-border)]" style={{ background: "var(--color-nav-bg, var(--color-bg))" }}>
      <div className="vz-calculator-header">
        <div className="vz-calculator-brand">
          <Link href="/admin/dashboard" className="vancomyzer-title font-bold" aria-label="Vancomyzer admin dashboard">VANCOMYZER™</Link>
          <p className="vz-calculator-byline font-medium">ENGINEERED BY DŌSYS</p>
        </div>
        <div className="vz-mode-switcher"><span className="vz-chip vz-chip--caution">Study demo · no level</span></div>
        <nav className="vz-calculator-nav" aria-label="Study navigation"><Link className="vz-header-action" href="/admin/dashboard">Admin dashboard</Link></nav>
      </div>
    </header>
    <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-highlight)] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div><h1 className="m-0 text-sm font-bold">Study demo: concentration at the first draw</h1><p className="m-0 text-xs font-semibold text-amber-900">{BANNER} · Edits stay in this browser tab.</p></div>
        <label className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          Fictional case
          <select className="vz-input !h-8 !w-auto max-w-[min(80vw,22rem)]" value={selected} onChange={(e) => reset(Number(e.target.value))}>
            {cases.map((c, i) => <option key={c.input.study_case_id} value={i}>{c.input.study_case_id} · {c.title}</option>)}
          </select>
        </label>
      </div>
    </div>
    <CalculatorLayout left={left} right={right} />
  </div>;
}
