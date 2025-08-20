import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Box, Grid, Paper, Typography, TextField, Chip, Button, Alert, Tooltip } from '@mui/material';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import jsPDF from 'jspdf';
import { useTranslation } from 'react-i18next';
import { bayesAUC, optimize, health, __BASE__ } from '../services/interactiveApi';
import { computeSeriesPeds } from '../pk/pedsNeonate';
import priorsPeds from '../pk/priorsPeds.json';
import targets from '../pk/targets.json';
import { buildMeasuredLevels } from '../services/pkVancomycin';

function toFixed(val, d=1){ if(val==null||Number.isNaN(Number(val))) return '—'; return Number(val).toFixed(d); }

export default function PediatricAUC(){
  const { t, i18n } = useTranslation();
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => { if (process.env.NODE_ENV !== 'production') console.debug('[PediatricAUC] mounted'); }, []);
  const [patient, setPatient] = useState({ ageYears: 8, weight_kg: 25, height_cm: '', scr_mg_dl: 0.5, mic: 1 });
  const [regimen, setRegimen] = useState({ dose_mg_per_kg: 15, interval_hours: 12, infusion_minutes: 60 });
  const [series, setSeries] = useState({ time_hours: [], concentration_mg_L: [] });
  const [summary, setSummary] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState('');
  const abortRef = useRef(null);
  const chartRef = useRef(null);

  // Measured levels state
  const [levelMode, setLevelMode] = useState('none');
  const [levelInputs, setLevelInputs] = useState({ peak: { conc: '', after_end_h: '' }, trough: { conc: '' } });

  useEffect(() => { let alive = true; (async()=>{ try{ const ok = await health(); if(alive) setApiOnline(!!ok);}catch{ if(alive) setApiOnline(false);} })(); return ()=>{alive=false}; }, []);

  const doseMg = useMemo(()=> Math.round((Number(regimen.dose_mg_per_kg)||0) * (Number(patient.weight_kg)||0)), [regimen, patient]);
  const dailyMgPerKg = useMemo(()=> (24/(Number(regimen.interval_hours)||12)) * (Number(regimen.dose_mg_per_kg)||0), [regimen]);

  // Enforce cap per site config
  useEffect(()=>{
    const maxPerDay = Number(priorsPeds?.monitoring?.maxDailyMgPerKg) || 80;
    if (!Number.isFinite(maxPerDay)) return;
    const allowed = maxPerDay * ((Number(regimen.interval_hours)||24) / 24);
    if ((Number(regimen.dose_mg_per_kg)||0) > allowed + 0.1) {
      const adjusted = Math.max(5, Math.round(allowed/5)*5);
      setRegimen(r => ({ ...r, dose_mg_per_kg: adjusted }));
    }
  }, [regimen.dose_mg_per_kg, regimen.interval_hours]);

  useEffect(()=>{
    const { series: s, summary: sum } = computeSeriesPeds(patient, regimen);
    setSeries(s); setSummary(sum);
    setWarning(dailyMgPerKg > ((priorsPeds?.monitoring?.maxDailyMgPerKg)||80) ? t('peds.notes.maxDaily') : '');
  }, [patient, regimen, dailyMgPerKg, t]);

  const measuredLevels = useMemo(() => buildMeasuredLevels(levelMode, {
    peak: levelInputs.peak?.conc && levelInputs.peak?.after_end_h ? { conc: Number(levelInputs.peak.conc), after_end_h: Number(levelInputs.peak.after_end_h) } : undefined,
    trough: levelInputs.trough?.conc ? { conc: Number(levelInputs.trough.conc) } : undefined,
  }, { interval_hours: regimen.interval_hours, infusion_minutes: regimen.infusion_minutes }), [levelMode, levelInputs, regimen.interval_hours, regimen.infusion_minutes]);

  const runBackend = useCallback(async () => {
    if(!apiOnline) return;
    // Only if Bayesian levels exist
    const hasLevels = Array.isArray(measuredLevels) && measuredLevels.length > 0;
    if (!hasLevels) return;

    setLoading(true); setError(null);
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try{
      const payload = {
        patient: { ...patient, mic: Number(patient.mic||1), population: 'pediatric' },
        regimen: { dose_mg: doseMg, interval_hours: regimen.interval_hours, infusion_minutes: regimen.infusion_minutes },
        levels: measuredLevels
      };
      try { console.debug('[Vancomyzer] POST', `${__BASE__}/interactive/auc`, { shape: { patient: Object.keys(payload.patient), regimen: Object.keys(payload.regimen), levels: payload.levels.length } }); } catch {}
      const data = await bayesAUC(payload, { signal: abortRef.current.signal });
      const m = data?.metrics || data;
      setSummary((s)=>({ ...s, auc_24: m.auc_24 ?? s?.auc_24, predicted_peak: m.predicted_peak ?? s?.predicted_peak, predicted_trough: m.predicted_trough ?? s?.predicted_trough }));
      if (data?.series) setSeries(data.series);
      setApiOnline(true);
    } catch(e){ if(e?.name !== 'AbortError'){ try { console.warn('[Vancomyzer] bayesAUC error:', e?.message || e, e?.status ? `(status: ${e.status})` : ''); } catch {} setApiOnline(false); setError(e.message || 'Backend error'); } }
    finally{ setLoading(false); }
  }, [apiOnline, patient, regimen, doseMg, measuredLevels]);

  useEffect(()=>{ const id = setTimeout(()=>{ runBackend(); },180); return ()=> clearTimeout(id); }, [runBackend]);

  const labels = useMemo(()=> (series?.time_hours || series?.time || []), [series]);
  const conc = useMemo(()=> (series?.concentration_mg_L || series?.median || []), [series]);

  const chartData = useMemo(()=>({ datasets: [
    { label: 'Concentration (mg/L)', data: labels.map((x,i)=>({x, y: conc[i]})), borderColor: '#1976d2', backgroundColor: 'transparent', pointRadius: 0, tension: 0.25 }
  ]}), [labels, conc]);

  const chartOptions = useMemo(()=>({ responsive: true, maintainAspectRatio: false, scales: { x: { type:'linear', min:0, max:48, title:{ display:true, text:'Hours' } }, y:{ beginAtZero:true, title:{ display:true, text:'Concentration (mg/L)' } } } }), []);

  const exportPdf = () => {
    try {
      const img = chartRef.current?.toBase64Image ? chartRef.current.toBase64Image() : null;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(14);
      doc.text(`${t('title','Vancomyzer®')} — ${t('peds.title')}`, 40, 40);
      const meta = `Dose: ${regimen.dose_mg_per_kg} mg/kg  |  Interval: q${regimen.interval_hours}h  |  Infusion: ${regimen.infusion_minutes} min\nAUC24: ${toFixed(summary?.auc_24,0)}  |  Peak: ${toFixed(summary?.predicted_peak,1)} mg/L  |  Trough: ${toFixed(summary?.predicted_trough,1)} mg/L`;
      doc.setFontSize(10); doc.text(meta, 40, 60);
      doc.setFontSize(9); doc.setTextColor(110); doc.text(t('legal.pdf'), 40, 75, { maxWidth: 515 }); doc.setTextColor(0);
      if (img) doc.addImage(img, 'PNG', 40, 80, 760, 360, undefined, 'FAST');
      doc.save('pediatric_vancomycin_auc.pdf');
    } catch { /* ignore */ }
  };

  return (
    <Box dir={dir} data-testid="peds-root">
      {/* Inline CORS/network hint when offline */}
      {!apiOnline && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          Interactive service unreachable (CORS/Network). Check API base and backend CORS.
        </Alert>
      )}

      <Alert role="note" severity="info" variant="outlined" sx={{ mb: 2 }}>
        {t('peds.disclaimer','For educational use; verify dosing with institutional policy. AUC target 400–600 for MIC=1 unless otherwise specified by your site.')}
      </Alert>

      <Paper variant="outlined" sx={{ p:2, mb:2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t('peds.title')}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label={t('peds.inputs.ageYears')} placeholder={t('peds.inputs.ageYears')} type="number" value={patient.ageYears} onChange={(e)=> setPatient(p=>({ ...p, ageYears: Number(e.target.value) }))} /></Grid>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label={t('peds.inputs.weightKg')} placeholder={t('peds.inputs.weightKg')} type="number" value={patient.weight_kg} onChange={(e)=> setPatient(p=>({ ...p, weight_kg: Number(e.target.value) }))} /></Grid>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label={t('peds.inputs.heightCm')} placeholder={t('peds.inputs.heightCm')} type="number" value={patient.height_cm} onChange={(e)=> setPatient(p=>({ ...p, height_cm: Number(e.target.value) }))} /></Grid>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label={t('peds.inputs.scr')} placeholder={t('peds.inputs.scr')} type="number" value={patient.scr_mg_dl} onChange={(e)=> setPatient(p=>({ ...p, scr_mg_dl: Number(e.target.value) }))} /></Grid>
          <Grid item xs={6} md={2}><TextField size="small" fullWidth label={t('peds.inputs.mic')} placeholder={t('peds.inputs.mic')} type="number" value={patient.mic} onChange={(e)=> setPatient(p=>({ ...p, mic: Number(e.target.value) }))} /></Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p:2, textAlign:'center' }}>
            <Typography variant="caption" color="text.secondary">AUC24</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip label={`${toFixed(summary?.auc_24,0)} mg·h/L`} color={summary?.auc_24>=targets.pediatric.auc_min && summary?.auc_24<=targets.pediatric.auc_max ? 'success':'warning'} variant={summary?.auc_24>=targets.pediatric.auc_min && summary?.auc_24<=targets.pediatric.auc_max ? 'filled':'outlined'} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p:2, textAlign:'center' }}>
            <Typography variant="caption" color="text.secondary">{t('predicted_trough','Predicted trough')}</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip label={`${toFixed(summary?.predicted_trough,1)} mg/L`} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p:2, textAlign:'center' }}>
            <Typography variant="caption" color="text.secondary">{t('predicted_peak','Predicted peak')}</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip label={`${toFixed(summary?.predicted_peak,1)} mg/L`} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p:2, mb:2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}><TextField size="small" fullWidth type="number" label={t('peds.controls.doseMgKg')} placeholder={t('peds.controls.doseMgKg')} value={regimen.dose_mg_per_kg} inputProps={{ step: 5 }} onChange={(e)=> setRegimen(r=>({ ...r, dose_mg_per_kg: Number(e.target.value) }))} /></Grid>
          <Grid item xs={12} md={4}><TextField size="small" fullWidth type="number" label={t('peds.controls.intervalH')} placeholder={t('peds.controls.intervalH')} value={regimen.interval_hours} onChange={(e)=> setRegimen(r=>({ ...r, interval_hours: Number(e.target.value) }))} /></Grid>
          <Grid item xs={12} md={4}><TextField size="small" fullWidth type="number" label={t('peds.controls.infusionMin')} placeholder={t('peds.controls.infusionMin')} value={regimen.infusion_minutes} onChange={(e)=> setRegimen(r=>({ ...r, infusion_minutes: Number(e.target.value) }))} /></Grid>
        </Grid>
        {warning && <Typography variant="caption" color="warning.main" sx={{ mt: 1, display:'block' }}>{warning}</Typography>}
      </Paper>

      <Paper variant="outlined" sx={{ p:2, mb:2 }}>
        <Box component="div" sx={{ display:'inline-flex', alignItems:'center', gap:0.5 }}>
          <Typography variant="subtitle2">{t('measured_levels','Measured Levels')}</Typography>
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

      <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2, flexWrap:'wrap' }}>
        <Tooltip title={t('status.bayesian.tooltip')}><Chip size="small" variant={apiOnline?'filled':'outlined'} color={apiOnline?'primary':'warning'} label={apiOnline ? 'Bayesian optimization' : 'Bayesian optimization (offline)'} /></Tooltip>
        <Button size="small" variant="outlined" onClick={async()=>{ 
          try{ 
            const ok = await health(); 
            setApiOnline(!!ok);
            if (ok) runBackend();
          }catch{ setApiOnline(false);} 
        }}>
          {t('actions.retry')}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" variant="contained" color="primary" disabled={!apiOnline||loading} onClick={async ()=>{
          try{
            const target = { auc_min: 400, auc_max: 600, mic: Number(patient?.mic ?? 1) };
            try { console.debug('[Vancomyzer] POST', `${__BASE__}/optimize`, { target }); } catch {}
            const data = await optimize({ patient: { ...patient, mic: Number(patient.mic||1), population: 'pediatric' }, regimen: { dose_mg: doseMg, interval_hours: regimen.interval_hours, infusion_minutes: regimen.infusion_minutes }, target });
            const rec = data?.recommendation || data?.regimen || data?.optimized_regimen;
            if (rec) {
              const newMgPerKg = Math.max(5, Math.round((rec.dose_mg / Math.max(1, Number(patient.weight_kg)||1)) / 5) * 5);
              setRegimen(r=>({ ...r, dose_mg_per_kg: newMgPerKg, interval_hours: rec.interval_hours, infusion_minutes: rec.infusion_minutes }));
              await runBackend();
            }
          }catch(e){ setError(e.message || 'Optimize failed'); setApiOnline(false);}         
        }}>
          {t('actions.optimize')}
        </Button>
        <Button size="small" variant="outlined" onClick={exportPdf}>{t('export_pdf','Export PDF')}</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p:2 }}>
        <Box sx={{ height: 360 }}>
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        </Box>
      </Paper>
    </Box>
  );
}
