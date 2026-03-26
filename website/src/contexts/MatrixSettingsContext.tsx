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
  colorMode: "matrix-green" | "amber-terminal" | "high-contrast" | "clinical-blue";
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
// Color-mode presets — every variable the app needs
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
  "matrix-green": {
    "--color-primary": "#00ff41",
    "--color-secondary": "#00cc44",
    "--color-dim": "#009933",
    "--color-bg": "#000000",
    "--color-border": "#004422",
    "--color-card": "#050505",
    "--color-input": "#0d0d0d",
    "--color-highlight": "#0a1a0a",
    "--color-glow": "rgba(0,255,65,0.5)",
    "--color-glow-strong": "rgba(0,255,65,0.8)",
    "--color-primary-a05": "rgba(0,255,65,0.05)",
    "--color-primary-a06": "rgba(0,255,65,0.06)",
    "--color-primary-a08": "rgba(0,255,65,0.08)",
    "--color-primary-a10": "rgba(0,255,65,0.10)",
    "--color-primary-a12": "rgba(0,255,65,0.12)",
    "--color-primary-a15": "rgba(0,255,65,0.15)",
    "--color-primary-a20": "rgba(0,255,65,0.20)",
    "--color-primary-a25": "rgba(0,255,65,0.25)",
    "--color-primary-a30": "rgba(0,255,65,0.30)",
    "--color-primary-a35": "rgba(0,255,65,0.35)",
    "--color-primary-a40": "rgba(0,255,65,0.40)",
    "--color-primary-a50": "rgba(0,255,65,0.50)",
  },
  "amber-terminal": {
    "--color-primary": "#ffaa00",
    "--color-secondary": "#cc8800",
    "--color-dim": "#886600",
    "--color-bg": "#000000",
    "--color-border": "#442200",
    "--color-card": "#0a0500",
    "--color-input": "#0d0800",
    "--color-highlight": "#1a0f00",
    "--color-glow": "rgba(255,170,0,0.5)",
    "--color-glow-strong": "rgba(255,170,0,0.8)",
    "--color-primary-a05": "rgba(255,170,0,0.05)",
    "--color-primary-a06": "rgba(255,170,0,0.06)",
    "--color-primary-a08": "rgba(255,170,0,0.08)",
    "--color-primary-a10": "rgba(255,170,0,0.10)",
    "--color-primary-a12": "rgba(255,170,0,0.12)",
    "--color-primary-a15": "rgba(255,170,0,0.15)",
    "--color-primary-a20": "rgba(255,170,0,0.20)",
    "--color-primary-a25": "rgba(255,170,0,0.25)",
    "--color-primary-a30": "rgba(255,170,0,0.30)",
    "--color-primary-a35": "rgba(255,170,0,0.35)",
    "--color-primary-a40": "rgba(255,170,0,0.40)",
    "--color-primary-a50": "rgba(255,170,0,0.50)",
  },
  "high-contrast": {
    "--color-primary": "#ffffff",
    "--color-secondary": "#cccccc",
    "--color-dim": "#888888",
    "--color-bg": "#000000",
    "--color-border": "#444444",
    "--color-card": "#0a0a0a",
    "--color-input": "#111111",
    "--color-highlight": "#1a1a1a",
    "--color-glow": "rgba(255,255,255,0.5)",
    "--color-glow-strong": "rgba(255,255,255,0.8)",
    "--color-primary-a05": "rgba(255,255,255,0.05)",
    "--color-primary-a06": "rgba(255,255,255,0.06)",
    "--color-primary-a08": "rgba(255,255,255,0.08)",
    "--color-primary-a10": "rgba(255,255,255,0.10)",
    "--color-primary-a12": "rgba(255,255,255,0.12)",
    "--color-primary-a15": "rgba(255,255,255,0.15)",
    "--color-primary-a20": "rgba(255,255,255,0.20)",
    "--color-primary-a25": "rgba(255,255,255,0.25)",
    "--color-primary-a30": "rgba(255,255,255,0.30)",
    "--color-primary-a35": "rgba(255,255,255,0.35)",
    "--color-primary-a40": "rgba(255,255,255,0.40)",
    "--color-primary-a50": "rgba(255,255,255,0.50)",
  },
  "clinical-blue": {
    "--color-primary": "#00aaff",
    "--color-secondary": "#0088cc",
    "--color-dim": "#005588",
    "--color-bg": "#000000",
    "--color-border": "#002244",
    "--color-card": "#000a0f",
    "--color-input": "#001520",
    "--color-highlight": "#001a2e",
    "--color-glow": "rgba(0,170,255,0.5)",
    "--color-glow-strong": "rgba(0,170,255,0.8)",
    "--color-primary-a05": "rgba(0,170,255,0.05)",
    "--color-primary-a06": "rgba(0,170,255,0.06)",
    "--color-primary-a08": "rgba(0,170,255,0.08)",
    "--color-primary-a10": "rgba(0,170,255,0.10)",
    "--color-primary-a12": "rgba(0,170,255,0.12)",
    "--color-primary-a15": "rgba(0,170,255,0.15)",
    "--color-primary-a20": "rgba(0,170,255,0.20)",
    "--color-primary-a25": "rgba(0,170,255,0.25)",
    "--color-primary-a30": "rgba(0,170,255,0.30)",
    "--color-primary-a35": "rgba(0,170,255,0.35)",
    "--color-primary-a40": "rgba(0,170,255,0.40)",
    "--color-primary-a50": "rgba(0,170,255,0.50)",
  },
};

// ---------------------------------------------------------------------------
// Font-size mapping — applied directly to <html> for rem scaling
// ---------------------------------------------------------------------------

const FONT_SIZE_MAP: Record<MatrixSettings["fontSize"], string> = {
  small: "13px",
  medium: "15px",
  large: "17px",
  "extra-large": "20px",
};

// ---------------------------------------------------------------------------
// Sound effects — Web Audio API (no external files)
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

function soundKeyClick() {
  playTone(800, 20);
}

function soundCalculate() {
  playTone(440, 200, 0);
  playTone(550, 200, 200);
  playTone(660, 200, 400);
}

function soundSuccess() {
  playTone(330, 150, 0);
  playTone(440, 150, 150);
}

function soundError() {
  playTone(300, 150, 0);
  playTone(200, 300, 150);
}

// ---------------------------------------------------------------------------
// DOM application helper
// ---------------------------------------------------------------------------

function applySettingsToDom(settings: MatrixSettings): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const rootStyle = root.style;
  const preset = COLOR_PRESETS[settings.colorMode];

  // --- Color-mode CSS custom properties ---
  (Object.keys(preset) as (keyof ColorPreset)[]).forEach((key) => {
    rootStyle.setProperty(key, preset[key]);
  });

  // Legacy alias vars (for any remaining references)
  const p = preset["--color-primary"];
  rootStyle.setProperty("--mx-green", p);
  rootStyle.setProperty("--text-primary", p);
  rootStyle.setProperty("--foreground", p);
  rootStyle.setProperty("--teal", p);
  rootStyle.setProperty("--vc-text", p);

  // --- Font size on <html> for rem scaling ---
  rootStyle.setProperty("font-size", FONT_SIZE_MAP[settings.fontSize]);

  // --- Brightness filter on app root ---
  const brightness = 40 + (settings.greenBrightness / 100) * 60; // range 40-100
  const appRoot = document.getElementById("app-root");
  if (appRoot) {
    appRoot.style.filter = brightness < 100 ? `brightness(${brightness}%)` : "";
  }

  // --- Background shade ---
  const shade = Math.round((settings.backgroundShade / 100) * 0x1a);
  const hex = shade.toString(16).padStart(2, "0");
  const bgColor = `#${hex}${hex}${hex}`;
  rootStyle.setProperty("--color-bg", bgColor);
  rootStyle.setProperty("--background", bgColor);

  // --- Text size scale factor ---
  const textScale = 0.85 + (settings.textSize / 100) * 0.4;
  rootStyle.setProperty("--mx-text-scale", String(textScale));

  // --- Scanline opacity ---
  rootStyle.setProperty("--mx-scanline-opacity", settings.scanlineEffect ? "0.10" : "0");

  // --- Rain opacity ---
  rootStyle.setProperty("--mx-rain-opacity", String(settings.rainOpacity / 100));

  // --- Toggle body classes ---
  const body = document.body;
  const toggleClass = (cls: string, off: boolean) => {
    body.classList.toggle(cls, off);
  };
  toggleClass("no-scanlines", !settings.scanlineEffect);
  toggleClass("no-typewriter", !settings.typewriterAnimation);
  toggleClass("no-blink", !settings.blinkingCursor);
  toggleClass("no-graph-anim", !settings.graphAnimations);
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
        const parsed: Partial<MatrixSettings> = JSON.parse(raw);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Corrupted or unavailable — fall back to defaults
    }
    hasMounted.current = true;
    setMounted(true);
  }, []);

  // Apply to DOM & persist whenever settings change (after mount)
  useEffect(() => {
    if (!hasMounted.current) return;
    applySettingsToDom(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage full — ignore
    }
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
