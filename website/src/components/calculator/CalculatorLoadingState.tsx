export default function CalculatorLoadingState() {
  return (
    <div className="flex min-h-[180px] w-full max-w-xl flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white p-8 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.24)]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-700" />
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Running PK model</p>
      <p className="mt-2 text-sm text-slate-600">Calculating concentration profile, exposure metrics, and regimen guidance.</p>
    </div>
  );
}
