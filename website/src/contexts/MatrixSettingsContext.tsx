"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatrixSettings {
  greenBrightness: number; // 0-100, default 100
  backgroundShade: number; // 0-100, default 0
  textSize: number; // 0-100, default 50
  rainOpacity: number; // 0-100, default 70
  scanlineEffect: boolean; // default true
  typewriterAnimation: boolean; // default true
  blinkingCursor: boolean; // default true
  vancomycinRain: boolean; // default false
  graphAnimations: boolean; // default true
  soundEffects: boolean; // default false
  colorMode:
    | "matrix-green"
    | "amber-terminal"
    | "high-contrast"
    | "clinical-blue"; // default 'matrix-green'
  fontSize: "small" | "medium" | "large" | "extra-large"; // default 'medium'
}

interface MatrixSettingsContextValue {
  settings: MatrixSettings;
  updateSetting: <K extends keyof MatrixSettings>(
    key: K,
    value: MatrixSettings[K],
  ) => void;
  resetToDefaults: () => void;
  mounted: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: MatrixSettings = {
  greenBrightness: 100,
  backgroundShade: 0,
  textSize: 50,
  rainOpacity: 70,
  scanlineEffect: true,
  typewriterAnimation: true,
  blinkingCursor: true,
  vancomycinRain: false,
  graphAnimations: true,
  soundEffects: false,
  colorMode: "matrix-green",
  fontSize: "medium",
};

// ---------------------------------------------------------------------------
// Color-mode presets
// ---------------------------------------------------------------------------

interface ColorPreset {
  "--mx-green": string;
  "--mx-green-dim": string;
  "--mx-green-muted": string;
  "--mx-green-dark": string;
  "--mx-green-glow": string;
  "--mx-green-border": string;
  "--mx-card": string;
}

const COLOR_PRESETS: Record<MatrixSettings["colorMode"], ColorPreset> = {
  "matrix-green": {
    "--mx-green": "#00ff41",
    "--mx-green-dim": "#00a827",
    "--mx-green-muted": "#1a5c1a",
    "--mx-green-dark": "#003b00",
    "--mx-green-glow": "rgba(0,255,65,0.12)",
    "--mx-green-border": "rgba(0,255,65,0.40)",
    "--mx-card": "#050505",
  },
  "amber-terminal": {
    "--mx-green": "#ffb000",
    "--mx-green-dim": "#b37a00",
    "--mx-green-muted": "#5c4000",
    "--mx-green-dark": "#3b2900",
    "--mx-green-glow": "rgba(255,176,0,0.12)",
    "--mx-green-border": "rgba(255,176,0,0.40)",
    "--mx-card": "#0a0800",
  },
  "high-contrast": {
    "--mx-green": "#ffffff",
    "--mx-green-dim": "#b0b0b0",
    "--mx-green-muted": "#666666",
    "--mx-green-dark": "#333333",
    "--mx-green-glow": "rgba(255,255,255,0.12)",
    "--mx-green-border": "rgba(255,255,255,0.40)",
    "--mx-card": "#0a0a0a",
  },
  "clinical-blue": {
    "--mx-green": "#00bfff",
    "--mx-green-dim": "#0080aa",
    "--mx-green-muted": "#004466",
    "--mx-green-dark": "#002b44",
    "--mx-green-glow": "rgba(0,191,255,0.12)",
    "--mx-green-border": "rgba(0,191,255,0.40)",
    "--mx-card": "#000a0f",
  },
};

// ---------------------------------------------------------------------------
// Font-size mapping
// ---------------------------------------------------------------------------

const FONT_SIZE_MAP: Record<MatrixSettings["fontSize"], string> = {
  small: "12px",
  medium: "14px",
  large: "16px",
  "extra-large": "18px",
};

// ---------------------------------------------------------------------------
// DOM application helper
// ---------------------------------------------------------------------------

function applySettingsToDom(settings: MatrixSettings): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement.style;
  const preset = COLOR_PRESETS[settings.colorMode];

  // --- Color-mode CSS variables ---
  (Object.keys(preset) as (keyof ColorPreset)[]).forEach((key) => {
    root.setProperty(key, preset[key]);
  });

  // Aliased / convenience vars that downstream components may use
  const primary = preset["--mx-green"];
  root.setProperty("--text-primary", primary);
  root.setProperty("--foreground", primary);
  root.setProperty("--teal", primary);
  root.setProperty("--vc-text", primary);

  // --- Font size base ---
  root.setProperty("--mx-font-size-base", FONT_SIZE_MAP[settings.fontSize]);

  // --- Scanline opacity ---
  root.setProperty(
    "--mx-scanline-opacity",
    settings.scanlineEffect ? "0.10" : "0",
  );

  // --- Rain opacity ---
  root.setProperty("--mx-rain-opacity", String(settings.rainOpacity / 100));

  // --- Green brightness via filter on #vancomyzer-app ---
  const brightness = 0.3 + (settings.greenBrightness / 100) * 0.7;
  root.setProperty("--mx-brightness", String(brightness));
  const appEl = document.getElementById("vancomyzer-app");
  if (appEl) {
    appEl.style.setProperty("filter", `brightness(${brightness})`);
  }

  // --- Background shade: interpolate #000000 (0) -> #1a1a1a (100) ---
  const shade = Math.round((settings.backgroundShade / 100) * 0x1a);
  const hex = shade.toString(16).padStart(2, "0");
  const bgColor = `#${hex}${hex}${hex}`;
  root.setProperty("--mx-black", bgColor);
  root.setProperty("--background", bgColor);

  // --- Text size: scale factor ---
  const textScale = 0.85 + (settings.textSize / 100) * 0.4;
  root.setProperty("--mx-text-scale", String(textScale));

  // --- Toggle body classes ---
  const body = document.body;

  const toggleClass = (cls: string, off: boolean) => {
    if (off) {
      body.classList.add(cls);
    } else {
      body.classList.remove(cls);
    }
  };

  toggleClass("no-scanlines", !settings.scanlineEffect);
  toggleClass("no-typewriter", !settings.typewriterAnimation);
  toggleClass("no-blink", !settings.blinkingCursor);
  toggleClass("no-graph-anim", !settings.graphAnimations);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const MatrixSettingsContext = createContext<MatrixSettingsContextValue | null>(
  null,
);

const STORAGE_KEY = "vancomyzer-matrix-settings";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function MatrixSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<MatrixSettings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);
  const hasMounted = useRef(false);

  // --- Read from localStorage on first mount ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Partial<MatrixSettings> = JSON.parse(raw);
        // Merge with defaults so newly-added keys are always present
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Corrupted or unavailable storage -- silently fall back to defaults
    }

    hasMounted.current = true;
    setMounted(true);
  }, []);

  // --- Apply to DOM & persist whenever settings change (after mount) ---
  useEffect(() => {
    if (!hasMounted.current) return;

    applySettingsToDom(settings);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage full or unavailable -- ignore
    }
  }, [settings, mounted]);

  // --- Updaters ---
  const updateSetting = useCallback(
    <K extends keyof MatrixSettings>(key: K, value: MatrixSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <MatrixSettingsContext.Provider
      value={{ settings, updateSetting, resetToDefaults, mounted }}
    >
      {children}
    </MatrixSettingsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMatrixSettings(): MatrixSettingsContextValue {
  const ctx = useContext(MatrixSettingsContext);
  if (!ctx) {
    throw new Error(
      "useMatrixSettings must be used within a <MatrixSettingsProvider>",
    );
  }
  return ctx;
}
