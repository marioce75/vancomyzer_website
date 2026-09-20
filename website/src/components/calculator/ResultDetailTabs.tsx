"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface DetailTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface ResultDetailTabsProps {
  tabs: DetailTab[];
  /** Tab to show first. */
  defaultTab?: string;
  ariaLabel?: string;
  /** sessionStorage key: remembers the open tab across recalculations for this session. */
  storageKey?: string;
}

/**
 * Secondary-information tabs for the side rail: PK parameters, method,
 * interpretation & limitations, documentation. Everything stays one click
 * away; nothing is removed — the tabs only establish hierarchy below the
 * primary recommendation.
 */
export default function ResultDetailTabs({ tabs, defaultTab, ariaLabel = "Result details", storageKey }: ResultDetailTabsProps) {
  const [active, setActiveState] = useState<string>(defaultTab ?? tabs[0]?.id ?? "");
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && tabs.some((t) => t.id === stored)) setActiveState(stored);
    } catch { /* storage unavailable */ }
    // Restore once on mount; tab ids are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const setActive = (id: string) => {
    setActiveState(id);
    if (storageKey) { try { sessionStorage.setItem(storageKey, id); } catch { /* ignore */ } }
  };
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = tabs.findIndex((t) => t.id === current.id);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = tabs[(idx + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      setActive(next.id);
      (e.currentTarget.querySelector(`[data-tab="${next.id}"]`) as HTMLButtonElement | null)?.focus();
    }
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="vz-tabs shrink-0" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-tab={t.id}
            id={`vz-tab-${t.id}`}
            aria-selected={t.id === current.id}
            aria-controls={`vz-tabpanel-${t.id}`}
            tabIndex={t.id === current.id ? 0 : -1}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`vz-tabpanel-${current.id}`}
        aria-labelledby={`vz-tab-${current.id}`}
        className="min-h-0 overflow-y-auto p-3 text-sm leading-relaxed"
      >
        {current.content}
      </div>
    </div>
  );
}
