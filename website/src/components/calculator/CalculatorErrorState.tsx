interface CalculatorErrorStateProps {
  message: string;
  details?: string[];
  limitations?: string[];
  recoveryGuidance?: string[];
  fallbackWorkflow?: "initial_regimen" | "repeat_existing_regimen_sampling";
  onSwitchToInitialRegimen?: () => void;
}

function fallbackLabel(
  fallbackWorkflow?: "initial_regimen" | "repeat_existing_regimen_sampling"
): string | null {
  if (fallbackWorkflow === "initial_regimen") {
    return "Use the initial-regimen workflow if the current dose history is too irregular for steady-state interpretation.";
  }
  if (fallbackWorkflow === "repeat_existing_regimen_sampling") {
    return "Repeat sampling later in a clearly interpretable dosing interval.";
  }
  return null;
}

const monoStyle = { fontFamily: "'Share Tech Mono', monospace" };

export default function CalculatorErrorState({
  message,
  details,
  limitations,
  recoveryGuidance,
  fallbackWorkflow,
  onSwitchToInitialRegimen,
}: CalculatorErrorStateProps) {
  const fallbackText = fallbackLabel(fallbackWorkflow);

  return (
    <div className="border p-4" style={{ borderColor: "rgba(255,51,51,0.5)", background: "var(--color-card)" }}>
      <p className="text-sm font-semibold" style={{ color: "#ff3333", ...monoStyle }}>
        ERROR: {message}
      </p>

      {details && details.length > 0 && (
        <ul className="mt-2 list-none space-y-1 pl-4 text-sm" style={{ color: "#ff6666", ...monoStyle }}>
          {details.map((d, i) => (
            <li key={i}><span style={{ color: "#ff3333" }}>- </span>{d}</li>
          ))}
        </ul>
      )}

      {(recoveryGuidance?.length || fallbackText) && (
        <div className="mt-3 border p-3" style={{ borderColor: "rgba(255,170,0,0.4)", background: "rgba(255,170,0,0.06)" }}>
          <p className="text-sm font-medium" style={{ color: "#ffaa00", ...monoStyle }}>NEXT STEP</p>
          {recoveryGuidance && recoveryGuidance.length > 0 && (
            <ul className="mt-1 list-none space-y-1 pl-4 text-sm" style={{ color: "#cc8800", ...monoStyle }}>
              {recoveryGuidance.map((item, i) => (
                <li key={i}><span style={{ color: "#ffaa00" }}>- </span>{item}</li>
              ))}
            </ul>
          )}
          {fallbackText && <p className="mt-2 text-sm" style={{ color: "#cc8800", ...monoStyle }}>{fallbackText}</p>}
          {fallbackWorkflow === "initial_regimen" && onSwitchToInitialRegimen && (
            <button
              type="button"
              onClick={onSwitchToInitialRegimen}
              className="mt-3 inline-flex items-center border px-3 py-2 text-sm font-medium transition"
              style={{ borderColor: "rgba(255,170,0,0.5)", background: "rgba(255,170,0,0.08)", color: "#ffaa00", ...monoStyle }}
            >
              SWITCH TO INITIAL REGIMEN
            </button>
          )}
        </div>
      )}

      {limitations && limitations.length > 0 && (
        <details className="mt-3 text-sm" style={{ color: "#cc8800", ...monoStyle }}>
          <summary className="cursor-pointer font-medium" style={{ color: "#ffaa00" }}>LIMITATIONS</summary>
          <ul className="mt-2 list-none space-y-1 pl-4">
            {limitations.map((l, i) => (
              <li key={i}><span style={{ color: "#ffaa00" }}>- </span>{l}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
