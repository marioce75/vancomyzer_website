import React from "react";

interface CalculatorActionBarProps {
  onCalculate: () => void;
  onReset: () => void;
  disabled?: boolean;
  /** When true, the Calculate button is hidden entirely (e.g. bedbound Phase 1 — awaiting level). */
  hideCalculate?: boolean;
}

export default function CalculatorActionBar({ onCalculate, onReset, disabled, hideCalculate }: CalculatorActionBarProps) {
  return (
    <div className="mt-1 flex items-center justify-between gap-3">
      <p
        className="text-xs font-medium uppercase tracking-[0.16em]"
        style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.16em" }}
      >
        &gt; recalculate after any draft change
      </p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2"
          style={{
            border: "1px solid rgba(0,255,65,0.4)",
            background: "#000000",
            color: "#00a827",
            fontFamily: "'Share Tech Mono', monospace",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#00ff41";
            (e.currentTarget as HTMLButtonElement).style.color = "#00ff41";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 8px rgba(0,255,65,0.3)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,255,65,0.4)";
            (e.currentTarget as HTMLButtonElement).style.color = "#00a827";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
        >
          [RESET]
        </button>

        {hideCalculate ? (
          /* Phase 1 locked state — waiting for level */
          <div
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold cursor-default select-none"
            style={{
              border: "1px solid rgba(255,170,0,0.4)",
              background: "rgba(255,170,0,0.06)",
              color: "#cc8800",
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
            ENTER LEVEL TO UNLOCK
          </div>
        ) : (
          /* Primary clinical action — Matrix green */
          <button
            type="button"
            onClick={onCalculate}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "#00ff41",
              border: "1px solid #00ff41",
              color: "#000000",
              fontFamily: "'Share Tech Mono', monospace",
              boxShadow: disabled ? "none" : "0 0 12px rgba(0,255,65,0.4)",
            }}
            onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = "#00cc33"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#00cc33"; } }}
            onMouseLeave={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = "#00ff41"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#00ff41"; } }}
          >
            {disabled && (
              /* Terminal blink instead of spinner */
              <span
                className="mx-blink text-sm font-bold"
                style={{ color: "#000000", fontFamily: "'Share Tech Mono', monospace" }}
                aria-hidden="true"
              >
                _
              </span>
            )}
            {disabled ? "CALCULATING_" : "[CALCULATE]"}
          </button>
        )}
      </div>
    </div>
  );
}
