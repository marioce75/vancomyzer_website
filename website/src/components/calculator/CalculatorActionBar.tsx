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
    <div className="mt-1 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
      <p
        className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.16em] text-center"
        style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.16em" }}
      >
        &gt; recalculate after{"\n"}any draft change
      </p>
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2"
          style={{
            border: "1px solid var(--color-primary-a40)",
            background: "var(--color-bg)",
            color: "var(--color-secondary)",
            fontFamily: "'Share Tech Mono', monospace",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-primary)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-primary)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 8px var(--color-primary-a30)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-primary-a40)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-secondary)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
        >
          RESET
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
              background: "var(--color-primary)",
              border: "1px solid var(--color-primary)",
              color: "var(--color-bg)",
              fontFamily: "'Share Tech Mono', monospace",
              boxShadow: disabled ? "none" : "0 0 12px var(--color-primary-a40)",
            }}
            onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-secondary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-secondary)"; } }}
            onMouseLeave={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-primary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-primary)"; } }}
          >
            {disabled && (
              /* Terminal blink instead of spinner */
              <span
                className="mx-blink text-sm font-bold"
                style={{ color: "var(--color-bg)", fontFamily: "'Share Tech Mono', monospace" }}
                aria-hidden="true"
              >
                _
              </span>
            )}
            {disabled ? "CALCULATING_" : "CALCULATE"}
          </button>
        )}
      </div>
    </div>
  );
}
