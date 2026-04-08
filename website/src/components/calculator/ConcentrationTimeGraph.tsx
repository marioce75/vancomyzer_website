"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { CalculationDetails } from "@/types/calculator";

/* ── Types ──────────────────────────────────────────────────────── */

interface CurvePoint {
  time_hours: number;
  concentration: number;
}

interface ConcentrationTimeGraphProps {
  curve?: CurvePoint[] | null;
  measured_levels?: CurvePoint[] | null;
  calculationDetails?: CalculationDetails | null;
  pk_model_name?: "colin_2019" | "vancomyzer_obesity";
}

/* ── Constants ──────────────────────────────────────────────────── */

const FONT = "'Share Tech Mono', 'Courier New', monospace";
const PAD = { top: 24, right: 60, bottom: 42, left: 56 };
const TARGET_LOW = 10;
const TARGET_HIGH = 20;
const MIC = 1.0;

/* ── Color helpers — read CSS vars at draw time ──────────────── */

function getCSSColor(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/* ── Domain calculation ─────────────────────────────────────── */

function calcDomains(curve: CurvePoint[], measured: CurvePoint[], zoom: number) {
  const all = [...curve, ...measured];
  // Zoom is the hard cap — clips or extends the x axis to exactly the selected window
  const xMax = zoom;
  const visible = all.filter((p) => p.time_hours <= zoom);
  const yMax = Math.max(40, ...visible.map((p) => p.concentration), TARGET_HIGH + 5);
  return { xMin: 0, xMax, yMin: 0, yMax: Math.ceil(yMax / 5) * 5 };
}

/* ── Phase label ─────────────────────────────────────────────── */

function phaseLabel(curve: CurvePoint[], tHours: number): string {
  if (curve.length < 3) return "";
  // Find nearest point
  let closest = curve[0];
  let minDist = Infinity;
  for (const p of curve) {
    const d = Math.abs(p.time_hours - tHours);
    if (d < minDist) { minDist = d; closest = p; }
  }
  const idx = curve.indexOf(closest);
  const prev = idx > 0 ? curve[idx - 1] : null;
  const next = idx < curve.length - 1 ? curve[idx + 1] : null;
  if (!prev || !next) return "";
  const rising = next.concentration > closest.concentration;
  const falling = next.concentration < closest.concentration;
  const atPeak = prev.concentration < closest.concentration && next.concentration < closest.concentration;
  const atTrough = prev.concentration > closest.concentration && next.concentration > closest.concentration;
  if (atPeak) return "PEAK";
  if (atTrough) return "TROUGH";
  if (rising) return "INFUSION";
  if (falling) return "DISTRIBUTION";
  return "";
}

/* ── Find peaks and troughs in curve ──────────────────────── */

interface Landmark { time_hours: number; concentration: number; type: "peak" | "trough" }

function findLandmarks(curve: CurvePoint[]): Landmark[] {
  if (curve.length < 5) return [];
  const marks: Landmark[] = [];
  for (let i = 2; i < curve.length - 2; i++) {
    const prev = curve[i - 1].concentration;
    const curr = curve[i].concentration;
    const next = curve[i + 1].concentration;
    // Local minimum (trough) — concentration dips then rises
    if (curr <= prev && curr <= next && curr < prev - 0.01) {
      // Avoid duplicate troughs within 2h
      const last = marks.filter(m => m.type === "trough").pop();
      if (!last || curve[i].time_hours - last.time_hours > 2) {
        marks.push({ time_hours: curve[i].time_hours, concentration: curr, type: "trough" });
      }
    }
    // Local maximum (peak) — concentration rises then falls
    if (curr >= prev && curr >= next && curr > prev + 0.01) {
      const last = marks.filter(m => m.type === "peak").pop();
      if (!last || curve[i].time_hours - last.time_hours > 2) {
        marks.push({ time_hours: curve[i].time_hours, concentration: curr, type: "peak" });
      }
    }
  }
  return marks;
}

/* ── Canvas drawing ─────────────────────────────────────────── */

function drawGraph(
  canvas: HTMLCanvasElement,
  curve: CurvePoint[],
  measured: CurvePoint[],
  zoom: number,
  mouse: { x: number; y: number } | null,
  animProgress: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const primary = getCSSColor("--color-primary", "#00ff41");
  const secondary = getCSSColor("--color-secondary", "#00cc44");
  const dim = getCSSColor("--color-dim", "#009933");
  const border = getCSSColor("--color-border", "#004422");
  const gridMajor = getCSSColor("--color-primary-a06", "rgba(0,255,65,0.06)");
  const gridMinor = getCSSColor("--color-primary-a05", "rgba(0,255,65,0.03)");
  const axisLine = getCSSColor("--color-primary-a50", "rgba(0,255,65,0.5)");
  const axisOuter = getCSSColor("--color-primary-a30", "rgba(0,255,65,0.3)");
  const aucFill = getCSSColor("--color-primary-a08", "rgba(0,255,65,0.08)");
  const glowPath = getCSSColor("--color-primary-a15", "rgba(0,255,65,0.15)");
  const crossV = getCSSColor("--color-primary-a40", "rgba(0,255,65,0.4)");
  const crossH = getCSSColor("--color-primary-a20", "rgba(0,255,65,0.2)");

  const { xMin, xMax, yMin, yMax } = calcDomains(curve, measured, zoom);
  const gw = w - PAD.left - PAD.right;
  const gh = h - PAD.top - PAD.bottom;

  const toX = (t: number) => PAD.left + ((t - xMin) / (xMax - xMin)) * gw;
  const toY = (c: number) => PAD.top + ((yMax - c) / (yMax - yMin)) * gh;
  const fromX = (px: number) => xMin + ((px - PAD.left) / gw) * (xMax - xMin);
  const fromY = (py: number) => yMax - ((py - PAD.top) / gh) * (yMax - yMin);

  // ─── Background ───
  const bgColor = getCSSColor("--color-card", "#000000");
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  // ─── Grid lines ───
  // Major vertical every 12h
  for (let t = 0; t <= xMax; t += 12) {
    const x = toX(t);
    ctx.strokeStyle = t % 12 === 0 ? gridMajor : gridMinor;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + gh); ctx.stroke();
  }
  // Minor vertical every 6h
  for (let t = 6; t <= xMax; t += 12) {
    const x = toX(t);
    ctx.strokeStyle = gridMinor;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + gh); ctx.stroke();
  }
  // Major horizontal every 5
  for (let c = 0; c <= yMax; c += 5) {
    const y = toY(c);
    ctx.strokeStyle = gridMajor;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + gw, y); ctx.stroke();
  }
  // Minor horizontal every 2.5
  for (let c = 2.5; c <= yMax; c += 5) {
    const y = toY(c);
    ctx.strokeStyle = gridMinor;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + gw, y); ctx.stroke();
  }

  // ─── Target range band ───
  const yTargetTop = toY(TARGET_HIGH);
  const yTargetBot = toY(TARGET_LOW);
  ctx.fillStyle = aucFill;
  ctx.fillRect(PAD.left, yTargetTop, gw, yTargetBot - yTargetTop);
  ctx.font = `9px ${FONT}`;
  ctx.fillStyle = dim;
  ctx.textAlign = "right";
  ctx.fillText("TARGET RANGE", PAD.left + gw - 4, yTargetTop + 12);

  // ─── MIC line ───
  const yMic = toY(MIC);
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "rgba(255,100,100,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD.left, yMic); ctx.lineTo(PAD.left + gw, yMic); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `9px ${FONT}`;
  ctx.fillStyle = "rgba(255,100,100,0.6)";
  ctx.textAlign = "right";
  ctx.fillText("MIC 1.0", PAD.left + gw - 4, yMic - 3);

  // ─── Trough reference lines ───
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = secondary;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD.left, toY(TARGET_HIGH)); ctx.lineTo(PAD.left + gw, toY(TARGET_HIGH)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD.left, toY(TARGET_LOW)); ctx.lineTo(PAD.left + gw, toY(TARGET_LOW)); ctx.stroke();
  ctx.setLineDash([]);

  // ─── Axes ───
  ctx.strokeStyle = axisLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + gh);
  ctx.lineTo(PAD.left + gw, PAD.top + gh);
  ctx.stroke();

  // Outer border
  ctx.strokeStyle = axisOuter;
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD.left, PAD.top, gw, gh);

  // ─── Tick labels ───
  ctx.font = `9px ${FONT}`;
  ctx.fillStyle = secondary;
  ctx.textAlign = "center";
  for (let t = 0; t <= xMax; t += 12) {
    ctx.fillText(`${t}h`, toX(t), PAD.top + gh + 16);
  }
  ctx.textAlign = "right";
  for (let c = 0; c <= yMax; c += 5) {
    ctx.fillText(String(c), PAD.left - 6, toY(c) + 3);
  }

  // ─── Axis titles ───
  ctx.font = `9px ${FONT}`;
  ctx.fillStyle = dim;
  ctx.textAlign = "center";
  ctx.fillText("TIME (HOURS POST-DOSE)", PAD.left + gw / 2, h - 6);
  ctx.save();
  ctx.translate(12, PAD.top + gh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("CONCENTRATION (mg/L)", 0, 0);
  ctx.restore();

  // ─── Empty state text ───
  if (curve.length === 0 && measured.length === 0) {
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = dim;
    ctx.textAlign = "center";
    ctx.fillText(
      "> AWAITING PATIENT DATA",
      PAD.left + gw / 2, PAD.top + gh / 2 - 8
    );
    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = border;
    ctx.fillText(
      "Enter age, weight, SCr and dose to generate concentration profile",
      PAD.left + gw / 2, PAD.top + gh / 2 + 10
    );
    return;
  }

  // ─── Clip all curve/data drawing to the plot area ───
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.left, PAD.top, gw, gh);
  ctx.clip();

  // ─── AUC shading (last 24h of curve) ───
  if (curve.length > 2) {
    const tEnd = curve[curve.length - 1].time_hours;
    const tStart = Math.max(0, tEnd - 24);
    const aucPts = curve.filter((p) => p.time_hours >= tStart);
    if (aucPts.length > 1) {
      ctx.fillStyle = aucFill;
      ctx.beginPath();
      ctx.moveTo(toX(aucPts[0].time_hours), toY(0));
      for (const p of aucPts) ctx.lineTo(toX(p.time_hours), toY(p.concentration));
      ctx.lineTo(toX(aucPts[aucPts.length - 1].time_hours), toY(0));
      ctx.closePath();
      ctx.fill();
    }
  }

  // ─── Glow path ───
  if (curve.length > 1) {
    const drawLen = Math.floor(curve.length * animProgress);
    if (drawLen > 1) {
      ctx.strokeStyle = glowPath;
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(toX(curve[0].time_hours), toY(curve[0].concentration));
      for (let i = 1; i < drawLen; i++) {
        ctx.lineTo(toX(curve[i].time_hours), toY(curve[i].concentration));
      }
      ctx.stroke();
    }
  }

  // ─── Main curve with gradient ───
  if (curve.length > 1) {
    const drawLen = Math.floor(curve.length * animProgress);
    if (drawLen > 1) {
      for (let i = 1; i < drawLen; i++) {
        const c = curve[i].concentration;
        const ratio = Math.min(c / yMax, 1);
        // Peak = bright primary, low = dim
        const r = Math.round(ratio * 0 + (1 - ratio) * 0);
        const g = Math.round(ratio * 255 + (1 - ratio) * 170);
        const b = Math.round(ratio * 65 + (1 - ratio) * 34);
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(toX(curve[i - 1].time_hours), toY(curve[i - 1].concentration));
        ctx.lineTo(toX(curve[i].time_hours), toY(curve[i].concentration));
        ctx.stroke();
      }
    }
  }

  // ─── Measured levels ───
  for (const p of measured) {
    const mx = toX(p.time_hours);
    const my = toY(p.concentration);
    ctx.beginPath();
    ctx.arc(mx, my, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ─── Peak and trough markers ───
  if (curve.length > 5 && animProgress >= 1) {
    const landmarks = findLandmarks(curve);
    for (const lm of landmarks) {
      if (lm.time_hours > xMax) continue;
      const lx = toX(lm.time_hours);
      const ly = toY(lm.concentration);

      if (lm.type === "trough") {
        // Diamond ◆ marker
        const s = 4;
        ctx.beginPath();
        ctx.moveTo(lx, ly - s);
        ctx.lineTo(lx + s, ly);
        ctx.lineTo(lx, ly + s);
        ctx.lineTo(lx - s, ly);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = primary;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Horizontal dashed line from trough to Y axis
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PAD.left, ly);
        ctx.lineTo(lx - s - 2, ly);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Triangle ▲ marker for peak
        const s = 4;
        ctx.beginPath();
        ctx.moveTo(lx, ly - s - 1);
        ctx.lineTo(lx + s, ly + s - 1);
        ctx.lineTo(lx - s, ly + s - 1);
        ctx.closePath();
        ctx.fillStyle = primary;
        ctx.fill();
      }
    }

    // Trough reference line — use the last trough value
    const lastTrough = landmarks.filter(m => m.type === "trough").pop();
    if (lastTrough) {
      const ty = toY(lastTrough.concentration);
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, ty);
      ctx.lineTo(PAD.left + gw, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      // Label
      ctx.font = `8px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.textAlign = "right";
      ctx.fillText(`TROUGH ${lastTrough.concentration.toFixed(2)}`, PAD.left + gw - 4, ty - 3);
    }
  }

  // ─── Restore from clip ───
  ctx.restore();

  // ─── Crosshair + tooltip on hover ───
  if (mouse && mouse.x >= PAD.left && mouse.x <= PAD.left + gw && mouse.y >= PAD.top && mouse.y <= PAD.top + gh) {
    // Vertical hairline
    ctx.strokeStyle = crossV;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mouse.x, PAD.top); ctx.lineTo(mouse.x, PAD.top + gh); ctx.stroke();
    // Horizontal hairline
    ctx.strokeStyle = crossH;
    ctx.beginPath(); ctx.moveTo(PAD.left, mouse.y); ctx.lineTo(PAD.left + gw, mouse.y); ctx.stroke();

    if (curve.length > 0) {
      const tHover = fromX(mouse.x);
      // Interpolate concentration
      let cInterp = 0;
      for (let i = 1; i < curve.length; i++) {
        if (curve[i].time_hours >= tHover) {
          const t0 = curve[i - 1].time_hours;
          const t1 = curve[i].time_hours;
          const c0 = curve[i - 1].concentration;
          const c1 = curve[i].concentration;
          const frac = (tHover - t0) / (t1 - t0 || 1);
          cInterp = c0 + frac * (c1 - c0);
          break;
        }
      }
      const phase = phaseLabel(curve, tHover);

      // Tooltip box
      const tx = mouse.x + 12;
      const ty = mouse.y - 50;
      ctx.fillStyle = bgColor;
      ctx.fillRect(tx, ty, 130, phase ? 48 : 36);
      ctx.strokeStyle = primary;
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, ty, 130, phase ? 48 : 36);

      ctx.font = `10px ${FONT}`;
      ctx.textAlign = "left";
      ctx.fillStyle = secondary;
      ctx.fillText(`T+${tHover.toFixed(1)}h`, tx + 6, ty + 14);
      ctx.fillStyle = primary;
      ctx.fillText(`C = ${cInterp.toFixed(1)} mg/L`, tx + 6, ty + 28);
      if (phase) {
        ctx.fillStyle = dim;
        ctx.font = `9px ${FONT}`;
        ctx.fillText(phase, tx + 6, ty + 42);
      }

      // Dot on curve at hover point
      ctx.beginPath();
      ctx.arc(mouse.x, toY(cInterp), 4, 0, Math.PI * 2);
      ctx.fillStyle = primary;
      ctx.fill();
      ctx.strokeStyle = bgColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

/* ── Component ──────────────────────────────────────────────── */

export default function ConcentrationTimeGraph({
  curve,
  measured_levels,
  calculationDetails,
  pk_model_name,
}: ConcentrationTimeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(96);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const animRef = useRef(0);
  const rafRef = useRef(0);
  const prevCurveLen = useRef(0);

  const curveData = curve ?? [];
  const measuredData = measured_levels ?? [];

  // Animate curve on new data
  useEffect(() => {
    if (curveData.length > 0 && curveData.length !== prevCurveLen.current) {
      // Check prefers-reduced-motion
      const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReduced) {
        animRef.current = 1;
        prevCurveLen.current = curveData.length;
        return;
      }
      animRef.current = 0;
      const start = performance.now();
      const duration = 1200;
      const tick = (now: number) => {
        const elapsed = now - start;
        animRef.current = Math.min(elapsed / duration, 1);
        if (animRef.current < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
      prevCurveLen.current = curveData.length;
      return () => cancelAnimationFrame(rafRef.current);
    } else if (curveData.length === 0) {
      animRef.current = 0;
      prevCurveLen.current = 0;
    }
  }, [curveData.length]);

  // Draw loop
  useEffect(() => {
    let running = true;
    function frame() {
      if (!running) return;
      const canvas = canvasRef.current;
      if (canvas) {
        drawGraph(canvas, curveData, measuredData, zoom, mouse, curveData.length > 0 ? (animRef.current || 1) : 0);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return () => { running = false; };
  }, [curveData, measuredData, zoom, mouse]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleMouseLeave = useCallback(() => setMouse(null), []);

  const modelLabel = calculationDetails?.method
    ? (pk_model_name === "vancomyzer_obesity" ? "Vancomyzer Obesity Model" : "Colin 2019")
    : "";
  const modelSubLabel = pk_model_name === "vancomyzer_obesity" ? "Smit 2020 + Zhang 2023" : "";
  const evidenceLabel = calculationDetails?.evidence_strength ?? "";

  return (
    <div className="flex flex-col gap-0 w-full" aria-label="Concentration-time graph">
      {/* Header line */}
      <div
        className="flex flex-wrap items-center gap-2 px-1 pb-2"
        style={{ fontFamily: FONT }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: getCSSColor("--color-secondary", "#00cc44") }}>
          CONCENTRATION-TIME PROFILE
        </span>
        {modelLabel && (
          <>
            <span style={{ fontSize: 9, color: getCSSColor("--color-dim", "#009933") }}>{"\u00B7"}</span>
            <span style={{ fontSize: 9, color: getCSSColor("--color-dim", "#009933") }}>{modelLabel}</span>
            <span style={{ fontSize: 9, color: getCSSColor("--color-dim", "#009933") }}>{"\u00B7"}</span>
            <span style={{ fontSize: 9, color: getCSSColor("--color-dim", "#009933") }}>Two-Compartment</span>
            {modelSubLabel && (
              <>
                <span style={{ fontSize: 9, color: getCSSColor("--color-dim", "#009933") }}>{"\u00B7"}</span>
                <span style={{ fontSize: 9, color: getCSSColor("--color-dim", "#009933") }}>{modelSubLabel}</span>
              </>
            )}
          </>
        )}
        {evidenceLabel && (
          <>
            <span style={{ fontSize: 9, color: getCSSColor("--color-dim", "#009933") }}>{"\u00B7"}</span>
            <span style={{ fontSize: 9, color: getCSSColor("--color-dim", "#009933") }}>{evidenceLabel}</span>
          </>
        )}
        <span style={{ fontSize: 9, color: getCSSColor("--color-dim", "#009933") }}>{"\u00B7"}</span>
        {[24, 48, 96, 168].map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoom(z)}
            style={{
              fontSize: 10,
              fontFamily: FONT,
              padding: "2px 8px",
              cursor: "pointer",
              fontWeight: zoom === z ? 700 : 500,
              border: zoom === z ? `1px solid ${getCSSColor("--color-primary", "#00ff41")}` : `1px solid ${getCSSColor("--color-border", "#004422")}`,
              background: zoom === z ? getCSSColor("--color-primary", "#00ff41") : "transparent",
              color: zoom === z ? getCSSColor("--color-card", "#000") : getCSSColor("--color-dim", "#009933"),
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => {
              if (zoom !== z) {
                (e.currentTarget as HTMLElement).style.background = getCSSColor("--color-primary", "#2b6cb0");
                (e.currentTarget as HTMLElement).style.color = getCSSColor("--color-card", "#fff");
                (e.currentTarget as HTMLElement).style.borderColor = getCSSColor("--color-primary", "#2b6cb0");
              }
            }}
            onMouseLeave={e => {
              if (zoom !== z) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = getCSSColor("--color-dim", "#009933");
                (e.currentTarget as HTMLElement).style.borderColor = getCSSColor("--color-border", "#004422");
              }
            }}
          >
            {z}H
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: 280, background: "var(--color-card)", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-1 pt-2" style={{ fontFamily: FONT }}>
        <span className="flex items-center gap-1 text-[8px]" style={{ color: getCSSColor("--color-dim", "#009933") }}>
          <span className="inline-block w-4 h-0.5" style={{ background: getCSSColor("--color-primary", "#00ff41") }} /> Predicted
        </span>
        <span className="flex items-center gap-1 text-[8px]" style={{ color: getCSSColor("--color-dim", "#009933") }}>
          <span className="inline-block w-4 h-0.5 border-t border-dashed" style={{ borderColor: getCSSColor("--color-secondary", "#00cc44") }} /> Trough ref (10–20)
        </span>
        <span className="flex items-center gap-1 text-[8px]" style={{ color: getCSSColor("--color-dim", "#009933") }}>
          <span className="inline-block w-3 h-3" style={{ background: "var(--color-primary-a08)", border: "1px solid var(--color-primary-a20)" }} /> AUC₂₄
        </span>
        <span className="flex items-center gap-1 text-[8px]" style={{ color: getCSSColor("--color-dim", "#009933") }}>
          ◆ Trough
        </span>
        <span className="flex items-center gap-1 text-[8px]" style={{ color: getCSSColor("--color-dim", "#009933") }}>
          <span style={{ color: getCSSColor("--color-primary", "#00ff41") }}>▲</span> Peak
        </span>
        {measuredData.length > 0 && (
          <span className="flex items-center gap-1 text-[8px]" style={{ color: getCSSColor("--color-dim", "#009933") }}>
            <span className="inline-block w-2 h-2" style={{ background: "#fff", border: `1px solid ${getCSSColor("--color-primary", "#00ff41")}` }} /> Measured
          </span>
        )}
      </div>
    </div>
  );
}
