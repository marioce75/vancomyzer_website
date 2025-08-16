import React from 'react';
import { Box, Grid, Paper, Button, Alert } from '@mui/material';

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
  if (!result) return <EmptyState message="Run a calculation to see results." />;

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

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button variant="contained" onClick={onOpenInteractive} disabled={!result}>
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
