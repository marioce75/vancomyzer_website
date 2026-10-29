'use client';
import { useState } from 'react';
import type { PediatricResult } from '@/lib/pediatric/engine';
import type { ResearchRegimen } from '@/lib/pediatric/researchRegimens';
const n=(x:number)=>Number(x.toFixed(1));
export default function ResearchRegimenPanel({result,onApply}:{result:PediatricResult;onApply:(c:ResearchRegimen)=>void}) {
  const [selected,setSelected]=useState(0);
  const search=result.research_regimens;
  if (!search) return null;
  const c=search.options[selected];
  const current=(result.posterior??result.prior).exposure;
  return <section aria-label="Research regimen recommendations" className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
    <h3 className="font-semibold">Research regimen comparison</h3>
    <p className="text-sm">{search.reason}</p>
    <p className="text-xs">Basis: {result.estimate_basis.replaceAll('_',' ')}. AUC24 target 400–600 mg·h/L, serious MRSA, MIC 1 mg/L. Research only — not for patient care.</p>
    {search.status==='available' && <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Regimen options">
        <button type="button" aria-pressed={selected===-1} onClick={()=>setSelected(-1)} className="rounded border bg-white p-2 text-sm">Current entered regimen</button>
        {search.options.map((x,i)=><button key={`${x.dose_mg}-${x.interval_hours}`} type="button" aria-pressed={selected===i} onClick={()=>setSelected(i)} className={'rounded border p-2 text-sm '+(selected===i?'border-blue-700 bg-blue-100':'bg-white')}>{x.dose_mg} mg q{x.interval_hours}h{i===0?' · closest to target midpoint':''}</button>)}
      </div>
      {c ? <div className="space-y-2 text-sm" aria-live="polite">
        <p><strong>{c.dose_mg} mg every {c.interval_hours} hours</strong> over {c.infusion_minutes} minutes. {n(c.dose_mg_per_kg)} mg/kg/dose; {n(c.daily_dose_mg_per_kg)} mg/kg/day.</p>
        <p>Steady-state AUC24: <strong>{n(c.auc24)} mg·h/L</strong>. 90% model interval: {n(c.steady_state_auc24_interval.lower)}–{n(c.steady_state_auc24_interval.upper)} mg·h/L. Trough: {n(c.trough)} mg/L; peak: {n(c.peak)} mg/L.</p>
        <p>{c.forecast_auc24_next24h===null?'No history: a next-24-hour forecast is unavailable.':`Next 24-hour forecast from your entered planned start: ${n(c.forecast_auc24_next24h)} mg·h/L (point estimate, distinct from steady state).`}</p>
        {c.flags.map(f=><p key={f} className="text-amber-900">{f}</p>)}
        <button type="button" className="rounded bg-blue-800 text-white px-3 py-2" onClick={()=>onApply(c)}>Apply selected research regimen</button>
        <p className="text-xs">Applies dose, interval and infusion only. Entered dose history, samples and planned start remain unchanged. Recalculate to update the result and graph.</p>
      </div>:<p className="text-sm">Current entered regimen: steady-state AUC24 {n(current.steady_state_auc24)} mg·h/L; trough {n(current.steady_state_trough)} mg/L. {current.forecast_auc24_next24h!==null&&`Next-24-hour forecast: ${n(current.forecast_auc24_next24h)} mg·h/L.`}</p>}
    </>}
    <details><summary className="text-sm cursor-pointer">Search limits and evidence</summary><ul className="list-disc pl-5 text-xs space-y-2 mt-2">{search.assumptions.map(a=><li key={a}>{a}</li>)}</ul><a className="text-xs underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7358040/" target="_blank" rel="noreferrer">2020 pediatric consensus recommendations 17–21, 25</a></details>
  </section>;
}
