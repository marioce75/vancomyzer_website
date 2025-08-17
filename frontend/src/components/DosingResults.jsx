import React, { useMemo, useState } from 'react';
import { Box, Grid, Paper, Button, Alert, Typography, TextField } from '@mui/material';
import { buildMeasuredLevels } from '../services/pkVancomycin';

function toFixed(val, digits = 1) {
  if (val === undefined || val === null || Number.isNaN(val)) return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val);
  return digits === 0 ? n.toFixed(0) : n.toFixed(digits);
}

function Stat({ label, value }) {
  return (
    <Paper sx={{ p: 2, textAlign: 'center' }} variant="outlined">
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{value ?? '—'}</div>
    </Paper>
  );
}

function EmptyState({ message }) {
  return (
    <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>{message}</Box>
  );
}

export default function DosingResults({ result, onOpenInteractive }) {
  const [levelMode, setLevelMode] = useState('none');
  const [levelInputs, setLevelInputs] = useState({ peak: { conc: '', after_end_h: '' }, trough: { conc: '', after_end_h: '' } });

  const regimen = useMemo(() => ({
    dose_mg: result?.recommended_dose_mg ?? result?.dose_mg ?? 1000,
    interval_hours: result?.interval_hours ?? 12,
    infusion_minutes: result?.infusion_minutes ?? 60,
  }), [result]);

  const errors = useMemo(() => {
    const errs = {};
    const tinfH = (Number(regimen.infusion_minutes) || 60) / 60;
    if (levelMode !== 'none') {
      if (levelInputs.peak?.after_end_h) {
        const h = Number(levelInputs.peak.after_end_h);
        if (!(h >= 0.5 && h <= 6)) errs.peakAfter = 'Peak/random should be 0.5–6 h after infusion end';
      }
      if (levelMode === 'two' && levelInputs.trough?.conc) {
        // Trough within ~0.5 h of next dose; we just hint
        const twindowStart = (Number(regimen.interval_hours) || 12) - 0.5;
        if (!(twindowStart >= tinfH)) {
          errs.troughTime = 'Trough should be just before next dose (≈ τ)';
        }
      }
    }
    return errs;
  }, [levelMode, levelInputs, regimen]);

  if (!result) return <EmptyState message="Run a calculation to see results." />;

  const onTitrate = () => {
    const levels = buildMeasuredLevels(levelMode, {
      peak: levelInputs.peak?.conc && levelInputs.peak?.after_end_h ? { conc: Number(levelInputs.peak.conc), after_end_h: Number(levelInputs.peak.after_end_h) } : undefined,
      trough: levelInputs.trough?.conc ? { conc: Number(levelInputs.trough.conc) } : undefined,
    }, regimen);
    try {
      sessionStorage.setItem('interactiveAUC:incomingRegimen', JSON.stringify(regimen));
      sessionStorage.setItem('interactiveAUC:incomingLevels', JSON.stringify({ mode: levelMode, inputs: levelInputs, levels }));
    } catch {}
    if (typeof onOpenInteractive === 'function') onOpenInteractive();
  };

  return (
    <>
      {(!result.levels || result.levels.length === 0) && (
        <Alert severity="info">No vancomycin levels were provided. Recommendation is based on the population PK model.</Alert>
      )}

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6}><Stat label="Recommended dose (mg)" value={result.recommended_dose_mg} /></Grid>
        <Grid item xs={12} sm={6}><Stat label="Interval (hours)" value={result.interval_hours} /></Grid>
        <Grid item xs={12} sm={6}><Stat label="Daily dose (mg)" value={result.daily_dose_mg} /></Grid>
        <Grid item xs={12} sm={6}><Stat label="Predicted AUC24" value={toFixed(result.predicted_auc_24, 0)} /></Grid>
        <Grid item xs={12} sm={6}><Stat label="Predicted trough" value={toFixed(result.predicted_trough, 1)} /></Grid>
        <Grid item xs={12} sm={6}><Stat label="Predicted peak" value={toFixed(result.predicted_peak, 1)} /></Grid>
        <Grid item xs={12} sm={6}><Stat label="Creatinine clearance (mL/min)" value={toFixed(result.creatinine_clearance_ml_min, 0)} /></Grid>
        <Grid item xs={12} sm={6}><Stat label="Half-life (hours)" value={toFixed(result.half_life_hours, 1)} /></Grid>
        <Grid item xs={12} sm={6}><Stat label="mg/kg/day" value={toFixed(result.mg_per_kg_per_day, 1)} /></Grid>
      </Grid>

      {/* Measured Levels Panel */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
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
                Enter level times as hours after infusion end. For payload, time_hr = infusion_minutes/60 + after_end_hours.
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
                  error={!!errors.peakAfter} helperText={errors.peakAfter || ''}
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
                <TextField size="small" disabled label="Trough time (≈ τ)" fullWidth value={regimen.interval_hours} helperText={errors.troughTime || ''} />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button variant="contained" onClick={onTitrate} disabled={!result}>
          Titrate in Interactive AUC
        </Button>
      </Box>

      <details style={{ marginTop: 16 }}>
        <summary>Show raw JSON</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </>
  );
}
