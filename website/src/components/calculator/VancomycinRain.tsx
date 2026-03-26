"use client";

import { useEffect, useRef } from "react";

interface VancomycinRainProps {
  opacity: number;
  colorMode: "matrix-green" | "amber-terminal" | "high-contrast" | "clinical-blue";
}

const COLOR_MAP: Record<
  VancomycinRainProps["colorMode"],
  { primary: string; fade: string }
> = {
  "matrix-green": { primary: "#00ff41", fade: "rgba(0,255,65," },
  "amber-terminal": { primary: "#ffb000", fade: "rgba(255,176,0," },
  "high-contrast": { primary: "#ffffff", fade: "rgba(255,255,255," },
  "clinical-blue": { primary: "#00bfff", fade: "rgba(0,191,255," },
};

const CHARSET = "VCMKAUCtβαλ0123456789.∞Σ∂∫≈μΔΩπ";
const FONT_SIZE = 14;
const FRAME_INTERVAL = 33; // ~30fps

export default function VancomycinRain({ opacity, colorMode }: VancomycinRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const colorModeRef = useRef(colorMode);

  // Keep colorMode ref in sync so the animation loop reads the latest value
  // without needing to restart.
  colorModeRef.current = colorMode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const cols = Math.floor(canvas.width / FONT_SIZE);
      const prev = dropsRef.current;
      // Preserve existing columns, initialise new ones with staggered starts.
      const next = new Array<number>(cols);
      for (let i = 0; i < cols; i++) {
        next[i] = i < prev.length ? prev[i] : Math.random() * -100;
      }
      dropsRef.current = next;
    }

    function draw(now: number) {
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      if (now - lastFrameRef.current < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameRef.current = now;

      if (!ctx || !canvas) return;

      const { primary } = COLOR_MAP[colorModeRef.current];
      const drops = dropsRef.current;
      const cols = drops.length;
      const h = canvas.height;

      // Fade trail
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, h);

      // Draw characters
      ctx.font = `${FONT_SIZE}px 'Share Tech Mono', monospace`;
      ctx.fillStyle = primary + "cc"; // alpha ~0.8 via hex

      for (let i = 0; i < cols; i++) {
        const char = CHARSET[(Math.random() * CHARSET.length) | 0];
        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;
        ctx.fillText(char, x, y);

        drops[i]++;

        if (drops[i] * FONT_SIZE > h && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    function onVisibilityChange() {
      pausedRef.current = document.hidden;
    }

    // Initialise
    resize();
    rafRef.current = requestAnimationFrame(draw);

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9996,
        pointerEvents: "none",
        opacity: opacity / 100,
        willChange: "transform",
      }}
    />
  );
}
