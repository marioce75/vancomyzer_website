import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  Alert,
  Drawer
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
import { calculateInteractiveAUC } from '../services/interactiveApi';
import { computeAll, buildMeasuredLevels } from '../services/pkVancomycin'

// Dev-only comparator
const CompareSpreadsheet = process.env.NODE_ENV !== 'production' ? require('../dev/CompareSpreadsheet').default : () => null;

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Filler, Legend);

function toFixed(val, digits = 1) {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val);
  return digits === 0 ? n.toFixed(0) : n.toFixed(digits);
}

// Removed legacy synthesizeFromSummary/synthesizeClientCurve/trapezoidalAUC helpers (now using pkVancomycin engine)

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
    levelsMode: `${SS_PREFIX}:levelsMode:${pop}`,
    levelsInputs: `${SS_PREFIX}:levelsInputs:${pop}`,
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
  const [fallbackWarn, setFallbackWarn] = useState(false);
  const [serverBacked, setServerBacked] = useState(false);
  const [posteriorN, setPosteriorN] = useState(null);

  const [showAucFill, setShowAucFill] = useState(() => {
    const fromSS = loadFromSS(keys.toggles, null);
    return fromSS?.showAucFill ?? true;
  });
  const [showDoseMarkers, setShowDoseMarkers] = useState(() => {
    const fromSS = loadFromSS(keys.toggles, null);
    return fromSS?.showDoseMarkers ?? true;
  });

  // Measured levels UI state (persisted)
  const [levelMode, setLevelMode] = useState(() => loadFromSS(keys.levelsMode, 'none'));
  const [levelInputs, setLevelInputs] = useState(() => loadFromSS(keys.levelsInputs, { peak: { conc: '', after_end_h: '' }, trough: { conc: '', after_end_h: '' } }));

  // Persist to sessionStorage
  useEffect(() => { sessionStorage.setItem(keys.regimen, JSON.stringify(regimen)); }, [keys.regimen, regimen]);
  useEffect(() => { sessionStorage.setItem(keys.series, JSON.stringify(series)); }, [keys.series, series]);
  useEffect(() => { sessionStorage.setItem(keys.summary, JSON.stringify(summary)); }, [keys.summary, summary]);
  useEffect(() => { sessionStorage.setItem(keys.toggles, JSON.stringify({ showAucFill, showDoseMarkers })); }, [keys.toggles, showAucFill, showDoseMarkers]);
  useEffect(() => { sessionStorage.setItem(keys.levelsMode, JSON.stringify(levelMode)); }, [keys.levelsMode, levelMode]);
  useEffect(() => { sessionStorage.setItem(keys.levelsInputs, JSON.stringify(levelInputs)); }, [keys.levelsInputs, levelInputs]);

  // Update local regimen when initialRegimen prop changes
  useEffect(() => {
    if (initialRegimen &&
        (initialRegimen.dose_mg !== regimen.dose_mg ||
         initialRegimen.interval_hours !== regimen.interval_hours ||
         initialRegimen.infusion_minutes !== regimen.infusion_minutes)) {
      setRegimen(initialRegimen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRegimen?.dose_mg, initialRegimen?.interval_hours, initialRegimen?.infusion_minutes]);

  // Preload incoming levels from Dosing Results (one-shot)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('interactiveAUC:incomingLevels');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.mode) setLevelMode(parsed.mode);
        if (parsed?.inputs) setLevelInputs(parsed.inputs);
        sessionStorage.removeItem('interactiveAUC:incomingLevels');
      }
    } catch {}
  }, []);

  // Preload incoming regimen from Dosing Results (one-shot)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('interactiveAUC:incomingRegimen');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setRegimen((r) => ({ ...r, ...parsed }));
        sessionStorage.removeItem('interactiveAUC:incomingRegimen');
      }
    } catch {}
  }, []);

  const measuredLevels = useMemo(() => buildMeasuredLevels(levelMode, {
    peak: levelInputs.peak?.conc && levelInputs.peak?.after_end_h ? { conc: Number(levelInputs.peak.conc), after_end_h: Number(levelInputs.peak.after_end_h) } : undefined,
    trough: levelInputs.trough?.conc ? { conc: Number(levelInputs.trough.conc) } : undefined,
  }, regimen), [levelMode, levelInputs, regimen]);

  const runInteractive = useCallback(async () => {
    if (!patient) return;
    setLoading(true); setError(null); setFallbackWarn(false); setServerBacked(false);
    const flatPatient = { ...patient, levels: measuredLevels };
    try {
      const data = await calculateInteractiveAUC(flatPatient, regimen);
      setSummary({
        auc_24: data.auc_24 ?? data.predicted_auc_24,
        predicted_peak: data.predicted_peak,
        predicted_trough: data.predicted_trough,
      });
      // Prefer server series shape
      if (data?.series && Array.isArray(data.series.time_hours)) {
        setSeries({
          time_hours: data.series.time_hours,
          concentration_mg_L: data.series.concentration_mg_L,
          lower: data.series.lower,
          upper: data.series.upper,
        });
        setServerBacked(true);
      } else if (Array.isArray(data.time_hours) && Array.isArray(data.concentration_mg_L)) {
        setSeries({ time_hours: data.time_hours, concentration_mg_L: data.concentration_mg_L });
        setServerBacked(true);
      } else {
        const { series: syn } = computeAll(flatPatient, regimen);
        setSeries(syn);
        setServerBacked(false);
      }
      setPosteriorN(data?.posterior?.n_draws ?? null);
    } catch (e) {
      if (e?.message === 'INTERACTIVE_ENDPOINT_UNAVAILABLE') {
        const { series: syn, summary: sum } = computeAll(flatPatient, regimen);
        setSeries(syn);
        setSummary((prev) => ({ ...(prev || {}), auc_24: sum.auc_24, predicted_peak: sum.predicted_peak, predicted_trough: sum.predicted_trough }));
        setFallbackWarn(true);
        setServerBacked(false);
        setError(null);
      } else {
        const detail = e?.cause?.message || e?.message || 'Request failed';
        setError(`Interactive error: ${detail}`);
      }
    } finally {
      setLoading(false);
    }
  }, [patient, regimen, measuredLevels]);

  // Debounced fetch on regimen or levels change
  useEffect(() => {
    if (!patient) return undefined;
    const t = setTimeout(() => { runInteractive(); }, 400);
    return () => clearTimeout(t);
  }, [patient, regimen, measuredLevels, runInteractive]);

  // Derived chart arrays and points
  const labels = useMemo(() => (Array.isArray(series?.time_hours) ? series.time_hours : []), [series]);
  const conc = useMemo(() => (Array.isArray(series?.concentration_mg_L) ? series.concentration_mg_L : []), [series]);
  const points = useMemo(() => labels.map((t, i) => ({ x: t, y: conc[i] })), [labels, conc]);

  // Only render markers within first interval to avoid repetition; use measured concentrations
  const levelMarkers = useMemo(() => {
    const tau = Number(regimen.interval_hours) || 12;
    return measuredLevels
      .filter((lv) => lv.time_hr >= 0 && lv.time_hr <= tau + 1e-9)
      .map((lv) => ({ x: lv.time_hr, y: Number(lv.concentration_mg_L), tag: lv.tag }));
  }, [measuredLevels, regimen.interval_hours]);

  // Dose markers plugin
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

  const isAucTarget = (auc) => auc !== null && auc !== undefined && auc >= 400 && auc <= 600;
  const isTroughTarget = (tr) => tr !== null && tr !== undefined && tr >= 10 && tr <= 20;

  const chartData = useMemo(() => ({
    datasets: [
      {
        label: 'AUC 0–24h',
        data: points.filter((p) => p.x <= 24),
        borderColor: 'rgba(25, 118, 210, 0)',
        backgroundColor: showAucFill ? 'rgba(25, 118, 210, 0.15)' : 'rgba(25, 118, 210, 0.0)',
        pointRadius: 0,
        tension: 0.25,
        fill: showAucFill,
      },
      // CI band (90%) when provided by server
      ...(Array.isArray(series?.lower) && Array.isArray(series?.upper) && series.lower.length === points.length && series.upper.length === points.length
        ? [
            {
              label: '90% CI (lower)',
              data: labels.map((t, i) => ({ x: t, y: series.lower[i] })),
              borderColor: 'rgba(25,118,210,0)',
              backgroundColor: 'rgba(25,118,210,0.10)',
              pointRadius: 0,
              fill: '+1',
            },
            {
              label: '90% CI (upper)',
              data: labels.map((t, i) => ({ x: t, y: series.upper[i] })),
              borderColor: 'rgba(25,118,210,0)',
              backgroundColor: 'rgba(25,118,210,0.10)',
              pointRadius: 0,
              fill: false,
            },
          ]
        : []),
      {
        label: 'Concentration (mg/L)',
        data: points,
        borderColor: '#1976d2',
        backgroundColor: 'rgba(0,0,0,0)',
        pointRadius: 0,
        tension: 0.25,
        fill: false,
      },
      {
        label: 'Dose times',
        data: [],
        borderColor: 'rgba(25,118,210,0.6)',
        borderDash: [6, 6],
        pointRadius: 0,
      },
      {
        label: 'Measured level(s)',
        data: levelMarkers.map((m) => ({ x: m.x, y: m.y })),
        borderColor: 'rgba(220, 0, 78, 0.8)',
        backgroundColor: 'rgba(220, 0, 78, 0.8)',
        pointRadius: 4,
        showLine: false,
      },
    ],
  }), [points, levelMarkers, showAucFill, series?.lower, series?.upper, labels]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.dataset.label === 'Measured level(s)') return `Level ${toFixed(ctx.parsed.y, 2)} mg/L @ ${toFixed(ctx.parsed.x, 2)} h`;
            return `${toFixed(ctx.parsed.y, 2)} mg/L @ ${toFixed(ctx.parsed.x, 1)} h`;
          }
        }
      },
      title: { display: false },
    },
    scales: {
      x: { type: 'linear', title: { display: true, text: 'Hours' }, ticks: { maxTicksLimit: 12 }, min: 0, max: 48 },
      y: { title: { display: true, text: 'Concentration (mg/L)' }, beginAtZero: true },
    },
  }), []);

  // Controls helpers and components
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
            // Make dose input wide enough for 4 digits per spec
            {...(field === 'dose_mg' ? { InputProps: { inputProps: { step: 50, min: 100, max: 6000, style: { width: 96, textAlign: 'right' } } } } : {})}
            value={value}
            onChange={(e) => handleRegimenField(field)(Number(e.target.value))}
            label={unit}
          />
        </Grid>
      </Grid>
    </Paper>
  );

  // Levels Panel component
  const LevelsPanel = () => (
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
        {levelMode !== 'none' && (
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Timing helper: time_hr = infusion_minutes/60 + after_end_hours
            </Typography>
          </Grid>
        )}
        {(levelMode === 'one' || levelMode === 'two') && (
          <>
            <Grid item xs={12} md={3}>
              <TextField size="small" type="number" label="Peak/random (mg/L)" fullWidth value={levelInputs.peak.conc}
                onChange={(e) => setLevelInputs((s) => ({ ...s, peak: { ...s.peak, conc: e.target.value } }))} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField size="small" type="number" label="Hours after infusion end" fullWidth value={levelInputs.peak.after_end_h}
                onChange={(e) => setLevelInputs((s) => ({ ...s, peak: { ...s.peak, after_end_h: e.target.value } }))} />
            </Grid>
          </>
        )}
        {levelMode === 'two' && (
          <>
            <Grid item xs={12} md={3}>
              <TextField size="small" type="number" label="Trough (mg/L)" fullWidth value={levelInputs.trough.conc}
                onChange={(e) => setLevelInputs((s) => ({ ...s, trough: { ...s.trough, conc: e.target.value } }))} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField size="small" disabled label="Trough time (≈ τ)" fullWidth value={regimen.interval_hours} />
            </Grid>
          </>
        )}
      </Grid>
    </Paper>
  );

  // Dev drawer
  const [devOpen, setDevOpen] = useState(false);

  return (
    <Box>
      {!patient ? (
        <EmptyState onGoPatient={onGoPatient} />
      ) : (
        <>
          {fallbackWarn && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Interactive server endpoint not available; showing simulated curve locally.
            </Alert>
          )}

          {/* Metrics strip */}
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
            {posteriorN ? (
              <Chip size="small" color="primary" variant="outlined" label={`Bayesian (n=${posteriorN})`} />
            ) : null}
            {process.env.NODE_ENV !== 'production' && (
              <Button size="small" variant="outlined" onClick={() => setDevOpen(true)}>Compare with Spreadsheet</Button>
            )}
            {loading && <Typography color="text.secondary">Updating…</Typography>}
          </Box>

          {/* Measured Levels Panel */}
          <LevelsPanel />

          {/* Chart */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
                <Box component="span" sx={{ ml: 1 }}>
                  <Button size="small" onClick={() => runInteractive()}>Retry</Button>
                </Box>
              </Alert>
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
          {serverBacked ? null : (
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Simulated points</Typography>
              <Divider sx={{ mb: 1 }} />
              {Array.isArray(labels) && labels.length > 0 ? (
                <Grid container spacing={1}>
                  <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Time (h)</Typography></Grid>
                  <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Conc (mg/L)</Typography></Grid>
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
          )}

          {/* Raw JSON (collapsible) */}
          <details style={{ marginTop: 16 }}>
            <summary>Show raw JSON</summary>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ regimen, summary, series }, null, 2)}</pre>
          </details>

          {/* Dev Drawer */}
          <Drawer anchor="right" open={devOpen} onClose={() => setDevOpen(false)}>
            <Box sx={{ width: 360, p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Compare with Spreadsheet</Typography>
              {process.env.NODE_ENV !== 'production' ? <CompareSpreadsheet computeAll={computeAll} /> : <Typography>Unavailable in production</Typography>}
            </Box>
          </Drawer>
        </>
      )}
    </Box>
  );
}
