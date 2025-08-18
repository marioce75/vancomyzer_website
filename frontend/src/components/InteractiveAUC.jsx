import 'chart.js/auto';
import jsPDF from 'jspdf';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Box, Grid, Paper, Typography, Slider, TextField, FormControlLabel, Switch, Button, Chip, Alert, InputAdornment } from '@mui/material';
import GlobalStyles from '@mui/material/GlobalStyles';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, Tooltip, Filler, Legend, CategoryScale } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { calculateInteractiveAUC } from '../services/interactiveApi';
import { computeAll, buildMeasuredLevels } from '../services/pkVancomycin'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Filler, Legend);

function toFixed(val, digits = 1) {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val);
  return digits === 0 ? n.toFixed(0) : n.toFixed(digits);
}

function interp(xs, ys, x) {
  if (!xs?.length) return 0;
  let lo = 0, hi = xs.length - 1;
  if (x <= xs[lo]) return ys[lo];
  if (x >= xs[hi]) return ys[hi];
  while (hi - lo > 1) {
     const mid = (hi + lo) >> 1;
     if (xs[mid] < x) lo = mid; else hi = mid;
  }
  const x0 = xs[lo], x1 = xs[hi];
  const y0 = ys[lo], y1 = ys[hi];
  const f = (x - x0) / (x1 - x0);
  return y0 + f * (y1 - y0);
}

export default function InteractiveAUC() {
  // Minimal patient inputs to support Bayesian priors
  const [patient, setPatient] = useState({ age: 56, gender: 'male', weight_kg: 79, height_cm: 170, serum_creatinine_mg_dl: 1.0, mic_mg_L: 1.0, levels: [] });
  const [regimen, setRegimen] = useState({ dose_mg: 1000, interval_hours: 12, infusion_minutes: 60 });
  const [series, setSeries] = useState({ time_hours: [], concentration_mg_L: [] });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [posteriorN, setPosteriorN] = useState(null);
  const [showAucFill, setShowAucFill] = useState(true);
  const [showDoseMarkers, setShowDoseMarkers] = useState(true);

  // Measured levels UI
  const [levelMode, setLevelMode] = useState('none');
  const [levelInputs, setLevelInputs] = useState({ peak: { conc: '', after_end_h: '' }, trough: { conc: '' } });

  const chartRef = useRef(null);

  const measuredLevels = useMemo(() => buildMeasuredLevels(levelMode, {
    peak: levelInputs.peak?.conc && levelInputs.peak?.after_end_h ? { conc: Number(levelInputs.peak.conc), after_end_h: Number(levelInputs.peak.after_end_h) } : undefined,
    trough: levelInputs.trough?.conc ? { conc: Number(levelInputs.trough.conc) } : undefined,
  }, regimen), [levelMode, levelInputs, regimen]);

  const runInteractive = useCallback(async () => {
    setLoading(true); setError(null);
    const flatPatient = { ...patient, levels: measuredLevels };
    try {
      const data = await calculateInteractiveAUC(flatPatient, regimen);
      setSummary({
        auc_24: data?.metrics?.auc_24 ?? data.auc_24 ?? data.predicted_auc_24,
        predicted_peak: data?.metrics?.predicted_peak ?? data.predicted_peak,
        predicted_trough: data?.metrics?.predicted_trough ?? data.predicted_trough,
      });
      if (data?.series) {
        const s = data.series;
        setSeries({
          time_hours: s.time_hours,
          concentration_mg_L: s.concentration_mg_L || s.median,
          lower: s.lower || s.p05,
          upper: s.upper || s.p95,
        });
      }
      setPosteriorN(data?.posterior?.n_draws ?? null);
    } catch (e) {
      setError(e?.message || 'Request failed');
      const { series: syn, summary: sum } = computeAll(flatPatient, regimen);
      setSeries(syn); setSummary(sum);
    } finally {
      setLoading(false);
    }
  }, [patient, regimen, measuredLevels]);

  useEffect(() => {
    const t = setTimeout(() => { runInteractive(); }, 400); // debounce
    return () => clearTimeout(t);
  }, [runInteractive]);

  const labels = useMemo(() => (Array.isArray(series?.time_hours) ? series.time_hours : []), [series]);
  const conc = useMemo(() => (Array.isArray(series?.concentration_mg_L) ? series.concentration_mg_L : []), [series]);
  const points = useMemo(() => labels.map((t, i) => ({ x: t, y: conc[i] })), [labels, conc]);

  const levelMarkers = useMemo(() => {
    const tau = Number(regimen.interval_hours) || 12;
    return measuredLevels
      .filter((lv) => lv.time_hr >= 0 && lv.time_hr <= tau + 1e-9)
      .map((lv) => ({ x: lv.time_hr, y: Number(lv.concentration_mg_L), tag: lv.tag }));
  }, [measuredLevels, regimen.interval_hours]);

  const doseMarkersPlugin = useMemo(() => ({
    id: 'doseMarkers',
    afterDatasetsDraw: (chart) => {
      if (!showDoseMarkers) return;
      const { ctx, chartArea, scales } = chart;
      if (!scales.x || !scales.y) return;
      const xScale = scales.x;
      const maxX = Math.min(48, xScale.max);
      const interval = Number(regimen.interval_hours) || 12;
      for (let t = 0; t <= maxX + 1e-6; t += interval) {
        const x = xScale.getPixelForValue(t);
        ctx.save();
        ctx.strokeStyle = 'rgba(25, 118, 210, 0.6)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
      }
    }
  }), [regimen.interval_hours, showDoseMarkers]);

  // Residual connectors plugin
  const residualsPlugin = useMemo(() => ({
    id: 'residualConnectors',
    afterDatasetsDraw: (chart) => {
      if (!levelMarkers?.length || !labels?.length) return;
      const { ctx, scales } = chart;
      const xScale = scales.x; const yScale = scales.y;
      ctx.save();
      ctx.strokeStyle = 'rgba(220,0,78,0.6)';
      ctx.setLineDash([3, 3]);
      for (const m of levelMarkers) {
        const yPred = interp(labels, conc, m.x);
        const x = xScale.getPixelForValue(m.x);
        const yObs = yScale.getPixelForValue(m.y);
        const yMed = yScale.getPixelForValue(yPred);
        ctx.beginPath();
        ctx.moveTo(x, yObs);
        ctx.lineTo(x, yMed);
        ctx.stroke();
      }
      ctx.restore();
    }
  }), [levelMarkers, labels, conc]);

  const handleRegimenField = (field) => (value) => setRegimen((r) => ({ ...r, [field]: value }));

  const Control = ({ label, value, min, max, step, field, unit }) => {
    const digits = String(max ?? 4000).length;
    const ch = Math.max(4, digits) + 3; // extra for padding/adornment
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
          <Grid item xs={8} md={9}>
            <Slider value={value} min={min} max={max} step={step} onChange={(_, v) => handleRegimenField(field)(Number(v))} aria-label={label} />
          </Grid>
          <Grid item xs="auto" md="auto">
            <TextField
              className="numericInputDense"
              label={label}
              type="number"
              size="small"
              value={value}
              onChange={(e) => handleRegimenField(field)(Number(e.target.value))}
              InputProps={{
                endAdornment: unit ? <InputAdornment position="end">{unit}</InputAdornment> : undefined,
                inputProps: { min, max, step }
              }}
              sx={{
                width: `${ch}ch`,
                '& input': { fontVariantNumeric: 'tabular-nums', textAlign: 'right' }
              }}
            />
          </Grid>
        </Grid>
      </Paper>
    );
  };

  const copyJson = async () => {
    const payload = { patient, regimen, summary, series };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      alert('Copied JSON to clipboard');
    } catch {
      // Fallback: open in new window
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<pre>${JSON.stringify(payload, null, 2)}</pre>`);
        w.document.close();
      }
    }
  };

  const exportPdf = () => {
    try {
      const chart = chartRef.current;
      const img = chart?.toBase64Image ? chart.toBase64Image() : null;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(14);
      doc.text('Vancomycin Interactive AUC Report', 40, 40);
      const meta = `Dose: ${regimen.dose_mg} mg  |  Interval: q${regimen.interval_hours}h  |  Infusion: ${regimen.infusion_minutes} min\nAUC24: ${toFixed(summary?.auc_24,0)}  |  Peak: ${toFixed(summary?.predicted_peak,1)} mg/L  |  Trough: ${toFixed(summary?.predicted_trough,1)} mg/L`;
      doc.setFontSize(10);
      doc.text(meta, 40, 60);
      if (img) {
        const w = 760; const h = 360;
        doc.addImage(img, 'PNG', 40, 80, w, h, undefined, 'FAST');
      }
      doc.save('vancomycin_interactive_auc.pdf');
    } catch (e) {
      alert('PDF export failed');
    }
  };

  return (
    <Box>
      <GlobalStyles styles={{ '.numericInputDense .MuiInputBase-input': { width: '9ch', fontVariantNumeric: 'tabular-nums', textAlign: 'right' } }} />
      {/* Minimal patient form */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Patient</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label="Age (y)" type="number" value={patient.age} onChange={(e) => setPatient((p) => ({ ...p, age: Number(e.target.value) }))} /></Grid>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth select SelectProps={{ native: true }} label="Gender" value={patient.gender} onChange={(e) => setPatient((p) => ({ ...p, gender: e.target.value }))}><option value="male">Male</option><option value="female">Female</option></TextField></Grid>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label="Weight (kg)" type="number" value={patient.weight_kg} onChange={(e) => setPatient((p) => ({ ...p, weight_kg: Number(e.target.value) }))} /></Grid>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label="Height (cm)" type="number" value={patient.height_cm} onChange={(e) => setPatient((p) => ({ ...p, height_cm: Number(e.target.value) }))} /></Grid>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label="SCr (mg/dL)" type="number" value={patient.serum_creatinine_mg_dl} onChange={(e) => setPatient((p) => ({ ...p, serum_creatinine_mg_dl: Number(e.target.value) }))} /></Grid>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label="MIC (mg/L)" type="number" value={patient.mic_mg_L} onChange={(e) => setPatient((p) => ({ ...p, mic_mg_L: Number(e.target.value) }))} /></Grid>
        </Grid>
      </Paper>

      {/* Metrics strip */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">AUC24</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip label={`${toFixed(summary?.auc_24, 0)} mg·h/L`} color={summary?.auc_24 >= 400 && summary?.auc_24 <= 600 ? 'success' : 'warning'} variant={summary?.auc_24 >= 400 && summary?.auc_24 <= 600 ? 'filled' : 'outlined'} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Predicted trough</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip label={`${toFixed(summary?.predicted_trough, 1)} mg/L`} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Predicted peak</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip label={`${toFixed(summary?.predicted_peak, 1)} mg/L`} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Regimen controls */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}><Control label="Dose" value={regimen.dose_mg} min={250} max={3000} step={50} field="dose_mg" unit="mg" /></Grid>
        <Grid item xs={12} md={4}><Control label="Interval (hours)" value={regimen.interval_hours} min={6} max={48} step={1} field="interval_hours" unit="h" /></Grid>
        <Grid item xs={12} md={4}><Control label="Infusion (minutes)" value={regimen.infusion_minutes} min={15} max={240} step={5} field="infusion_minutes" unit="min" /></Grid>
      </Grid>

      {/* Toggles & badge */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <FormControlLabel control={<Switch checked={showAucFill} onChange={(e) => setShowAucFill(e.target.checked)} />} label="Shade 0–24h AUC" />
        <FormControlLabel control={<Switch checked={showDoseMarkers} onChange={(e) => setShowDoseMarkers(e.target.checked)} />} label="Show dose markers" />
        {posteriorN ? (<Chip size="small" color="primary" variant="outlined" label={`Bayesian (n=${posteriorN})`} />) : null}
        {loading && <Typography color="text.secondary">Updating…</Typography>}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" variant="outlined" onClick={copyJson}>Copy JSON</Button>
        <Button size="small" variant="contained" onClick={exportPdf}>Export PDF</Button>
      </Box>

      {/* Levels panel */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2">Measured Levels</Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={4}>
            <TextField select SelectProps={{ native: true }} fullWidth size="small" label="Mode" value={levelMode} onChange={(e) => setLevelMode(e.target.value)}>
              <option value="none">No levels</option>
              <option value="one">One level (Bayesian)</option>
              <option value="two">Two levels (peak + trough)</option>
            </TextField>
          </Grid>
          {(levelMode === 'one' || levelMode === 'two') && (
            <>
              <Grid item xs={12} md={3}><TextField size="small" type="number" label="Peak/random (mg/L)" fullWidth value={levelInputs.peak.conc} onChange={(e) => setLevelInputs((s) => ({ ...s, peak: { ...s.peak, conc: e.target.value } }))} /></Grid>
              <Grid item xs={12} md={3}><TextField size="small" type="number" label="Hours after infusion end" fullWidth value={levelInputs.peak.after_end_h} onChange={(e) => setLevelInputs((s) => ({ ...s, peak: { ...s.peak, after_end_h: e.target.value } }))} /></Grid>
            </>
          )}
          {levelMode === 'two' && (
            <>
              <Grid item xs={12} md={3}><TextField size="small" type="number" label="Trough (mg/L)" fullWidth value={levelInputs.trough.conc} onChange={(e) => setLevelInputs((s) => ({ ...s, trough: { ...s.trough, conc: e.target.value } }))} /></Grid>
              <Grid item xs={12} md={3}><TextField size="small" disabled label="Trough time (≈ τ)" fullWidth value={regimen.interval_hours} /></Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Chart */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error} <Button size="small" onClick={() => runInteractive()}>Retry</Button></Alert>
        )}
        <Box sx={{ height: 360 }}>
          <Line ref={chartRef} data={{ datasets: [
            { label: 'AUC 0–24h', data: points.filter((p) => p.x <= 24), borderColor: 'rgba(25,118,210,0)', backgroundColor: showAucFill ? 'rgba(25,118,210,0.15)' : 'rgba(25,118,210,0.0)', pointRadius: 0, tension: 0.25, fill: showAucFill },
            ...(Array.isArray(series?.lower) && Array.isArray(series?.upper) && series.lower?.length === points.length && series.upper?.length === points.length
              ? [
                  { label: '90% CI (lower)', data: labels.map((t, i) => ({ x: t, y: series.lower[i] })), borderColor: 'rgba(0,0,0,0)', backgroundColor: 'rgba(25,118,210,0.10)', pointRadius: 0, fill: '+1' },
                  { label: '90% CI (upper)', data: labels.map((t, i) => ({ x: t, y: series.upper[i] })), borderColor: 'rgba(0,0,0,0)', backgroundColor: 'rgba(25,118,210,0.10)', pointRadius: 0, fill: false },
                ]
              : []),
            { label: 'Concentration (mg/L)', data: points, borderColor: '#1976d2', backgroundColor: 'rgba(0,0,0,0)', pointRadius: 0, tension: 0.25, fill: false },
            { label: 'Measured level(s)', data: levelMarkers.map((m) => ({ x: m.x, y: m.y })), borderColor: 'rgba(220, 0, 78, 0.8)', backgroundColor: 'rgba(220, 0, 78, 0.8)', pointRadius: 4, showLine: false },
          ]}} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true }, tooltip: { callbacks: { label: (ctx) => (ctx.dataset.label === 'Measured level(s)') ? `Level ${toFixed(ctx.parsed.y, 2)} mg/L @ ${toFixed(ctx.parsed.x, 2)} h` : `${toFixed(ctx.parsed.y, 2)} mg/L @ ${toFixed(ctx.parsed.x, 1)} h` } } }, scales: { x: { type: 'linear', title: { display: true, text: 'Hours' }, ticks: { maxTicksLimit: 12 }, min: 0, max: 48 }, y: { title: { display: true, text: 'Concentration (mg/L)' }, beginAtZero: true } } }} plugins={[doseMarkersPlugin, residualsPlugin]} />
        </Box>
      </Paper>
    </Box>
  );
}
