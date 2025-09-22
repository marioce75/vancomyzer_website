import jsPDF from 'jspdf';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Box, Grid, Paper, Typography, Slider, TextField, FormControlLabel, Switch, Button, Chip, Alert, InputAdornment, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { health, optimize, postAuc } from '../services/interactiveApi';
import { discoverApiBase } from '../lib/apiDiscovery';
import { buildMeasuredLevels } from '../services/pkVancomycin'
import HelpTooltip from './common/HelpTooltip';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LoadingDoseCard from './LoadingDoseCard.jsx';
import { deterministicSummary, crclCG, clFromCrcl } from '../pk/core'; // Use enhanced version
import { medcalcConfig } from '../pk/medcalcMode'; // Keep config
import DoseInput from './controls/DoseInput';
import ConcTimeChart from './chart/ConcTimeChart';

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

// Utility function for safe number formatting
const toFixed = (val, digits) => {
  if (val == null || !Number.isFinite(val)) return '—';
  return Number(val).toFixed(digits);
};

function formToPayload(s) {
  return {
    age_years: s.ageYears ?? null,
    weight_kg: s.weightKg ?? null,
    height_cm: s.heightCm ?? null,
    scr_mg_dl: s.scr ?? null,
    gender: s.gender ?? null,
    dose_mg: s.doseMg ?? null,
    interval_hr: s.intervalHr ?? null,
    infusion_minutes: s.infusionMin ?? 60,
    levels: s.levels ?? null,
  };
}

export default function InteractiveAUC({ mode = 'adult', onOpenGuidelines }) {
  const { t, i18n } = useTranslation();
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  
  const [engineMode, setEngineMode] = useState('deterministic');

  // API discovery state
  const [apiBase, setApiBase] = useState(null);
  const [apiDiscoveryError, setApiDiscoveryError] = useState(null);
  
  useEffect(() => {
    // Initialize API discovery on mount
    const initApi = async () => {
      try {
        const base = await discoverApiBase();
        setApiBase(base);
        console.log('[Vancomyzer] API discovered:', base);
      } catch (error) {
        console.error('[Vancomyzer] API discovery failed:', error);
        setApiDiscoveryError(error.message);
      }
    };
    initApi();
  }, []);


  // Minimal patient inputs to support Bayesian priors
  const [patient, setPatient] = useState({ age: 56, gender: 'male', weight_kg: 79, height_cm: 170, serum_creatinine_mg_dl: 1.0, mic_mg_L: 1.0, levels: [] });
  const [regimen, setRegimen] = useState({ dose_mg: 1000, interval_hours: 12, infusion_minutes: 60 });
  const [draftRegimen, setDraftRegimen] = useState({ dose_mg: 1000, interval_hours: 12, infusion_minutes: 60 });
  const [series, setSeries] = useState({ time_hours: [], concentration_mg_L: [] });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try {
      const ts = Number(localStorage.getItem('calcDisclaimerTs') || 0);
      return !ts || (Date.now() - ts) > 24 * 60 * 60 * 1000;
    } catch { return true; }
  });
  const [retryTs, setRetryTs] = useState(0);
  
  // Measured levels UI
  const [levelMode, setLevelMode] = useState('none');
  const [levelInputs, setLevelInputs] = useState({ peak: { conc: '', after_end_h: '' }, trough: { conc: '' } });
  // Keep draftRegimen in sync with regimen when regimen changes externally
  useEffect(() => { setDraftRegimen(regimen); }, [regimen]);

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
      // Health check will be handled by the discovery layer
      const ok = await health();
      if (alive) setApiOnline(!!ok);
    })();
    return () => { alive = false; };
  }, [apiBase]); // Re-run when API base changes

  const runInteractive = useCallback(async () => {
    setLoading(true); setError(null);

    // Enhanced deterministic compute with immediate UI updates  
    try {
      const p = {
        ageY: Number(patient?.age || patient?.age_years || 0),
        sex: (String(patient?.gender || 'male').toLowerCase() === 'female') ? 'Female' : 'Male',
        weightKg: Number(patient?.weight_kg || 0),
        heightCm: Number(patient?.height_cm || 0) || undefined,
        scrMgDl: Number(patient?.serum_creatinine_mg_dl || patient?.scr_mg_dl || 0),
        mic: Number(patient?.mic_mg_L || patient?.mic || medcalcConfig.defaultMIC)
      };
      const r = { 
        doseMg: Number(regimen?.dose_mg || 0), 
        intervalH: Number(regimen?.interval_hours || 12), 
        infusionMin: Number(regimen?.infusion_minutes || 60) 
      };
      
      // Use enhanced deterministic summary with configurable options
      const det = deterministicSummary(p, r, {
        vdPerKg: medcalcConfig.vdPerKg,
        clScale: medcalcConfig.clFromCrcl.scale || 1.0,
        useDoseOverCL: medcalcConfig.useDoseOverCL,
        weightStrategy: 'TBW', // Can be made configurable later
        scrRounding: medcalcConfig.scrRounding
      });
      
      // Update UI immediately (optimistic)
      setSeries(det.series); 
      setSummary((s) => ({ 
        ...(det.metrics ? { ...s, ...det.metrics } : s), 
        auc_24: det.metrics.auc_24, 
        predicted_peak: det.metrics.predicted_peak, 
        predicted_trough: det.metrics.predicted_trough 
      }));
    } catch (err) {
      console.warn('[Vancomyzer] Deterministic calculation failed:', err);
      // Continue with API call even if deterministic fails
    }

    if (apiAbort.current) apiAbort.current.abort();
    apiAbort.current = new AbortController();

    const hasLevels = Array.isArray(measuredLevels) && measuredLevels.length > 0;

    // If user selected deterministic and no levels, or API is offline, stop here
    if ((engineMode !== 'bayesian' && !hasLevels) || !apiOnline) {
      setLoading(false);
      return;
    }

    // Build flat payload matching backend AucRequest
    const formState = {
      ageYears: patient?.age,
      weightKg: patient?.weight_kg,
      heightCm: patient?.height_cm,
      scr: patient?.serum_creatinine_mg_dl,
      gender: patient?.gender,
      doseMg: regimen?.dose_mg,
      intervalHr: regimen?.interval_hours,
      infusionMin: regimen?.infusion_minutes,
      levels: null,
    };
    const payload = formToPayload(formState);

    try {
      try { console.debug('[Vancomyzer] POST /api/interactive/auc', payload); } catch {}
      const res = await postAuc(payload, { signal: apiAbort.current.signal });
      const data = res?.result || res;

      const auc = data?.metrics?.auc_24 ?? data.auc_24 ?? data.predicted_auc_24;
      const peak = data?.metrics?.predicted_peak ?? data.predicted_peak;
      const trough = data?.metrics?.predicted_trough ?? data.predicted_trough;

      if (auc != null) setSummary(s => ({ ...s, auc_24: auc, predicted_peak: peak, predicted_trough: trough }));
      if (data?.series) {
        const s = data.series;
        setSeries({
          time_hours: s.time_hours,
          concentration_mg_L: s.concentration_mg_L || s.median,
          lower: s.lower || s.p05,
          upper: s.upper || s.p95
        });
      }
      setApiOnline(true);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('[Vancomyzer] AUC error:', e);
      setError(String(e?.message || e));
      setApiOnline(false);
      const now = Date.now();
      if (!retryTs || (now - retryTs) > 2000) setRetryTs(now);
    } finally {
      setLoading(false);
    }
  }, [patient, regimen, measuredLevels, retryTs, engineMode, apiOnline]);

  useEffect(() => {
    const t = setTimeout(() => { runInteractive(); }, 220);
    return () => clearTimeout(t);
  }, [runInteractive]);

  const labels = useMemo(() => (Array.isArray(series?.time_hours) ? series.time_hours : []), [series]);
  const conc = useMemo(() => (Array.isArray(series?.concentration_mg_L) ? series.concentration_mg_L : []), [series]);

  const levelMarkers = useMemo(() => {
    const tau = Number(regimen.interval_hours) || 12;
    return measuredLevels
      .filter((lv) => lv.time_hr >= 0 && lv.time_hr <= tau + 1e-9)
      .map((lv) => ({ x: lv.time_hr, y: Number(lv.concentration_mg_L), tag: lv.tag }));
  }, [measuredLevels, regimen.interval_hours]);

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
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(14);
      doc.text(`${t('title','Vancomyzer®')} — ${t('tabs.interactiveAuc', t('tabs.interactiveAUC','Interactive AUC'))} [${mode}]`, 40, 40);
      const meta = `Dose: ${regimen.dose_mg} mg  |  Interval: q${regimen.interval_hours}h  |  Infusion: ${regimen.infusion_minutes} min\nAUC24: ${toFixed(summary?.auc_24,0)}  |  Peak: ${toFixed(summary?.predicted_peak,1)} mg/L  |  Trough: ${toFixed(summary?.predicted_trough,1)} mg/L`;
      doc.setFontSize(10);
      doc.text(meta, 40, 60);
      // Disclaimer line just below header
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(t('legal.pdf'), 40, 75, { maxWidth: 515 });
      doc.setTextColor(0);
      doc.save('vancomycin_interactive_auc.pdf');
    } catch (e) {
      alert('PDF export failed');
    }
  };

  const guidelineUrl = 'https://www.ashp.org/-/media/assets/policy-guidelines/docs/therapeutic-guidelines/therapeutic-guidelines-monitoring-vancomycin-ASHP-IDSA-PIDS.pdf';

  const onRetry = useCallback(async () => {
    try {
      // Force API rediscovery
      const base = await discoverApiBase(true);
      setApiBase(base);
      setApiDiscoveryError(null);
      console.log('[Vancomyzer] API rediscovered:', base);
      
      // Test health and run interactive
      const ok = await health();
      setApiOnline(!!ok);
      if (ok) runInteractive();
    } catch (error) {
      console.error('[Vancomyzer] Retry failed:', error);
      setApiDiscoveryError(error.message);
    }
  }, [runInteractive]);

  // Helper: compute CL quickly to reset dose to target AUC
  const computeCL_L_h = useCallback(() => {
    try {
      const p = {
        ageY: Number(patient?.age || patient?.age_years || 0),
        sex: (String(patient?.gender || 'male').toLowerCase() === 'female') ? 'Female' : 'Male',
        weightKg: Number(patient?.weight_kg || 0),
        heightCm: Number(patient?.height_cm || 0) || undefined,
        scrMgDl: Number(patient?.serum_creatinine_mg_dl || patient?.scr_mg_dl || 0),
      };
      const crcl = crclCG({ ageY: p.ageY, sex: p.sex, weightKg: p.weightKg, scrMgDl: p.scrMgDl, heightCm: p.heightCm, rounding: medcalcConfig.scrRounding });
      const CL = clFromCrcl(crcl, medcalcConfig.clFromCrcl);
      return Number(CL) || 0;
    } catch { return 0; }
  }, [patient]);

  return (
    <Box dir={dir}>
      {/* Mode toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <ToggleButtonGroup size="small" value={engineMode} exclusive onChange={(_, v) => v && setEngineMode(v)}>
          <ToggleButton value="deterministic">Deterministic</ToggleButton>
          <ToggleButton value="bayesian" disabled={!apiOnline}>Bayesian</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Config banners */}
      {apiDiscoveryError && (
        <Alert 
          severity="error" 
          variant="outlined" 
          sx={{ mb: 2 }}
          action={
            <Button size="small" onClick={async () => {
              try {
                const base = await discoverApiBase(true);
                setApiBase(base);
                setApiDiscoveryError(null);
                console.log('[Vancomyzer] API rediscovered:', base);
              } catch (error) {
                console.error('[Vancomyzer] API rediscovery failed:', error);
                setApiDiscoveryError(error.message);
              }
            }}>
              {t('actions.retry', 'Retry')}
            </Button>
          }
        >
          Interactive service unreachable. {apiDiscoveryError} Click to retry.
        </Alert>
      )}
      {!apiDiscoveryError && apiBase && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">API active:</Typography>
            <Chip 
              size="small" 
              label={apiBase.length > 40 ? `${apiBase.slice(0, 20)}...${apiBase.slice(-17)}` : apiBase}
              title={apiBase}
              sx={{ maxWidth: 200 }}
            />
          </Box>
        </Alert>
      )}
      {/* CORS/Network inline hint when fetch fails with TypeError */}
      {!apiOnline && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          Interactive service unreachable (CORS/Network). Verify API base and backend CORS. Expected POST {`/api/interactive/auc`}.
        </Alert>
      )}

      {showDisclaimer && (
        <Alert
          role="note"
          severity="info"
          variant="outlined"
          onClose={() => { setShowDisclaimer(false); try { localStorage.setItem('calcDisclaimerTs', String(Date.now())); } catch {} }}
          sx={{ mb: 2 }}
        >
          {t('legal.calcBanner')}
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
        <Grid item xs={12} md={3}>
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
        <Grid item xs={12} md={3}>
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
        <Grid item xs={12} md={3}>
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
        <Grid item xs={12} md={3}>
          <LoadingDoseCard weightKg={Number(patient?.weight_kg || 0)} />
        </Grid>
      </Grid>

      {/* Regimen controls */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <DoseInput label={t('dose','Dose')} value={draftRegimen.dose_mg} unit="mg" min={0} max={4000} step={250} onChange={(v) => scheduleCommit('dose_mg', Math.round(v/250)*250, 180)} />
        </Grid>
        <Grid item xs={12} md={4}>
          <DoseInput label={t('interval','Interval')} value={draftRegimen.interval_hours} unit="h" min={8} max={24} step={null} marks={[8,12,24]} onChange={(v) => scheduleCommit('interval_hours', v, 180)} />
        </Grid>
        <Grid item xs={12} md={4}>
          <DoseInput label={t('infusion','Infusion')} value={draftRegimen.infusion_minutes} unit="min" min={60} max={120} step={null} marks={[60,90,120]} onChange={(v) => scheduleCommit('infusion_minutes', v, 180)} />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button size="small" variant="outlined" onClick={() => {
          const CL = computeCL_L_h();
          if (!CL) return;
          const targetMid = 500; // mg·h/L
          const dailyDose = targetMid * CL; // mg/day
          // snap to nearest 250mg and allowed intervals
          const intervals = [8,12,24];
          const best = intervals.map((tau) => ({ tau, dose: Math.round((dailyDose * tau / 24) / 250) * 250 }));
          // choose the one closest to current interval
          const choice = best.reduce((a,b) => (Math.abs(b.tau - (regimen.interval_hours||12)) < Math.abs(a.tau - (regimen.interval_hours||12)) ? b : a));
          scheduleCommit('dose_mg', choice.dose, 0);
          scheduleCommit('interval_hours', choice.tau, 0);
        }}>{t('reset_to_target','Reset to target AUC 400–600')}</Button>
      </Box>

      {/* Toggles & badges */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <Tooltip title={t('bullets.guidelines','Following ASHP/IDSA 2020 Guidelines')} placement="top">
          <Chip size="small" color="primary" label={t('badges.evidenceBased','Evidence-based')} component="a" clickable href={guidelineUrl} target="_blank" rel="noopener noreferrer" />
        </Tooltip>
        <Tooltip title={t('status.bayesian.tooltip')}>
          <Chip
            size="small"
            variant={apiOnline ? 'filled' : 'outlined'}
            color={apiOnline ? 'primary' : 'warning'}
            label={apiOnline ? 'Bayesian optimization' : 'Bayesian optimization (offline)'}
            sx={{ ml: 1 }}
          />
        </Tooltip>

        {/* API Base Status Chip */}
        {apiBase && (
          <Tooltip title={`Active API base: ${apiBase}`} placement="top">
            <Chip 
              size="small" 
              variant="outlined" 
              color="info"
              label={`API: ${apiBase.length > 25 ? `${apiBase.slice(0, 12)}...${apiBase.slice(-10)}` : apiBase}`}
            />
          </Tooltip>
        )}

        <Button size="small" startIcon={<RestartAltIcon />} onClick={onRetry}>
          {t('actions.retry','Retry')}
        </Button>

        {loading && <Typography color="text.secondary">{t('updating','Updating…')}</Typography>}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" variant="outlined" onClick={copyJson}>{t('copy_json','Copy JSON')}</Button>
        <Button size="small" variant="contained" onClick={exportPdf}>{t('export_pdf','Export PDF')}</Button>
        <Button size="small" variant="contained" color="primary" disabled={!apiOnline || loading} onClick={async () => {
          try {
            setLoading(true);
            const target = { auc_min: 400, auc_max: 600, mic: (patient && (patient.mic ?? patient.mic_mg_L)) ?? 1 };
            // debug
            try { console.debug('[Vancomyzer] optimize -> /api/optimize', { target }); } catch {}
            const data = await optimize({ patient: { ...patient, population_mode: mode }, regimen, target });
            const rec = data?.recommendation || data?.regimen || data?.optimized_regimen;
            if (rec) {
              setRegimen((r) => ({ ...r, dose_mg: rec.dose_mg, interval_hours: rec.interval_hours, infusion_minutes: rec.infusion_minutes }));
              await runInteractive();
            }
          } catch (e) {
            try { console.warn('[Vancomyzer] optimize failed:', e?.message || e); } catch {}
            setError(e?.message || 'Optimize failed');
            setApiOnline(false);
          } finally { setLoading(false); }
        }}>{t('actions.optimize','Optimize dose')}</Button>
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
          <Alert severity="error" sx={{ mb: 2 }}>{error} <Button size="small" startIcon={<RestartAltIcon />} onClick={onRetry}>{t('actions.retry','Retry')}</Button></Alert>
        )}
        <Box sx={{ height: 360 }}>
          <ConcTimeChart
            times={labels}
            conc={conc}
            lower={Array.isArray(series?.lower) ? series.lower : undefined}
            upper={Array.isArray(series?.upper) ? series.upper : undefined}
            levels={levelMarkers}
            shadeAuc
          />
        </Box>
      </Paper>
    </Box>
  );
}
