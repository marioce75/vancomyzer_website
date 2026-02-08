import React, { useState } from "react";
import { formatNumber } from "@/lib/format";

interface LevelRow {
  time: number;
  concentration: number;
}

interface RegimenOut { doseMg: number; intervalH: number; infusionH: number }
interface PKResult {
  crcl: number;
  ke: number;
  vd: number;
  regimen: RegimenOut;
  auc24: number;
  warnings: string[];
}
interface BayesianMetrics {
  auc24: number; peak: number; trough: number; crcl: number; weightUsed: number; vd: number; cl: number; k: number;
}
interface BayesianResult {
  metrics: BayesianMetrics;
  timeCourse: Array<{ time: number; concentration: number; ci95Lower?: number; ci95Upper?: number }>
  method: 'bayesian';
}

type Mode = 'basic' | 'bayesian';

type Result = PKResult | BayesianResult | null;

const PKCalculator: React.FC = () => {
  const [age, setAge] = useState<number>(40);
  const [sex, setSex] = useState<string>('Male');
  const [weight, setWeight] = useState<number>(70);
  const [height, setHeight] = useState<number>(175);
  const [scr, setScr] = useState<number>(1.0);
  const [infusionH, setInfusionH] = useState<number>(1.0);
  const [mode, setMode] = useState<Mode>('basic');
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLevel = () => setLevels([...levels, { time: 0, concentration: 0 }]);
  const removeLevel = (idx: number) => setLevels(levels.filter((_, i) => i !== idx));
  const updateLevel = (idx: number, field: keyof LevelRow, value: number) => {
    const next = [...levels];
    next[idx] = { ...next[idx], [field]: value } as LevelRow;
    setLevels(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === 'basic' ? '/api/pk/calculate' : '/api/pk/bayesian';
      const payload = mode === 'basic' ? {
        age, sex, weight, height, scr, infusionH
      } : {
        patient: { age, sex, weight, height, scr },
        regimen: { doseMg: 0, intervalH: 0, infusionH },
        levels: levels
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data as Result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isPK = (r: Result): r is PKResult => !!r && (r as PKResult).crcl !== undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-4">
        <label className="flex-1">
          <span className="block text-sm">Age (years)</span>
          <input type="number" className="w-full p-2 border rounded" value={age} onChange={e => setAge(Number(e.target.value))} />
        </label>
        <label className="flex-1">
          <span className="block text-sm">Sex</span>
          <select className="w-full p-2 border rounded" value={sex} onChange={e => setSex(e.target.value)}>
            <option>Male</option>
            <option>Female</option>
          </select>
        </label>
      </div>
      <div className="flex gap-4">
        <label className="flex-1">
          <span className="block text-sm">Weight (kg)</span>
          <input type="number" className="w-full p-2 border rounded" value={weight} onChange={e => setWeight(Number(e.target.value))} />
        </label>
        <label className="flex-1">
          <span className="block text-sm">Height (cm)</span>
          <input type="number" className="w-full p-2 border rounded" value={height} onChange={e => setHeight(Number(e.target.value))} />
        </label>
      </div>
      <div className="flex gap-4">
        <label className="flex-1">
          <span className="block text-sm">Serum creatinine (mg/dL)</span>
          <input type="number" step="0.01" className="w-full p-2 border rounded" value={scr} onChange={e => setScr(Number(e.target.value))} />
        </label>
        <label className="flex-1">
          <span className="block text-sm">Infusion time (hours)</span>
          <input type="number" step="0.1" className="w-full p-2 border rounded" value={infusionH} onChange={e => setInfusionH(Number(e.target.value))} />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === 'basic'} onChange={() => setMode('basic')} />
          <span>Basic dosing</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === 'bayesian'} onChange={() => setMode('bayesian')} />
          <span>Bayesian engine</span>
        </label>
      </div>

      {mode === 'bayesian' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Observed levels</span>
            <button type="button" onClick={addLevel} className="px-2 py-1 border rounded">Add level</button>
          </div>
          {levels.length === 0 && <p className="text-sm text-gray-500">No levels added.</p>}
          {levels.map((lvl, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input type="number" step="0.1" className="flex-1 p-2 border rounded" placeholder="Time (h)" value={lvl.time} onChange={e => updateLevel(idx, 'time', Number(e.target.value))} />
              <input type="number" step="0.1" className="flex-1 p-2 border rounded" placeholder="Concentration (mg/L)" value={lvl.concentration} onChange={e => updateLevel(idx, 'concentration', Number(e.target.value))} />
              <button type="button" onClick={() => removeLevel(idx)} className="px-2 py-1 border rounded">Remove</button>
            </div>
          ))}
        </div>
      )}

      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Calculate</button>

      {loading && <p className="text-sm">Calculating...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && isPK(result) && (
        <div className="mt-4 border rounded p-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">CrCl:</span> {formatNumber(result.crcl, 1)} mL/min</div>
            <div><span className="font-medium">ke:</span> {formatNumber(result.ke, 3)} h⁻¹</div>
            <div><span className="font-medium">Vd:</span> {formatNumber(result.vd, 1)} L</div>
            <div className="col-span-2"><span className="font-medium">Regimen:</span> {formatNumber(result.regimen.doseMg, 0)} mg q{formatNumber(result.regimen.intervalH, 0)}h (infusion {formatNumber(result.regimen.infusionH, 1)} h)</div>
            <div className="col-span-2"><span className="font-medium">AUC24:</span> {formatNumber(result.auc24, 0)} mg·h/L</div>
          </div>
          {result.warnings.length > 0 && (
            <ul className="mt-2 text-sm text-orange-700 list-disc list-inside">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      {result && !isPK(result) && (
        <div className="mt-4 border rounded p-4 text-sm">
          <div className="mb-2 font-medium">Bayesian result</div>
          <div>AUC24: {formatNumber(result.metrics.auc24, 0)} mg·h/L</div>
          <div>Peak: {formatNumber(result.metrics.peak, 1)} mg/L, Trough: {formatNumber(result.metrics.trough, 1)} mg/L</div>
        </div>
      )}
    </form>
  );
};

export default PKCalculator;
