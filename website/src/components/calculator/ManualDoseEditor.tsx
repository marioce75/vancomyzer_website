"use client";

import { useId, useRef, type ReactNode } from "react";

export type ManualDoseRow = {
  key: number;
  date: string;
  time: string;
  mg: string;
  minutes: string;
};

export type ManualDoseDraw = { date: string; time: string };

interface ManualDoseEditorProps {
  rows: ManualDoseRow[];
  onRowsChange: (rows: ManualDoseRow[]) => void;
  draw: ManualDoseDraw;
  onDrawChange: (draw: ManualDoseDraw) => void;
  complete: boolean;
  onCompleteChange: (complete: boolean) => void;
}

const inputClass = "vz-input !h-8 min-w-0 [color-scheme:light]";
const outlineButton = "rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-highlight)] focus-visible:outline focus-visible:outline-2";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0">
    <span className="mb-0.5 block text-xs font-semibold text-[var(--color-secondary)]">{label}</span>
    {children}
  </label>;
}

/** Controlled input surface only. Callers own all timing conversion and calculation policy. */
export default function ManualDoseEditor({
  rows, onRowsChange, draw, onDrawChange, complete, onCompleteChange,
}: ManualDoseEditorProps) {
  const id = useId();
  const nextKey = useRef(0);
  function replaceRows(next: ManualDoseRow[]) {
    onRowsChange(next);
    if (complete) onCompleteChange(false);
  }
  function changeRow(key: number, field: Exclude<keyof ManualDoseRow, "key">, value: string) {
    replaceRows(rows.map((row) => row.key === key ? { ...row, [field]: value } : row));
  }
  function addRow() {
    const key = rows.reduce((next, row) => Math.max(next, row.key + 1), nextKey.current);
    nextKey.current = key + 1;
    replaceRows([...rows, { key, date: "", time: "", mg: "", minutes: "" }]);
  }
  function changeDraw(field: keyof ManualDoseDraw, value: string) {
    onDrawChange({ ...draw, [field]: value });
    if (complete) onCompleteChange(false);
  }

  return <section className="vz-panel" aria-labelledby={`${id}-title`}>
    <div className="vz-panel-head">
      <h2 id={`${id}-title`} className="vz-panel-title m-0">Actual IV dose history</h2>
    </div>
    <div className="space-y-2.5 p-3 text-[var(--color-secondary)]">
      <p id={`${id}-clock`} className="m-0 text-xs">
        Enter doses actually given from the start of treatment through the draw, including any loading dose. Use UTC for every date and time; this panel never assumes your device’s time zone.
      </p>
      {!rows.length && <p className="m-0 text-xs">No doses entered yet.</p>}
      {rows.map((row, index) => {
        const n = index + 1;
        return <fieldset key={row.key} className="min-w-0 space-y-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
          <legend className="px-1 text-xs font-bold text-[var(--color-primary)]">Dose {n}</legend>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-1.5">
            <Field label="Start date (UTC)">
              <input className={inputClass} type="date" value={row.date} aria-label={`Dose ${n} start date (UTC)`} aria-describedby={`${id}-clock`}
                onChange={(e) => changeRow(row.key, "date", e.target.value)} />
            </Field>
            <Field label="Start time (UTC)">
              <input className={inputClass} type="time" step={1} value={row.time} aria-label={`Dose ${n} start time (UTC)`} aria-describedby={`${id}-clock`}
                onChange={(e) => changeRow(row.key, "time", e.target.value)} />
            </Field>
            <Field label="Dose (mg)">
              <input className={inputClass} type="number" inputMode="decimal" min={0.01} step="any" value={row.mg} aria-label={`Dose ${n} amount (mg)`}
                onChange={(e) => changeRow(row.key, "mg", e.target.value)} />
            </Field>
            <Field label="Infusion (min)">
              <input className={inputClass} type="number" inputMode="decimal" min={0.01} step="any" value={row.minutes} aria-label={`Dose ${n} infusion duration (minutes)`}
                onChange={(e) => changeRow(row.key, "minutes", e.target.value)} />
            </Field>
          </div>
          <button type="button" className={outlineButton} aria-label={`Remove dose ${n}`}
            onClick={() => replaceRows(rows.filter((item) => item.key !== row.key))}>Remove dose</button>
        </fieldset>;
      })}
      <button type="button" className={outlineButton} onClick={addRow}>Add dose</button>
      <label className="flex items-start gap-1.5 text-xs">
        <input type="checkbox" className="mt-0.5 shrink-0" checked={complete}
          onChange={(e) => onCompleteChange(e.target.checked)} />
        <span>I confirm the actual IV dose history is complete from the start of treatment through the draw, including any loading dose.</span>
      </label>
      <fieldset className="min-w-0 rounded border border-[var(--color-border)] p-2">
        <legend className="px-1 text-xs font-bold text-[var(--color-primary)]">Held-out blood draw</legend>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-1.5">
          <Field label="Draw date (UTC)">
            <input className={inputClass} type="date" value={draw.date} aria-label="Held-out draw date (UTC)"
              onChange={(e) => changeDraw("date", e.target.value)} />
          </Field>
          <Field label="Draw time (UTC)">
            <input className={inputClass} type="time" step={1} value={draw.time} aria-label="Held-out draw time (UTC)"
              onChange={(e) => changeDraw("time", e.target.value)} />
          </Field>
        </div>
        <p className="mb-0 mt-1 text-xs">Required to plot through the draw. Enter the date and time together. Do not enter the measured concentration here.</p>
      </fieldset>
    </div>
  </section>;
}
