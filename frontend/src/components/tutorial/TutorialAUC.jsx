import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Grid, Paper, Typography, Slider, TextField, InputAdornment } from '@mui/material';
import 'chart.js/auto';
import { Line } from 'react-chartjs-2';

// Lightweight one-compartment IV infusion model (educational)
function computeSeries({ dose_mg, interval_hours, infusion_minutes }) {
  const CL = 4.5;   // L/h (fixed tutorial default)
  const V = 60;     // L
  const ke = CL / V; // 1/h
  const tau = Math.max(6, Number(interval_hours) || 12);
  const Tinf = Math.max(0.25, (Number(infusion_minutes) || 60) / 60); // h
  const Dose = Math.max(0, Number(dose_mg) || 0);

  const T = 48; // hours
  const steps = 400; // ~400 points
  const dt = T / steps; // step size

  const times = [];
  const conc = [];

  const R0 = Tinf > 0 ? Dose / Tinf : 0; // mg/h

  function cFromDose(t, t0) {
    const x = t - t0;
    if (x < 0) return 0;
    if (x <= Tinf) {
      // During infusion: zero-order in, first-order out (simplified)
      // Concentration (mg/L) ≈ (R0/CL) * (1 - e^{-ke x})
      return (R0 / CL) * (1 - Math.exp(-ke * x)) / 1000 * 1000; // mg/L
    }
    const Cend = (R0 / CL) * (1 - Math.exp(-ke * Tinf));
    return Cend * Math.exp(-ke * (x - Tinf));
  }

  for (let t = 0; t <= T + 1e-9; t += dt) {
    times.push(+t.toFixed(3));
    let c = 0;
    const maxK = Math.ceil(T / tau) + 2;
    for (let k = 0; k <= maxK; k++) {
      const t0 = k * tau;
      if (t0 > T) break;
      c += cFromDose(t, t0);
    }
    conc.push(c);
  }

  // AUC 0-24h (trapezoid)
  let auc24 = 0;
  for (let i = 1; i < times.length; i++) {
    const a = times[i - 1], b = times[i];
    if (b <= 0) continue;
    if (a >= 24) break;
    const clampedA = Math.max(a, 0);
    const clampedB = Math.min(b, 24);
    const ya = conc[i - 1];
    const yb = conc[i];
    const h = clampedB - clampedA;
    if (h > 0) auc24 += 0.5 * (ya + yb) * h;
  }

  const idx24 = times.findIndex((x) => x > 24);
  const peak = Math.max(...conc.slice(0, idx24 > 0 ? idx24 : conc.length));
  const idxTau = Math.max(0, times.findIndex((x) => x >= tau) - 1);
  const trough = conc[idxTau] ?? conc[0] ?? 0;

  return { times, conc, auc24, peak, trough };
}

export default function TutorialAUC() {
  const [dose, setDose] = useState(1000);
  const [tau, setTau] = useState(12);
  const [tinf, setTinf] = useState(60);
  const [series, setSeries] = useState({ times: [], conc: [], auc24: 0, peak: 0, trough: 0 });
  const timer = useRef(null);

  const recalc = useCallback((d = dose, h = tau, m = tinf) => {
    const res = computeSeries({ dose_mg: d, interval_hours: h, infusion_minutes: m });
    setSeries(res);
  }, [dose, tau, tinf]);

  // initial compute
  useEffect(() => { recalc(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const debounced = useCallback((d, h, m) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // rAF to avoid jank while dragging
      requestAnimationFrame(() => recalc(d, h, m));
    }, 140);
  }, [recalc]);

  // Control UI shared styling
  const Control = ({ ariaLabel, caption, value, min, max, step, onChange, onCommit, unit }) => (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">{caption}</Typography>
      <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
        <Grid item xs={8} md={9}>
          <Slider
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(_, v) => { const val = Number(Array.isArray(v) ? v[0] : v); onChange(val); debounced(
              ariaLabel === 'Dose' ? val : dose,
              ariaLabel === 'Interval' ? val : tau,
              ariaLabel === 'Infusion' ? val : tinf
            ); }}
            onChangeCommitted={(_, v) => { const val = Number(Array.isArray(v) ? v[0] : v); onChange(val); onCommit(val); }}
            aria-label={ariaLabel}
          />
        </Grid>
        <Grid item xs="auto" md="auto">
          <TextField
            size="small"
            type="number"
            value={value}
            onChange={(e) => { const val = Number(e.target.value || 0); onChange(val); }}
            onBlur={(e) => { const val = Number(e.target.value || 0); onCommit(val); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { const val = Number(e.currentTarget.value || 0); onCommit(val); } }}
            InputProps={{
              endAdornment: <InputAdornment position="end">{unit}</InputAdornment>,
              inputProps: { min, max, step },
            }}
            sx={{
              width: { xs: '16ch', sm: '18ch' },
              '& .MuiOutlinedInput-input': {
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                paddingRight: '1ch',
              }
            }}
          />
        </Grid>
      </Grid>
    </Paper>
  );

  const chartData = useMemo(() => {
    const points = series.times.map((t, i) => ({ x: t, y: series.conc[i] }));
    return {
      datasets: [
        { label: 'AUC 0–24h', data: points.filter(p => p.x <= 24), borderColor: 'rgba(25,118,210,0)', backgroundColor: 'rgba(25,118,210,0.15)', pointRadius: 0, tension: 0.25, fill: true },
        { label: 'Concentration (mg/L)', data: points, borderColor: '#1976d2', backgroundColor: 'rgba(0,0,0,0)', pointRadius: 0, tension: 0.25, fill: false },
      ]
    };
  }, [series]);

  const ySuggestedMax = useMemo(() => {
    const mx = Math.max(30, Math.max(0, ...series.conc) * 1.15);
    return Number.isFinite(mx) ? mx : 40;
  }, [series.conc]);

  return (
    <Box id="tutorial-auc">
      <Typography variant="h6" sx={{ mb: 1 }}>PK/AUC Concepts</Typography>

      {/* Controls aligned with main calculator */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Control
            ariaLabel="Dose"
            caption="Dose (mg)"
            value={dose}
            min={250}
            max={4000}
            step={50}
            unit="mg"
            onChange={setDose}
            onCommit={(v) => { setDose(v); recalc(v, tau, tinf); }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Control
            ariaLabel="Interval"
            caption="Interval (hours)"
            value={tau}
            min={6}
            max={48}
            step={1}
            unit="h"
            onChange={setTau}
            onCommit={(v) => { setTau(v); recalc(dose, v, tinf); }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Control
            ariaLabel="Infusion"
            caption="Infusion (minutes)"
            value={tinf}
            min={15}
            max={180}
            step={5}
            unit="min"
            onChange={setTinf}
            onCommit={(v) => { setTinf(v); recalc(dose, tau, v); }}
          />
        </Grid>
      </Grid>

      {/* Chart */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ height: 320 }}>
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: { legend: { display: true } },
              scales: {
                x: { type: 'linear', title: { display: true, text: 'Hours' }, min: 0, max: 48, ticks: { maxTicksLimit: 12 } },
                y: { title: { display: true, text: 'Concentration (mg/L)' }, beginAtZero: true, suggestedMax: ySuggestedMax }
              }
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Paper variant="outlined" sx={{ px: 1.25, py: 0.5, borderRadius: 3, bgcolor: 'warning.light' }}>
            AUC24 ≈ {Math.round(series.auc24)} mg·h/L
          </Paper>
          <Paper variant="outlined" sx={{ px: 1.25, py: 0.5, borderRadius: 3 }}>
            Peak ≈ {Number(series.peak).toFixed(1)} mg/L
          </Paper>
          <Paper variant="outlined" sx={{ px: 1.25, py: 0.5, borderRadius: 3 }}>
            Trough ≈ {Number(series.trough).toFixed(1)} mg/L
          </Paper>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            AUC24/MIC target 400–600 when MIC=1 (2020 ASHP/IDSA). One-level Bayesian uses a single post-distribution sample (1–2 h after infusion end). Two-level first-order PK uses a post-distribution peak + trough ≤1 h pre-dose.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
