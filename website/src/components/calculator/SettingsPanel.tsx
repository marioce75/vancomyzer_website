"use client";

import { useEffect, useCallback } from "react";
import { useMatrixSettings } from "@/contexts/MatrixSettingsContext";

/* ── Types ──────────────────────────────────────────────────────── */

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/* ── Constants ──────────────────────────────────────────────────── */

const FONT: React.CSSProperties = {
  fontFamily: "'Share Tech Mono', monospace",
};

const COLOR_MODES = [
  { value: "basic" as const, label: "Basic (Clinical)", swatch: "#2b6cb0" },
  { value: "matrix-green" as const, label: "Matrix Green", swatch: "#00ff41" },
];

const FONT_SIZES = [
  { value: "small" as const, label: "Small" },
  { value: "medium" as const, label: "Medium" },
  { value: "large" as const, label: "Large" },
  { value: "extra-large" as const, label: "XL" },
];

const SLIDERS = [
  { key: "greenBrightness" as const, label: "Green Brightness" },
  { key: "backgroundShade" as const, label: "Background Shade" },
  { key: "textSize" as const, label: "Text Size" },
  { key: "rainOpacity" as const, label: "Rain Opacity" },
] as const;

const TOGGLES = [
  { key: "scanlineEffect" as const, label: "Scanline Effect" },
  { key: "typewriterAnimation" as const, label: "Typewriter Animation" },
  { key: "blinkingCursor" as const, label: "Blinking Cursor" },
  { key: "vancomycinRain" as const, label: "Vancomyzer Rain (off by default)" },
  { key: "graphAnimations" as const, label: "Graph Animations" },
  { key: "soundEffects" as const, label: "Sound Effects" },
  { key: "whiteInputValues" as const, label: "White Input Numbers" },
] as const;

/* ── Component ──────────────────────────────────────────────────── */

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, updateSetting, resetToDefaults, mounted } = useMatrixSettings();

  /* Escape key handler */
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, handleEscape]);

  if (!open) return null;
  if (!mounted) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      {/* Click-to-close backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
        }}
      />

      {/* ── Drawer ───────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: 380,
          maxWidth: "100vw",
          height: "100%",
          background: "var(--color-bg)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-4px 0 24px var(--color-primary-a08)",
          overflowY: "auto",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
          ...FONT,
        }}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--color-primary)",
              textShadow: "0 0 10px var(--color-glow-strong)",
              ...FONT,
            }}
          >
            TERMINAL SETTINGS
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-secondary)",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              ...FONT,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a50)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────── */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── 1. COLOR MODE ─────────────────────────────────── */}
          <section>
            <SectionLabel>COLOR MODE</SectionLabel>
            <div className="grid grid-cols-2 gap-2" style={{ marginTop: 10 }}>
              {COLOR_MODES.map((mode) => {
                const active = settings.colorMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => updateSetting("colorMode", mode.value)}
                    className="flex items-center gap-2"
                    style={{
                      padding: "10px 12px",
                      background: active ? "var(--color-primary-a06)" : "var(--color-card)",
                      border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                      color: active ? "var(--color-primary)" : "var(--color-secondary)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 12,
                      ...FONT,
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        display: "inline-block",
                        background: mode.swatch,
                        flexShrink: 0,
                        boxShadow: active ? `0 0 6px ${mode.swatch}` : "none",
                      }}
                    />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── 2. FONT SIZE ──────────────────────────────────── */}
          <section>
            <SectionLabel>FONT SIZE</SectionLabel>
            <div className="flex gap-0" style={{ marginTop: 10 }}>
              {FONT_SIZES.map((fs) => {
                const active = settings.fontSize === fs.value;
                return (
                  <button
                    key={fs.value}
                    type="button"
                    onClick={() => updateSetting("fontSize", fs.value)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      background: active ? "var(--color-primary)" : "var(--color-card)",
                      color: active ? "var(--color-bg)" : "var(--color-secondary)",
                      border: active ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      ...FONT,
                    }}
                  >
                    {fs.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── 3. DISPLAY SLIDERS ────────────────────────────── */}
          <section>
            <SectionLabel>DISPLAY</SectionLabel>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 16 }}>
              {SLIDERS.map((slider) => {
                const disabled =
                  slider.key === "rainOpacity" && !settings.vancomycinRain;
                const value = settings[slider.key] as number;

                return (
                  <div key={slider.key} style={{ opacity: disabled ? 0.35 : 1 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--color-secondary)", ...FONT }}>
                        {slider.label}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--color-primary)",
                          minWidth: 28,
                          textAlign: "right",
                          ...FONT,
                        }}
                      >
                        {value}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="mx-range-slider"
                      min={0}
                      max={100}
                      step={1}
                      value={value}
                      disabled={disabled}
                      onChange={(e) =>
                        updateSetting(slider.key, Number(e.target.value))
                      }
                      style={{ width: "100%", cursor: disabled ? "not-allowed" : "pointer" }}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── 4. EFFECTS ────────────────────────────────────── */}
          <section>
            <SectionLabel>EFFECTS</SectionLabel>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {TOGGLES.map((toggle) => {
                const BASIC_FORCED_OFF = ["scanlineEffect", "typewriterAnimation", "blinkingCursor", "vancomycinRain", "whiteInputValues"];
                const forcedOff = settings.colorMode === "basic" && BASIC_FORCED_OFF.includes(toggle.key);
                const on = forcedOff ? false : (settings[toggle.key] as boolean);
                return (
                  <div
                    key={toggle.key}
                    className="flex items-center justify-between"
                    style={{ opacity: forcedOff ? 0.35 : 1 }}
                    title={forcedOff ? "Not available in Basic theme" : undefined}
                  >
                    <span style={{ fontSize: 12, color: "var(--color-secondary)", ...FONT }}>
                      {toggle.label}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={forcedOff}
                      onClick={() => { if (!forcedOff) updateSetting(toggle.key, !on); }}
                      style={{
                        position: "relative",
                        width: 40,
                        height: 20,
                        padding: 0,
                        background: on ? "var(--color-primary)" : "#1a1a1a",
                        border: on ? "none" : "1px solid var(--color-border)",
                        boxShadow: on ? "0 0 8px var(--color-primary-a50)" : "none",
                        cursor: forcedOff ? "not-allowed" : "pointer",
                        flexShrink: 0,
                        transition: "background 0.2s, box-shadow 0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: on ? 22 : 2,
                          width: 16,
                          height: 16,
                          background: on ? "var(--color-bg)" : "var(--color-border)",
                          transition: "left 0.2s",
                          display: "block",
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── 5. LIVE PREVIEW ────────────────────────────── */}
          <section>
            <SectionLabel>PREVIEW</SectionLabel>
            {(() => {
              const isBasic = settings.colorMode === "basic";
              if (isBasic) {
                return (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "14px 16px",
                      border: "1px solid #cbd5e0",
                      background: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "#1a3a5c", fontWeight: 600, fontFamily: "Inter, system-ui, sans-serif" }}>
                        AUC{"\u2082\u2084"}:
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 700, color: "#1e4d8c", fontFamily: "'JetBrains Mono', monospace" }}>
                        487
                      </span>
                      <span style={{ fontSize: 11, color: "#718096", fontFamily: "Inter, system-ui, sans-serif" }}>mg·h/L</span>
                    </div>
                    <p style={{ fontSize: 10, color: "#276749", fontWeight: 600, marginTop: 4, fontFamily: "Inter, system-ui, sans-serif" }}>
                      WITHIN TARGET RANGE
                    </p>
                  </div>
                );
              }
              return (
                <div
                  style={{
                    marginTop: 10,
                    padding: "12px 14px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    ...FONT,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--color-dim)" }}>AUC24:</span>
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: settings.whiteInputValues ? "#ffffff" : "var(--color-primary)",
                        textShadow: `0 0 8px ${settings.whiteInputValues ? "rgba(255,255,255,0.5)" : "var(--color-glow)"}`,
                      }}
                    >
                      487
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-dim)" }}>mg·h/L</span>
                  </div>
                </div>
              );
            })()}
          </section>

          {/* ── 6. RESET ──────────────────────────────────────── */}
          <section style={{ paddingTop: 4 }}>
            <button
              type="button"
              onClick={resetToDefaults}
              style={{
                width: "100%",
                padding: "12px 0",
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                color: "var(--color-secondary)",
                fontSize: 13,
                letterSpacing: "0.06em",
                cursor: "pointer",
                transition: "border-color 0.2s, color 0.2s, box-shadow 0.2s",
                ...FONT,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a50)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 12px var(--color-primary-a15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              [ RESET TO DEFAULTS ]
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "var(--color-dim)",
        textTransform: "uppercase" as const,
        fontFamily: "'Share Tech Mono', monospace",
      }}
    >
      {children}
    </div>
  );
}
