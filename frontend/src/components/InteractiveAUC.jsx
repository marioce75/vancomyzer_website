import React, { useEffect, useState } from 'react';
import { calculateInteractive } from '../services/interactiveApi';

function EmptyState({ onGoPatient }) {
  return (
    <div className="text-center py-10">
      <p className="text-gray-600 mb-4">No patient in context. Please enter patient first.</p>
      <button className="btn" onClick={onGoPatient}>Go to Patient Input</button>
    </div>
  );
}

export default function InteractiveAUC({ patient, initialRegimen, onGoPatient }) {
  const [regimen, setRegimen] = useState(initialRegimen || { dose_mg: 1000, interval_hours: 12, infusion_minutes: 60 });
  const [data, setData] = useState(null);
  const [pending, setPending] = useState(false);

  // debounce
  const [queued, setQueued] = useState(null);
  useEffect(() => {
    if (!patient) return;
    setQueued({ patient, regimen });
  }, [patient, regimen]);
  useEffect(() => {
    if (!queued) return;
    const id = setTimeout(async () => {
      setPending(true);
      try {
        const resp = await calculateInteractive(queued.patient, queued.regimen);
        setData(resp);
      } catch (e) {
        console.error('interactive call failed', e);
      } finally {
        setPending(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [queued]);

  if (!patient) return <EmptyState onGoPatient={onGoPatient} />;

  return (
    <div>
      <div className="flex gap-4 items-center mb-4">
        <label className="flex items-center gap-2">
          Dose (mg)
          <input type="number" className="input" value={regimen.dose_mg}
            onChange={(e) => setRegimen(r => ({ ...r, dose_mg: Number(e.target.value) }))} />
        </label>
        <label className="flex items-center gap-2">
          Interval (h)
          <input type="number" className="input" value={regimen.interval_hours}
            onChange={(e) => setRegimen(r => ({ ...r, interval_hours: Number(e.target.value) }))} />
        </label>
        <label className="flex items-center gap-2">
          Infusion (min)
          <input type="number" className="input" value={regimen.infusion_minutes}
            onChange={(e) => setRegimen(r => ({ ...r, infusion_minutes: Number(e.target.value) }))} />
        </label>
        {pending && <span className="text-gray-500">Updating…</span>}
      </div>

      {data ? (
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <p className="text-gray-500">Adjust regimen to see predicted AUC and levels.</p>
      )}
    </div>
  );
}
