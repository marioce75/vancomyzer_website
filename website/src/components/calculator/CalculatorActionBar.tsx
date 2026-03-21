import React from "react";

interface CalculatorActionBarProps {
  onCalculate: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export default function CalculatorActionBar({ onCalculate, onReset, disabled }: CalculatorActionBarProps) {
  return (
    <div className="mt-1 flex items-center justify-between gap-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Recalculate after any draft change</p>
      <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={onReset}
        className="rounded-[14px] border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        Reset
      </button>
      <button
        type="button"
        onClick={onCalculate}
        disabled={disabled}
        className="rounded-[14px] border border-cyan-800 bg-cyan-700 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? "Calculating..." : "Calculate"}
      </button>
      </div>
    </div>
  );
}
