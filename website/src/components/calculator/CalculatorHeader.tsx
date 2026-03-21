import Link from "next/link";

type WorkspaceViewMode = "empiric" | "one_level" | "two_levels";

interface CalculatorHeaderProps {
  statMode?: boolean;
  onToggleStatMode?: () => void;
  viewMode: WorkspaceViewMode;
  onViewModeChange: (mode: WorkspaceViewMode) => void;
}

export default function CalculatorHeader({
  statMode = false,
  onToggleStatMode,
  viewMode,
  onViewModeChange,
}: CalculatorHeaderProps) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1680px] items-center justify-between gap-6 px-5 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Vancomyzer</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950">Vancomycin dosing workspace</h1>
            <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 md:inline-flex">
              Adult intermittent IV workflows
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner">
            {[
              ["empiric", "Empiric"],
              ["one_level", "1 Level"],
              ["two_levels", "2 Levels"],
            ].map(([value, title]) => (
              <button
                key={value}
                type="button"
                onClick={() => onViewModeChange(value as WorkspaceViewMode)}
                className={`rounded-[12px] px-4 py-2 text-sm font-medium transition ${
                  viewMode === value
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
                aria-pressed={viewMode === value}
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <Link href="/trust-evidence" className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950">
            Methods
          </Link>
          {onToggleStatMode && (
            <button
              type="button"
              onClick={onToggleStatMode}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                statMode
                  ? "border border-slate-950 bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              Stat Mode
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

