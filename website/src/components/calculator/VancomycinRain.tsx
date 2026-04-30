"use client";

import { useEffect, useRef } from "react";

interface VancomycinRainProps {
  opacity: number;
  colorMode: "basic";
}

const COLOR_MAP: Record<
  VancomycinRainProps["colorMode"],
  { primary: string; fade: string }
> = {
  "basic": { primary: "#2b6cb0", fade: "rgba(43,108,176," },
};

const SYMBOLS = ["OH", "NH", "C=O", "Cl", "\u03B1", "\u03B2", "\u03A3", "\u03BB", "\u03BC", "K"];
const COL_WIDTH = 28;
const FRAME_INTERVAL = 60;

export default function VancomycinRain({ opacity, colorMode }: VancomycinRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const colorModeRef = useRef(colorMode);
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
      const cols = Math.floor(canvas.width / COL_WIDTH);
      const prev = dropsRef.current;
      const next = new Array<number>(cols);
      for (let i = 0; i < cols; i++) {
        next[i] = i < prev.length ? prev[i] : Math.random() * -50;
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

      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, h);

      ctx.font = "11px Courier New";
      ctx.fillStyle = primary;

      for (let i = 0; i < cols; i++) {
        const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        ctx.fillText(sym, i * COL_WIDTH, drops[i] * 18);
        if (drops[i] * 18 > h && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    function onVisibilityChange() {
      pausedRef.current = document.hidden;
    }

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
        zIndex: 1,
        pointerEvents: "none",
        opacity: opacity / 100,
        willChange: "transform",
      }}
    />
  );
}
