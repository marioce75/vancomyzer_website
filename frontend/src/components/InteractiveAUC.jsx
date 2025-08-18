import 'chart.js/auto';
import jsPDF from 'jspdf';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Box, Grid, Paper, Typography, Slider, TextField, FormControlLabel, Switch, Button, Chip, Alert, InputAdornment, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, Tooltip as ChartTooltip, Filler, Legend, CategoryScale } from 'chart.js';
import { Line } from 'react-chartjs-2';
import * as interactiveApi from '../services/interactiveApi';
import { computeAll, buildMeasuredLevels } from '../services/pkVancomycin'
import HelpTooltip from './common/HelpTooltip';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title, ChartTooltip, Filler, Legend);

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

// Help mapping
const help = {
  dose:      { key: 'help.dose',      link: '/guideline/pk-basics-auc' },
  interval:  { key: 'help.interval',  link: '/guideline/sampling-timing' },
  infusion:  { key: 'help.infusion',  link: '/guideline/infusion-principles' },
  mic:       { key: 'help.mic',       link: '/guideline/auc-targets' },
  auc24:     { key: 'help.auc24',     link: '/guideline/auc-targets' },
  peak:      { key: 'help.peak',      link: '/guideline/pk-basics-auc' },
  trough:    { key: 'help.trough',    link: '/guideline/nephrotoxicity' },
  scr:       { key: 'help.scr',       link: '/guideline/sampling-timing' },
  weight:    { key: 'help.weight',    link: '/guideline/special-populations' },
  height:    { key: 'help.height',    link: '/guideline/special-populations' },
  levels:    { key: 'help.levels',    link: '/guideline/sampling-timing' },
};

export default function InteractiveAUC({ mode = 'adult', onOpenGuidelines }) {
  const { t, i18n } = useTranslation();
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try { return localStorage.getItem('interactive_disclaimer_dismissed') !== '1'; } catch { return true; }
  });
  // Minimal patient inputs to support Bayesian priors
  const [patient, setPatient] = useState({ age: 56, gender: 'male', weight_kg: 79, height_cm: 170, serum_creatinine_mg_dl: 1.0, mic_mg_L: 1.0, levels: [] });
  const [regimen, setRegimen] = useState({ dose_mg: 1000, interval_hours: 12, infusion_minutes: 60 });
  const [draftRegimen, setDraftRegimen] = useState({ dose_mg: 1000, interval_hours: 12, infusion_minutes: 60 });
  const [series, setSeries] = useState({ time_hours: [], concentration_mg_L: [] });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [posteriorN, setPosteriorN] = useState(null);
  const [showAucFill, setShowAucFill] = useState(true);
  const [showDoseMarkers, setShowDoseMarkers] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(true);

  // Measured levels UI
  const [levelMode, setLevelMode] = useState('none');
  const [levelInputs, setLevelInputs] = useState({ peak: { conc: '', after_end_h: '' }, trough: { conc: '' } });
  // Keep draftRegimen in sync with regimen when regimen changes externally
  useEffect(() => { setDraftRegimen(regimen); }, [regimen]);

  const chartRef = useRef(null);
  const apiAbort = useRef(null);

  const measuredLevels = useMemo(() => buildMeasuredLevels(levelMode, {
    peak: levelInputs.peak?.conc && levelInputs.peak?.after_end_h ? { conc: Number(levelInputs.peak.conc), after_end_h: Number(levelInputs.peak.after_end_h) } : undefined,
    trough: levelInputs.trough?.conc ? { conc: Number(levelInputs.trough.conc) } : undefined,
  }, regimen), [levelMode, levelInputs, regimen]);

  // Debounced per-field commit helper
  const timersRef = useRef({});
  const scheduleCommit = useCallback((field, val, delayMs = 150) => {
    setDraftRegimen((r) => ({ ...r, [field]: val }));
    const timers = timersRef.current;
    if (timers[field]) clearTimeout(timers[field]);
    timers[field] = setTimeout(() => {
      setRegimen((r) => ({ ...r, [field]: val }));
      timers[field] = undefined;
    }, delayMs);
  }, []);
  useEffect(() => () => {
    const timers = timersRef.current;
    Object.keys(timers).forEach((k) => timers[k] && clearTimeout(timers[k]));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ok = interactiveApi.getInteractiveAvailability
          ? await interactiveApi.getInteractiveAvailability()
          : false;
        if (alive) setApiAvailable(!!ok);
      } catch {
        if (alive) setApiAvailable(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const runInteractive = useCallback(async () => {
    // Abort any in-flight request to avoid false offline
    if (apiAbort.current) {
      try { apiAbort.current.abort('superseded'); } catch {}
    }
    const controller = new AbortController();
    apiAbort.current = controller;

    setLoading(true); setError(null);
    const flatPatient = { ...patient, levels: measuredLevels, population_mode: mode };
    // Optimistic compute: show fast local PK while awaiting backend
    try {
      const { series: syn, summary: sum } = computeAll(flatPatient, regimen);
      setSeries(syn); setSummary(sum);
    } catch {
      // ignore optimistic errors
    }
    try {
      const data = await interactiveApi.calculateInteractiveAUC(flatPatient, regimen, { signal: controller.signal });
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
      setApiAvailable(true);
      setError(null);
    } catch (e) {
      if (e?.name === 'AbortError') return; // superseded
      setApiAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [patient, regimen, measuredLevels, mode]);

  useEffect(() => {
    const t = setTimeout(() => { runInteractive(); }, 150); // reduced debounce
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

  const commitField = (field) => (value) => setRegimen((r) => ({ ...r, [field]: value }));

  const Control = ({ label, value, min, max, step, field, unit }) => {
    // Respect stricter existing bounds, standardize steps per field
    const minFinal = Math.max(0, Number.isFinite(min) ? min : 0);
    const maxFinal = Math.min(9999, Number.isFinite(max) ? max : 9999);
    const stepFinal = field === 'dose_mg' ? 50 : field === 'interval_hours' ? 1 : field === 'infusion_minutes' ? 5 : (Number.isFinite(step) ? step : 1);

    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">{t(label, label)}</Typography>
          {field === 'dose_mg' && <HelpTooltip titleKey={help.dose.key} linkTo={help.dose.link} />}
          {field === 'interval_hours' && <HelpTooltip titleKey={help.interval.key} linkTo={help.interval.link} />}
          {field === 'infusion_minutes' && <HelpTooltip titleKey={help.infusion.key} linkTo={help.infusion.link} />}
        </Box>
        <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
          <Grid item xs={8} md={9}>
            <Slider
              value={value}
              min={minFinal}
              max={maxFinal}
              step={stepFinal}
              onChange={(_, v) => scheduleCommit(field, Number(Array.isArray(v) ? v[0] : v), 120)}
              onChangeCommitted={(_, v) => commitField(field)(Number(Array.isArray(v) ? v[0] : v))}
              aria-label={t(label, label)}
            />
          </Grid>
          <Grid item xs="auto" md="auto">
            <TextField
              variant="outlined"
              className="numericInputDense"
              label={t(label, label)}
              type="number"
              size="small"
              value={value}
              onChange={(e) => scheduleCommit(field, Number(e.target.value || 0), 200)}
              onBlur={(e) => commitField(field)(Number(e.target.value || 0))}
              onKeyDown={(e) => { if (e.key === 'Enter') commitField(field)(Number(e.currentTarget.value || 0)); }}
              InputProps={{
                endAdornment: unit ? (
                  <InputAdornment position="end" sx={{ minWidth: '3ch', justifyContent: 'flex-end' }}>{t(unit, unit)}</InputAdornment>
                ) : undefined,
                inputProps: { min: minFinal, max: maxFinal, step: stepFinal }
              }}
              InputLabelProps={{ shrink: true }}
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
  };

  const copyJson = async () => {
    const payload = { patient, regimen, summary, series, mode };
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
      doc.text(`${t('title','Vancomyzer®')} — ${t('tabs.interactiveAuc', t('tabs.interactiveAUC','Interactive AUC'))} [${mode}]`, 40, 40);
      const meta = `Dose: ${regimen.dose_mg} mg  |  Interval: q${regimen.interval_hours}h  |  Infusion: ${regimen.infusion_minutes} min\nAUC24: ${toFixed(summary?.auc_24,0)}  |  Peak: ${toFixed(summary?.predicted_peak,1)} mg/L  |  Trough: ${toFixed(summary?.predicted_trough,1)} mg/L`;
      doc.setFontSize(10);
      doc.text(meta, 40, 60);
      doc.setFontSize(9);
      doc.text(t('disclaimers.pdf','Disclaimer: Generated by Vancomyzer®. For educational use only. Verify with institutional policies before applying clinically.'), 40, 75);
      if (img) {
        const w = 760; const h = 360;
        doc.addImage(img, 'PNG', 40, 80, w, h, undefined, 'FAST');
      }
      doc.text('Note: This report is for informational purposes only and should not be used as the sole basis for clinical decision-making.', 40, 750, { maxWidth: 520 });
      doc.save('vancomycin_interactive_auc.pdf');
    } catch (e) {
      alert('PDF export failed');
    }
  };

  const guidelineUrl = 'https://www.ashp.org/-/media/assets/policy-guidelines/docs/therapeutic-guidelines/therapeutic-guidelines-monitoring-vancomycin-ASHP-IDSA-PIDS.pdf';

  const onRetry = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await interactiveApi.getInteractiveAvailability();
      setApiAvailable(!!ok);
    } catch {}
    try {
      const data = await interactiveApi.calculateInteractiveAUC({ ...patient, levels: measuredLevels, population_mode: mode }, regimen);
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
      setApiAvailable(true);
      setError(null);
    } catch (e) {
      setError(e?.message || 'Request failed');
      setApiAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [patient, regimen, measuredLevels, mode]);

  return (
    <Box dir={dir}>
      {showDisclaimer && (
        <Alert
          severity="info"
          variant="outlined"
          onClose={() => { try { localStorage.setItem('interactive_disclaimer_dismissed','1'); } catch {} setShowDisclaimer(false); }}
          sx={{ mb: 2 }}
        >
          {t('disclaimers.calculator', 'Disclaimer: This tool is provided for informational and educational purposes only. It does not replace independent clinical judgment. Always verify calculations and follow institutional protocols.')}
        </Alert>
      )}
      {/* Minimal patient form */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t('patient', 'Patient')}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField size="small" fullWidth label={`${t('age','Age')} (y)`} type="number" value={patient.age} onChange={(e) => setPatient((p) => ({ ...p, age: Number(e.target.value) }))} />
            </Box>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField size="small" fullWidth select SelectProps={{ native: true }} label={t('gender','Gender')} value={patient.gender} onChange={(e) => setPatient((p) => ({ ...p, gender: e.target.value }))}><option value="male">{t('male','Male')}</option><option value="female">{t('female','Female')}</option></TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField size="small" fullWidth label={`${t('weight','Weight')} (kg)`} type="number" value={patient.weight_kg} onChange={(e) => setPatient((p) => ({ ...p, weight_kg: Number(e.target.value) }))} />
              <HelpTooltip titleKey={help.weight.key} linkTo={help.weight.link} />
            </Box>
          </Grid>
          <Grid item xs={6} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField size="small" fullWidth label={`${t('height','Height')} (cm)`} type="number" value={patient.height_cm} onChange={(e) => setPatient((p) => ({ ...p, height_cm: Number(e.target.value) }))} />
              <HelpTooltip titleKey={help.height.key} linkTo={help.height.link} />
            </Box>
          </Grid>
          <Grid item xs={6} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField size="small" fullWidth label={`${t('scr','SCr')} (mg/dL)`} type="number" value={patient.serum_creatinine_mg_dl} onChange={(e) => setPatient((p) => ({ ...p, serum_creatinine_mg_dl: Number(e.target.value) }))} />
              <HelpTooltip titleKey={help.scr.key} linkTo={help.scr.link} />
            </Box>
          </Grid>
          <Grid item xs={6} md={2}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextField size="small" fullWidth label={`${t('mic','MIC')} (mg/L)`} type="number" value={patient.mic_mg_L} onChange={(e) => setPatient((p) => ({ ...p, mic_mg_L: Number(e.target.value) }))} />
              <HelpTooltip titleKey={help.mic.key} linkTo={help.mic.link} />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Metrics strip */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Box component="div" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{t('auc24','AUC24')}</Typography>
              <HelpTooltip titleKey={help.auc24.key} linkTo={help.auc24.link} />
            </Box>
            <Box sx={{ mt: 1 }}>
              <Chip label={`${toFixed(summary?.auc_24, 0)} mg·h/L`} color={summary?.auc_24 >= 400 && summary?.auc_24 <= 600 ? 'success' : 'warning'} variant={summary?.auc_24 >= 400 && summary?.auc_24 <= 600 ? 'filled' : 'outlined'} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Box component="div" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{t('predicted_trough','Predicted trough')}</Typography>
              <HelpTooltip titleKey={help.trough.key} linkTo={help.trough.link} />
            </Box>
            <Box sx={{ mt: 1 }}>
              <Chip label={`${toFixed(summary?.predicted_trough, 1)} mg/L`} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Box component="div" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{t('predicted_peak','Predicted peak')}</Typography>
              <HelpTooltip titleKey={help.peak.key} linkTo={help.peak.link} />
            </Box>
            <Box sx={{ mt: 1 }}>
              <Chip label={`${toFixed(summary?.predicted_peak, 1)} mg/L`} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Regimen controls */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}><Control label="dose" value={draftRegimen.dose_mg} min={0} max={4000} step={50} field="dose_mg" unit="mg" /></Grid>
        <Grid item xs={12} md={4}><Control label="interval" value={draftRegimen.interval_hours} min={6} max={48} step={1} field="interval_hours" unit="h" /></Grid>
        <Grid item xs={12} md={4}><Control label="infusion" value={draftRegimen.infusion_minutes} min={15} max={240} step={5} field="infusion_minutes" unit="min" /></Grid>
      </Grid>

      {/* Toggles & badges */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <FormControlLabel control={<Switch checked={showAucFill} onChange={(e) => setShowAucFill(e.target.checked)} />} label={t('shade_auc','Shade 0–24h AUC')} />
        <FormControlLabel control={<Switch checked={showDoseMarkers} onChange={(e) => setShowDoseMarkers(e.target.checked)} />} label={t('show_dose_markers','Show dose markers')} />

        <Tooltip title={t('bullets.guidelines','Following ASHP/IDSA 2020 Guidelines')} placement="top">
          <Chip size="small" color="primary" label={t('badges.evidenceBased','Evidence-based')} component="a" clickable href={guidelineUrl} target="_blank" rel="noopener noreferrer" />
        </Tooltip>

        {posteriorN ? (
          <Chip size="small" color="primary" variant="outlined" label={`${t('bayesian','Bayesian')} (n=${posteriorN})`} />
        ) : (
          apiAvailable ? (
            <Chip size="small" color="primary" label={t('status.bayes.online', 'Bayesian optimization (online)')} />
          ) : (
            <Tooltip title={t('status.bayes.tooltip', 'Service unreachable. Check API URL, /health, CORS, or server uptime.')}>
              <Chip size="small" variant="outlined" color="warning" label={t('status.bayes.offline', 'Bayesian optimization (offline)')} />
            </Tooltip>
          )
        )}
        {!apiAvailable && (
          <Button size="small" variant="text" onClick={onRetry} sx={{ textTransform: 'none' }}>
            {t('retry','Retry')}
          </Button>
        )}

        <Button size="small" variant="text" onClick={() => onOpenGuidelines && onOpenGuidelines()} sx={{ textTransform: 'none' }}>
          {t('buttons.guidelines','Guidelines')}
        </Button>

        {loading && <Typography color="text.secondary">{t('updating','Updating…')}</Typography>}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" variant="outlined" onClick={copyJson}>{t('copy_json','Copy JSON')}</Button>
        <Button size="small" variant="contained" onClick={exportPdf}>{t('export_pdf','Export PDF')}</Button>
      </Box>

      {/* Levels panel */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box component="div" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="subtitle2">{t('measured_levels','Measured Levels')}</Typography>
          <HelpTooltip titleKey={help.levels.key} linkTo={help.levels.link} />
        </Box>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={4}>
            <TextField select SelectProps={{ native: true }} fullWidth size="small" label={t('mode','Mode')} value={levelMode} onChange={(e) => setLevelMode(e.target.value)}>
              <option value="none">{t('no_levels','No levels')}</option>
              <option value="one">{t('one_level_bayesian','One level (Bayesian)')}</option>
              <option value="two">{t('two_levels_peak_trough','Two levels (peak + trough)')}</option>
            </TextField>
          </Grid>
          {(levelMode === 'one' || levelMode === 'two') && (
            <>
              <Grid item xs={12} md={3}><TextField size="small" type="number" label={`${t('peak_random','Peak/random')} (mg/L)`} fullWidth value={levelInputs.peak.conc} onChange={(e) => setLevelInputs((s) => ({ ...s, peak: { ...s.peak, conc: e.target.value } }))} /></Grid>
              <Grid item xs={12} md={3}><TextField size="small" type="number" label={t('hours_after_infusion_end','Hours after infusion end')} fullWidth value={levelInputs.peak.after_end_h} onChange={(e) => setLevelInputs((s) => ({ ...s, peak: { ...s.peak, after_end_h: e.target.value } }))} /></Grid>
            </>
          )}
          {levelMode === 'two' && (
            <>
              <Grid item xs={12} md={3}><TextField size="small" type="number" label={`${t('trough','Trough')} (mg/L)`} fullWidth value={levelInputs.trough.conc} onChange={(e) => setLevelInputs((s) => ({ ...s, trough: { ...s.trough, conc: e.target.value } }))} /></Grid>
              <Grid item xs={12} md={3}><TextField size="small" disabled label={`${t('trough_time','Trough time')} (≈ τ)`} fullWidth value={regimen.interval_hours} /></Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Chart and error banner */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error} <Button size="small" onClick={onRetry}>{t('retry','Retry')}</Button></Alert>
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
