"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// ── Constants ──────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function splitDate(v: string): { mm: string; dd: string; yyyy: string } {
  return /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? { mm: v.slice(5, 7), dd: v.slice(8, 10), yyyy: v.slice(0, 4) }
    : { mm: "", dd: "", yyyy: "" };
}

// ── Calendar Popup ─────────────────────────────────────────────
// Rendered via React portal so it escapes overflow:hidden ancestors.

interface CalendarPopupProps {
  selectedDate: string; // YYYY-MM-DD or ""
  anchorEl: HTMLElement;
  onSelect: (date: string) => void; // always a complete YYYY-MM-DD
  onClose: () => void;
}

function CalendarPopup({ selectedDate, anchorEl, onSelect, onClose }: CalendarPopupProps) {
  const today = todayYMD();
  const initStr = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : today;

  const [viewYear, setViewYear] = useState(() => parseInt(initStr.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => parseInt(initStr.slice(5, 7)) - 1);

  const popupRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Position below the anchor button
  const rect = anchorEl.getBoundingClientRect();
  const top = rect.bottom + window.scrollY + 4;
  const left = Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - 248));

  // Close on outside click (deferred by one tick to avoid closing from the opener click)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return createPortal(
    <div
      ref={popupRef}
      style={{
        position: "absolute", top, left, zIndex: 9999,
        background: 'var(--navy-card-raised, #ffffff)',
        border: '1px solid var(--navy-border-strong, #cbd5e0)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05)',
      }}
      className="w-60 rounded-xl p-3 select-none"
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="h-7 w-7 flex items-center justify-center rounded-lg transition font-bold text-base"
          style={{color: 'var(--text-secondary)'}}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-sm font-semibold" style={{color: 'var(--text-primary)'}}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="h-7 w-7 flex items-center justify-center rounded-lg transition font-bold text-base"
          style={{color: 'var(--text-secondary)'}}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <span key={d} className="h-6 flex items-center justify-center text-[10px] font-semibold" style={{color: 'var(--text-muted)'}}>
            {d}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: firstDayOfWeek }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSel = dateStr === selectedDate;
          const isToday = dateStr === today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => { onSelect(dateStr); onClose(); }}
              className="h-7 w-full rounded-lg text-xs transition font-medium"
              style={
                isSel
                  ? { background: 'var(--teal)', color: '#fff', fontWeight: 600 }
                  : isToday
                  ? { background: 'var(--teal-glow)', color: 'var(--teal-light)', fontWeight: 600, outline: '1px solid var(--teal-border)' }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <div className="mt-2 pt-2 border-t" style={{borderTopColor: 'var(--navy-border)'}}>
        <button
          type="button"
          onClick={() => { onSelect(today); onClose(); }}
          className="w-full text-xs font-semibold text-center py-0.5 transition"
          style={{color: 'var(--teal-light)'}}
        >
          Today
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── DatePartInput ──────────────────────────────────────────────
// Three-part MM/DD/YYYY entry with custom calendar popup.
// Works in all browsers (no reliance on <input type="date">).
//
// Key invariants:
//   • onChange is called ONLY with a complete YYYY-MM-DD string, never with "".
//   • The value→parts sync effect only runs for complete incoming dates,
//     preventing feedback loops that would clear in-progress user input.
//   • Tab between segments does not clear values.

export interface DatePartInputProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (v: string) => void; // called with YYYY-MM-DD when all three parts are complete
  hasError?: boolean;
}

export default function DatePartInput({ value, onChange, hasError }: DatePartInputProps) {
  const mmRef = useRef<HTMLInputElement>(null);
  const ddRef = useRef<HTMLInputElement>(null);
  const yyyyRef = useRef<HTMLInputElement>(null);
  const calBtnRef = useRef<HTMLButtonElement>(null);

  const [parts, setParts] = useState(() => splitDate(value));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Sync external value → parts ONLY when value is a complete YYYY-MM-DD.
  // Ignoring empty/partial values prevents re-render feedback loops that would
  // clear the MM/DD/YYYY fields while the user is mid-entry.
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const next = splitDate(value);
    setParts(prev => {
      if (prev.mm === next.mm && prev.dd === next.dd && prev.yyyy === next.yyyy) return prev;
      return next;
    });
  }, [value]);

  const border = hasError
    ? "border-red-500 ring-1 ring-red-500 bg-[rgba(239,68,68,0.06)]"
    : "border-[var(--navy-border-strong)] bg-[rgba(255,255,255,0.05)] focus:ring-[var(--teal)] focus:border-[var(--teal)]";
  const cls = `h-[40px] border rounded text-sm text-center text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 ${border}`;

  const update = (field: "mm" | "dd" | "yyyy", raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, field === "yyyy" ? 4 : 2);
    const next = { ...parts, [field]: v };
    setParts(next);
    // Never call onChange("") — only notify parent when all three segments are complete.
    if (next.mm.length === 2 && next.dd.length === 2 && next.yyyy.length === 4) {
      onChange(`${next.yyyy}-${next.mm}-${next.dd}`);
    }
  };

  const onCalendarSelect = useCallback((date: string) => {
    setParts(splitDate(date));
    onChange(date);
  }, [onChange]);

  return (
    <div className="flex items-center gap-0.5">
      <input
        ref={mmRef}
        type="text"
        inputMode="numeric"
        placeholder="MM"
        value={parts.mm}
        maxLength={2}
        onChange={e => update("mm", e.target.value)}
        className={`${cls} w-8 px-0.5`}
        aria-label="Month"
      />
      <span className="text-[11px] select-none shrink-0" style={{color: 'var(--text-muted)'}}>/</span>
      <input
        ref={ddRef}
        type="text"
        inputMode="numeric"
        placeholder="DD"
        value={parts.dd}
        maxLength={2}
        onChange={e => update("dd", e.target.value)}
        onKeyDown={e => { if (e.key === "Backspace" && !parts.dd) mmRef.current?.focus(); }}
        className={`${cls} w-8 px-0.5`}
        aria-label="Day"
      />
      <span className="text-[11px] select-none shrink-0" style={{color: 'var(--text-muted)'}}>/</span>
      <input
        ref={yyyyRef}
        type="text"
        inputMode="numeric"
        placeholder="YYYY"
        value={parts.yyyy}
        maxLength={4}
        onChange={e => update("yyyy", e.target.value)}
        onKeyDown={e => { if (e.key === "Backspace" && !parts.yyyy) ddRef.current?.focus(); }}
        className={`${cls} w-12 px-1`}
        aria-label="Year"
      />
      {/* Calendar icon — opens the custom popup */}
      <button
        ref={calBtnRef}
        type="button"
        tabIndex={-1}
        onClick={() => setIsCalendarOpen(o => !o)}
        className="ml-1 flex h-[40px] w-8 shrink-0 items-center justify-center rounded border transition"
        style={{
          border: '1px solid var(--navy-border-strong)',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--teal-light)',
        }}
        aria-label="Open date picker"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
        </svg>
      </button>
      {isCalendarOpen && calBtnRef.current && (
        <CalendarPopup
          selectedDate={value}
          anchorEl={calBtnRef.current}
          onSelect={onCalendarSelect}
          onClose={() => setIsCalendarOpen(false)}
        />
      )}
    </div>
  );
}
