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
  greenBrightness: number;
  backgroundShade: number;
  textSize: number;
  rainOpacity: number;
  scanlineEffect: boolean;
  typewriterAnimation: boolean;
  blinkingCursor: boolean;
  vancomycinRain: boolean;
  graphAnimations: boolean;
  soundEffects: boolean;
  whiteInputValues: boolean;
  /** Single theme — matrix-green removed. Kept for forward-compat in storage. */
  colorMode: "basic";
  fontSize: "small" | "medium" | "large" | "extra-large";
}

interface MatrixSettingsContextValue {
  settings: MatrixSettings;
  updateSetting: <K extends keyof MatrixSettings>(key: K, value: MatrixSettings[K]) => void;
  resetToDefaults: () => void;
  mounted: boolean;
  playSound: (type: "keyClick" | "calculate" | "success" | "error") => void;
}

// ---------------------------------------------------------------------------
// Defaults — Basic is the default theme
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
  whiteInputValues: false,
  colorMode: "basic",
  fontSize: "medium",
};

// ---------------------------------------------------------------------------
// Color-mode presets
// ---------------------------------------------------------------------------

interface ColorPreset {
  "--color-primary": string;
  "--color-secondary": string;
  "--color-dim": string;
  "--color-bg": string;
  "--color-border": string;
  "--color-card": string;
  "--color-input": string;
  "--color-highlight": string;
  "--color-glow": string;
  "--color-glow-strong": string;
  "--color-primary-a05": string;
  "--color-primary-a06": string;
  "--color-primary-a08": string;
  "--color-primary-a10": string;
  "--color-primary-a12": string;
  "--color-primary-a15": string;
  "--color-primary-a20": string;
  "--color-primary-a25": string;
  "--color-primary-a30": string;
  "--color-primary-a35": string;
  "--color-primary-a40": string;
  "--color-primary-a50": string;
}

const COLOR_PRESETS: Record<MatrixSettings["colorMode"], ColorPreset> = {
  "basic": {
    "--color-primary": "#2b6cb0",
    "--color-secondary": "#4a5568",
    "--color-dim": "#718096",
    "--color-bg": "#e8ecf1",
    "--color-border": "#c5cdd8",
    "--color-card": "#ffffff",
    "--color-input": "#ffffff",
    "--color-highlight": "#dae1ea",
    "--color-glow": "rgba(43,108,176,0.15)",
    "--color-glow-strong": "rgba(43,108,176,0.3)",
    "--color-primary-a05": "rgba(43,108,176,0.05)",
    "--color-primary-a06": "rgba(43,108,176,0.06)",
    "--color-primary-a08": "rgba(43,108,176,0.08)",
    "--color-primary-a10": "rgba(43,108,176,0.10)",
    "--color-primary-a12": "rgba(43,108,176,0.12)",
    "--color-primary-a15": "rgba(43,108,176,0.15)",
    "--color-primary-a20": "rgba(43,108,176,0.20)",
    "--color-primary-a25": "rgba(43,108,176,0.25)",
    "--color-primary-a30": "rgba(43,108,176,0.30)",
    "--color-primary-a35": "rgba(43,108,176,0.35)",
    "--color-primary-a40": "rgba(43,108,176,0.40)",
    "--color-primary-a50": "rgba(43,108,176,0.50)",
  },
};

// ---------------------------------------------------------------------------
// Font-size mapping
// ---------------------------------------------------------------------------

const FONT_SIZE_MAP: Record<MatrixSettings["fontSize"], string> = {
  small: "13px",
  medium: "15px",
  large: "17px",
  "extra-large": "20px",
};

// ---------------------------------------------------------------------------
// Sound effects — Web Audio API
// ---------------------------------------------------------------------------

let audioCtxSingleton: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!audioCtxSingleton) audioCtxSingleton = new AudioContext();
  if (audioCtxSingleton.state === "suspended") audioCtxSingleton.resume();
  return audioCtxSingleton;
}

function playTone(freq: number, durationMs: number, startDelay = 0) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = 0.08;
  gain.gain.setValueAtTime(0.08, ctx.currentTime + startDelay / 1000);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (startDelay + durationMs) / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startDelay / 1000);
  osc.stop(ctx.currentTime + (startDelay + durationMs + 20) / 1000);
}

function soundKeyClick() { playTone(800, 20); }
function soundCalculate() { playTone(440, 200, 0); playTone(550, 200, 200); playTone(660, 200, 400); }
function soundSuccess() { playTone(330, 150, 0); playTone(440, 150, 150); }
function soundError() { playTone(300, 150, 0); playTone(200, 300, 150); }

// ---------------------------------------------------------------------------
// DOM application helper
// ---------------------------------------------------------------------------

function applySettingsToDom(settings: MatrixSettings): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const rootStyle = root.style;
  const body = document.body;
  const preset = COLOR_PRESETS.basic;

  // --- Color-mode CSS custom properties (basic theme only) ---
  (Object.keys(preset) as (keyof ColorPreset)[]).forEach((key) => {
    rootStyle.setProperty(key, preset[key]);
  });

  // Legacy alias vars
  const p = preset["--color-primary"];
  rootStyle.setProperty("--mx-green", p);
  rootStyle.setProperty("--text-primary", p);
  rootStyle.setProperty("--foreground", p);
  rootStyle.setProperty("--teal", p);
  rootStyle.setProperty("--vc-text", p);

  // --- Theme class (always basic) ---
  body.classList.add("theme-basic");
  body.classList.remove("theme-matrix");
  body.style.fontFamily = "'Inter', 'Helvetica Neue', 'Arial', system-ui, sans-serif";
  rootStyle.setProperty("--font-mono", "'JetBrains Mono', 'Fira Code', 'Courier New', monospace");
  rootStyle.setProperty("--color-nav-bg", "#2c3e5a");
  rootStyle.setProperty("--color-nav-border", "#1e2d45");

  // --- Font size ---
  rootStyle.setProperty("font-size", FONT_SIZE_MAP[settings.fontSize]);

  // --- Brightness filter ---
  const brightness = 40 + (settings.greenBrightness / 100) * 60;
  const appRoot = document.getElementById("app-root");
  if (appRoot) {
    appRoot.style.filter = brightness < 100 ? `brightness(${brightness}%)` : "";
  }

  // --- Text size scale factor ---
  const textScale = 0.85 + (settings.textSize / 100) * 0.4;
  rootStyle.setProperty("--mx-text-scale", String(textScale));

  // --- Scanline opacity (always off in basic) ---
  rootStyle.setProperty("--mx-scanline-opacity", "0");

  // --- Rain opacity ---
  rootStyle.setProperty("--mx-rain-opacity", String(settings.rainOpacity / 100));

  // --- Toggle body classes (basic forces off scanlines + typewriter) ---
  const toggleClass = (cls: string, on: boolean) => { body.classList.toggle(cls, on); };
  toggleClass("no-scanlines", true);
  toggleClass("no-typewriter", true);
  toggleClass("no-blink", !settings.blinkingCursor);
  toggleClass("no-graph-anim", !settings.graphAnimations);
  toggleClass("input-values-white", settings.whiteInputValues);
}

// ---------------------------------------------------------------------------
// Migrate legacy colorMode values
// ---------------------------------------------------------------------------

function migrateColorMode(_mode: string): MatrixSettings["colorMode"] {
  // Matrix-green theme removed; all stored values collapse to basic.
  return "basic";
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const MatrixSettingsContext = createContext<MatrixSettingsContextValue | null>(null);
const STORAGE_KEY = "vancomyzer_settings";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function MatrixSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<MatrixSettings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);
  const hasMounted = useRef(false);

  // Read from localStorage on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MatrixSettings> & { colorMode?: string };
        // Migrate deleted themes
        if (parsed.colorMode) {
          parsed.colorMode = migrateColorMode(parsed.colorMode);
        }
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Corrupted — fall back to defaults
    }
    hasMounted.current = true;
    setMounted(true);
  }, []);

  // Apply to DOM & persist
  useEffect(() => {
    if (!hasMounted.current) return;
    applySettingsToDom(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* storage full */ }
  }, [settings, mounted]);

  const updateSetting = useCallback(
    <K extends keyof MatrixSettings>(key: K, value: MatrixSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const playSound = useCallback(
    (type: "keyClick" | "calculate" | "success" | "error") => {
      if (!settings.soundEffects) return;
      switch (type) {
        case "keyClick": soundKeyClick(); break;
        case "calculate": soundCalculate(); break;
        case "success": soundSuccess(); break;
        case "error": soundError(); break;
      }
    },
    [settings.soundEffects],
  );

  return (
    <MatrixSettingsContext.Provider value={{ settings, updateSetting, resetToDefaults, mounted, playSound }}>
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
    throw new Error("useMatrixSettings must be used within a <MatrixSettingsProvider>");
  }
  return ctx;
}
