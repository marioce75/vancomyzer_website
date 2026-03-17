interface CalculatorErrorStateProps {
  message: string;
  details?: string[];
  limitations?: string[];
}

export default function CalculatorErrorState({
  message,
  details,
  limitations,
}: CalculatorErrorStateProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="font-medium text-amber-900">{message}</p>
      {details && details.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {limitations && limitations.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-amber-900">Limitations</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
