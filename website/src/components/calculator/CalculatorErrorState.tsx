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
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <p className="text-sm font-semibold text-amber-950">{message}</p>

      {details && details.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}

      {(recoveryGuidance?.length || fallbackText) && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-white/80 p-3">
          <p className="text-sm font-medium text-amber-950">Next step</p>
          {recoveryGuidance && recoveryGuidance.length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {recoveryGuidance.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {fallbackText && <p className="mt-2 text-sm text-amber-900">{fallbackText}</p>}
          {fallbackWorkflow === "initial_regimen" && onSwitchToInitialRegimen && (
            <button
              type="button"
              onClick={onSwitchToInitialRegimen}
              className="mt-3 inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
            >
              Switch to initial regimen
            </button>
          )}
        </div>
      )}

      {limitations && limitations.length > 0 && (
        <details className="mt-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">Limitations</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
