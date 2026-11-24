"use client";
import { useEffect, useState } from "react";

interface Dose { start: string | number; dose_mg: number; infusion_minutes?: number; end?: string | number }
interface CaseInput {
  study_case_id: string; time_basis: "datetime" | "elapsed_hours"; age_years: number; weight_kg: number;
  serum_creatinine_mg_dl: number; scr_collected_at: string | number; draw_time: string | number; doses: Dose[];
}
interface DemoCase { id: string; title: string; story: string; input: CaseInput }
interface Reason { code: string; message: string }
interface Result {
  status: "predicted" | "refused"; draw_elapsed_hours: number | null; predicted_concentration_mg_l: number | null;
  doses_used: number; warnings: Reason[]; reasons: Reason[]; release: string;
}

const BANNER = "Fictional case only • Research demo • Not for patient care";

function Banner() {
  return (
    <div role="note" className="rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-center text-base font-bold text-amber-900">
      {BANNER}
    </div>
  );
}

function when(v: string | number, basis: CaseInput["time_basis"]) {
  return basis === "elapsed_hours" ? `${v} h` : String(v);
}

function minutes(d: Dose) {
  if (d.infusion_minutes !== undefined) return `${d.infusion_minutes} min`;
  return `until ${d.end}`;
}

function isAfterDraw(d: Dose, c: CaseInput) {
  if (c.time_basis === "elapsed_hours") return (d.start as number) > (c.draw_time as number);
  return Date.parse(String(d.start)) > Date.parse(String(c.draw_time));
}

export default function StudyDemoWorkspace() {
  const [cases, setCases] = useState<DemoCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [lab, setLab] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/study-demo", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { setCases(d.cases); setSelected(d.cases[0]?.id ?? null); })
      .catch(() => setError("The demo is not available."));
  }, []);

  const current = cases?.find((c) => c.id === selected) ?? null;

  async function call(action: "predict" | "reveal") {
    if (!current) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/study-demo", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ case_id: current.id, action }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (action === "predict") { setResult(d.result); setLab(null); } else setLab(d.fictional_lab_result_mg_l);
    } catch { setError("The request failed."); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Banner />
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Study demo: concentration at the draw time</h1>
        <p className="mt-1 text-sm text-gray-600">
          Predicts the first vancomycin concentration at the actual blood-draw time from patient characteristics at treatment start and the actual IV doses up to the draw. No measured level is used. Doses are inputs, not recommendations. Same prediction function as the offline study package.
        </p>
      </header>
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {cases && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Fictional cases">
          {cases.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === selected}
              onClick={() => { setSelected(c.id); setResult(null); setLab(null); }}
              className={`rounded-md border px-3 py-1.5 text-sm ${c.id === selected ? "border-blue-700 bg-blue-700 text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"}`}>
              {c.id}
            </button>
          ))}
        </div>
      )}
      {current && (
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{current.id}: {current.title}</h2>
            <p className="text-sm text-gray-600">{current.story}</p>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-gray-500">Age</dt><dd>{current.input.age_years} y</dd></div>
            <div><dt className="text-gray-500">Weight</dt><dd>{current.input.weight_kg} kg</dd></div>
            <div><dt className="text-gray-500">SCr at start</dt><dd>{current.input.serum_creatinine_mg_dl} mg/dL ({when(current.input.scr_collected_at, current.input.time_basis)})</dd></div>
            <div><dt className="text-gray-500">Draw time</dt><dd className="font-semibold">{when(current.input.draw_time, current.input.time_basis)}</dd></div>
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Timeline of actual doses</caption>
              <thead><tr className="border-b text-gray-500"><th className="py-1 pr-3">#</th><th className="py-1 pr-3">Start</th><th className="py-1 pr-3">Dose</th><th className="py-1 pr-3">Infusion</th><th className="py-1">Used</th></tr></thead>
              <tbody>
                {current.input.doses.map((d, i) => {
                  const after = isAfterDraw(d, current.input);
                  return (
                    <tr key={i} className={`border-b last:border-0 ${after ? "text-gray-400" : ""}`}>
                      <td className="py-1 pr-3">{i + 1}</td>
                      <td className="py-1 pr-3">{when(d.start, current.input.time_basis)}</td>
                      <td className="py-1 pr-3">{d.dose_mg.toLocaleString("en-US")} mg</td>
                      <td className="py-1 pr-3">{minutes(d)}</td>
                      <td className="py-1">{after ? "No: after the draw" : "Yes"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button disabled={busy} onClick={() => call("predict")} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            Predict concentration at the draw
          </button>
          {result && result.status === "predicted" && (
            <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-gray-700">Predicted at {result.draw_elapsed_hours} h after the first dose ({result.doses_used} dose{result.doses_used === 1 ? "" : "s"} used):</p>
              <p className="text-3xl font-bold text-blue-900">{result.predicted_concentration_mg_l!.toFixed(1)} mg/L</p>
              <p className="text-xs text-gray-500">Unrounded: {result.predicted_concentration_mg_l} mg/L · {result.release}</p>
              {result.warnings.map((w) => <p key={w.code} className="text-sm text-amber-800">⚠ {w.message}</p>)}
              {lab === null ? (
                <button disabled={busy} onClick={() => call("reveal")} className="rounded-md border border-gray-400 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50">
                  Reveal fictional lab result
                </button>
              ) : (
                <p className="text-sm text-gray-800">Fictional lab result: <strong>{lab.toFixed(1)} mg/L</strong> (prediction minus result {(result.predicted_concentration_mg_l! - lab).toFixed(1)} mg/L). Invented for this demo.</p>
              )}
            </div>
          )}
          {result && result.status === "refused" && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">No prediction: {result.reasons.map((r) => r.message).join(" ")}</div>
          )}
        </section>
      )}
      <Banner />
    </div>
  );
}
