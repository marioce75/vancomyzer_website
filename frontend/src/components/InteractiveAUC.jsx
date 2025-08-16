import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Slider,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  Chip,
  Divider,
  Alert
} from '@mui/material';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Filler,
  Legend,
  CategoryScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { calculateInteractive } from '../services/interactiveApi';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Filler, Legend);

function toFixed(val, digits = 1) {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val);
  return digits === 0 ? n.toFixed(0) : n.toFixed(digits);
}

// Simple one-compartment with infusion synthesis using peak/trough
function synthesizeFromSummary(summary, regimen, totalHours = 48, dt = 0.1) {
  try {
    const peak = Number(summary?.predicted_peak);
    const trough = Number(summary?.predicted_trough);
    const tau = Number(regimen?.interval_hours);
    const tinf = Number(regimen?.infusion_minutes) / 60;
    if (!isFinite(peak) || !isFinite(trough) || peak <= 0 || trough <= 0) return { time_hours: [], concentration_mg_L: [] };
    if (!isFinite(tau) || !isFinite(tinf) || tau <= 0 || tinf <= 0 || tau <= tinf) return { time_hours: [], concentration_mg_L: [] };

    const k = -Math.log(trough / peak) / (tau - tinf);
    if (!isFinite(k) || k <= 0) return { time_hours: [], concentration_mg_L: [] };

    // Build one cycle [0, tau]
    const cycleTimes = [];
    const cycleConc = [];
    for (let t = 0; t <= tau + 1e-9; t = Number((t + dt).toFixed(10))) {
      let c;
      if (t <= tinf) {
        // Steady-state during infusion
        const term1 = (1 - Math.exp(-k * tau)) / (1 - Math.exp(-k * tinf)) * (1 - Math.exp(-k * t));
        const term2 = Math.exp(-k * (t + tau - tinf));
        c = peak * term1 + peak * term2;
      } else {
        // Post-infusion elimination until next dose
        c = peak * Math.exp(-k * (t - tinf));
      }
      cycleTimes.push(t);
      cycleConc.push(c);
    }

    // Tile cycles across totalHours
    const time_hours = [];
    const concentration_mg_L = [];
    for (let start = 0; start <= totalHours + 1e-9; start += tau) {
      for (let i = 0; i < cycleTimes.length; i++) {
        const tAbs = start + cycleTimes[i];
        if (tAbs > totalHours + 1e-9) break;
        time_hours.push(Number(tAbs.toFixed(5)));
        concentration_mg_L.push(cycleConc[i]);
      }
    }

    return { time_hours, concentration_mg_L };
  } catch {
    return { time_hours: [], concentration_mg_L: [] };
  }
}

function EmptyState({ onGoPatient }) {
  return (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        No patient in context. Please enter patient first.
      </Typography>
      <Button variant="contained" onClick={onGoPatient}>Go to Patient Input</Button>
    </Box>
  );
}

const SS_PREFIX = 'interactiveAUC';
const ssKey = (patient) => {
  const pop = patient?.population_type || 'default';
  return {
    regimen: `${SS_PREFIX}:regimen:${pop}`,
    series: `${SS_PREFIX}:series:${pop}`,
    summary: `${SS_PREFIX}:summary:${pop}`,
    toggles: `${SS_PREFIX}:toggles:${pop}`,
  };
};

export default function InteractiveAUC({ patient, initialRegimen, onGoPatient }) {
  const keys = useMemo(() => ssKey(patient), [patient]);
  const loadFromSS = (key, fallback) => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  };

  const [regimen, setRegimen] = useState(() => {
    const fromSS = loadFromSS(keys.regimen, null);
    return fromSS || initialRegimen || { dose_mg: 1000, interval_hours: 12, infusion_minutes: 60 };
  });
  const [series, setSeries] = useState(() => loadFromSS(keys.series, { time_hours: [], concentration_mg_L: [] }));
  const [summary, setSummary] = useState(() => loadFromSS(keys.summary, null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showAucFill, setShowAucFill] = useState(() => {
    const fromSS = loadFromSS(keys.toggles, null);
    return fromSS?.showAucFill ?? true;
  });
  const [showDoseMarkers, setShowDoseMarkers] = useState(() => {
    const fromSS = loadFromSS(keys.toggles, null);
    return fromSS?.showDoseMarkers ?? true;
  });

  // Persist to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(keys.regimen, JSON.stringify(regimen));
  }, [keys.regimen, regimen]);
  useEffect(() => {
    sessionStorage.setItem(keys.series, JSON.stringify(series));
  }, [keys.series, series]);
  useEffect(() => {
    sessionStorage.setItem(keys.summary, JSON.stringify(summary));
  }, [keys.summary, summary]);
  useEffect(() => {
    sessionStorage.setItem(keys.toggles, JSON.stringify({ showAucFill, showDoseMarkers }));
  }, [keys.toggles, showAucFill, showDoseMarkers]);

  // Update local regimen when initialRegimen prop changes (e.g., from DosingResults CTA)
  useEffect(() => {
    if (initialRegimen &&
        (initialRegimen.dose_mg !== regimen.dose_mg ||
         initialRegimen.interval_hours !== regimen.interval_hours ||
         initialRegimen.infusion_minutes !== regimen.infusion_minutes)) {
      setRegimen(initialRegimen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRegimen?.dose_mg, initialRegimen?.interval_hours, initialRegimen?.infusion_minutes]);

  // Debounced fetch on regimen change
  useEffect(() => {
    if (!patient) return;
    const t = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const data = await calculateInteractive(patient, regimen);
        setSummary({
          auc_24: data.auc_24 ?? data.predicted_auc_24,
          predicted_peak: data.predicted_peak,
          predicted_trough: data.predicted_trough,
        });
        if (Array.isArray(data.time_hours) && Array.isArray(data.concentration_mg_L)) {
          setSeries({ time_hours: data.time_hours, concentration_mg_L: data.concentration_mg_L });
        } else {
          // synthesize from summary (fallback)
          const syn = synthesizeFromSummary({
            predicted_peak: data.predicted_peak,
            predicted_trough: data.predicted_trough,
          }, regimen, 48, 0.1);
          setSeries(syn);
        }
      } catch (e) {
        console.error(e);
        setError('Interactive AUC request failed.');
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [patient, regimen]);

  // Derived chart arrays and points
  const labels = useMemo(() => (Array.isArray(series?.time_hours) ? series.time_hours : []), [series]);
  const conc = useMemo(() => (Array.isArray(series?.concentration_mg_L) ? series.concentration_mg_L : []), [series]);
  const points = useMemo(() => labels.map((t, i) => ({ x: t, y: conc[i] })), [labels, conc]);

  // Plugins and chart options
  const doseMarkersPlugin = useMemo(() => ({
    id: 'doseMarkers',
    afterDatasetsDraw: (chart) => {
      if (!showDoseMarkers) return;
      const { ctx, chartArea, scales } = chart;
      if (!scales.x || !scales.y) return;
      const xScale = scales.x;
      const maxX = Math.min(24, xScale.max);
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

  const chartData = useMemo(() => ({
    datasets: [
      {
        label: 'Concentration (mg/L)',
        data: points,
        borderColor: '#1976d2',
        backgroundColor: showAucFill ? 'rgba(25, 118, 210, 0.15)' : 'rgba(25, 118, 210, 0.0)',
        pointRadius: 0,
        tension: 0.25,
        fill: showAucFill,
      },
    ],
  }), [points, showAucFill]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${toFixed(ctx.parsed.y, 2)} mg/L @ ${toFixed(ctx.parsed.x, 1)} h` } },
      title: { display: false },
    },
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: 'Hours' },
        ticks: { maxTicksLimit: 12 },
      },
      y: {
        title: { display: true, text: 'Concentration (mg/L)' },
        beginAtZero: true,
      },
    },
  }), []);

  const isAucTarget = (auc) => auc !== null && auc !== undefined && auc >= 400 && auc <= 600;
  const isTroughTarget = (tr) => tr !== null && tr !== undefined && tr >= 10 && tr <= 20;

  // Controls helpers
  const handleRegimenField = (field) => (value) => setRegimen((r) => ({ ...r, [field]: value }));

  const Control = ({ label, value, min, max, step, field, unit }) => (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
        <Grid item xs={8} md={9}>
          <Slider
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(_, v) => handleRegimenField(field)(Number(v))}
            aria-label={label}
          />
        </Grid>
        <Grid item xs={4} md={3}>
          <TextField
            size="small"
            fullWidth
            type="number"
            inputProps={{ min, max, step }}
            value={value}
            onChange={(e) => handleRegimenField(field)(Number(e.target.value))}
            label={unit}
          />
        </Grid>
      </Grid>
    </Paper>
  );

  return (
    <Box>
      {!patient ? (
        <EmptyState onGoPatient={onGoPatient} />
      ) : (
        <>
          {/* Metrics Strip */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">AUC24</Typography>
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={`${toFixed(summary?.auc_24, 0)} mg·h/L`}
                    color={isAucTarget(summary?.auc_24) ? 'success' : 'warning'}
                    variant={isAucTarget(summary?.auc_24) ? 'filled' : 'outlined'}
                  />
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Predicted trough</Typography>
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={`${toFixed(summary?.predicted_trough, 1)} mg/L`}
                    color={isTroughTarget(summary?.predicted_trough) ? 'success' : 'warning'}
                    variant={isTroughTarget(summary?.predicted_trough) ? 'filled' : 'outlined'}
                  />
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

          {/* Controls */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Control
                label="Dose (mg)"
                value={regimen.dose_mg}
                min={250}
                max={3000}
                step={50}
                field="dose_mg"
                unit="mg"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Control
                label="Interval (hours)"
                value={regimen.interval_hours}
                min={6}
                max={48}
                step={1}
                field="interval_hours"
                unit="h"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Control
                label="Infusion (minutes)"
                value={regimen.infusion_minutes}
                min={15}
                max={240}
                step={5}
                field="infusion_minutes"
                unit="min"
              />
            </Grid>
          </Grid>

          {/* Toggles */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <FormControlLabel control={<Switch checked={showAucFill} onChange={(e) => setShowAucFill(e.target.checked)} />} label="Shade 0–24h AUC" />
            <FormControlLabel control={<Switch checked={showDoseMarkers} onChange={(e) => setShowDoseMarkers(e.target.checked)} />} label="Show dose markers" />
            {loading && <Typography color="text.secondary">Updating…</Typography>}
          </Box>

          {/* Chart */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}
            <Box sx={{ height: 360 }}>
              <Line
                data={chartData}
                options={options}
                plugins={[doseMarkersPlugin]}
                aria-label="Vancomycin concentration-time plot"
                role="img"
              />
            </Box>
          </Paper>

          {/* Data Table */}
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Simulated points</Typography>
            <Divider sx={{ mb: 1 }} />
            {Array.isArray(labels) && labels.length > 0 ? (
              <Grid container spacing={1}>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Time (h)</Typography></Grid>
                <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Conc (mg/L)</Typography></Grid>
                {/* ...existing code... */}
                {labels.slice(0, 50).map((t, idx) => (
                  <React.Fragment key={idx}>
                    <Grid item xs={6} md={3}>{toFixed(t, 2)}</Grid>
                    <Grid item xs={6} md={3}>{toFixed(conc[idx], 2)}</Grid>
                  </React.Fragment>
                ))}
              </Grid>
            ) : (
              <Typography color="text.secondary">No time–concentration curve available yet.</Typography>
            )}
          </Paper>

          {/* Raw JSON (collapsible) */}
          <details style={{ marginTop: 16 }}>
            <summary>Show raw JSON</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ regimen, summary, series }, null, 2)}</pre>
          </details>
        </>
      )}
    </Box>
  );
}
