// Interactive tutorial that explains how to USE the app and INTERPRET dosing recommendations.
// Educational only. Uses the same API client the app already uses to run a demo calculation.

import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';

// --- IMPORTANT: import the SAME API helpers the main app uses for dosing submissions.
// Our app uses named exports { vancomyzerAPI, formatPatientForAPI } from '../services/api'
import { vancomyzerAPI, formatPatientForAPI } from '../services/api';

// ---------------- small helpers (teaching-only math) ----------------
function round(value, dp = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const m = Math.pow(10, dp);
  return Math.round(value * m) / m;
}

// Cockcroft–Gault CrCl (mL/min), teaching-only.
function cockcroftGault({ ageYears, weightKg, scrMgdl, sex }) {
  if (!ageYears || !weightKg || !scrMgdl) return null;
  const base = ((140 - Number(ageYears)) * Number(weightKg)) / (72 * Number(scrMgdl));
  return sex === 'female' ? base * 0.85 : base;
}

function bmi(kg, cm) {
  if (!kg || !cm) return null;
  const m = Number(cm) / 100;
  if (!m) return null;
  return kg / (m * m);
}

// ---------------- component ----------------
export default function ClinicalInfo() {
  // Patient demo inputs (kept simple for tutorial)
  const [sex, setSex] = useState('male');
  const [ageYears, setAgeYears] = useState(62);
  const [weightKg, setWeightKg] = useState(78);
  const [heightCm, setHeightCm] = useState(175);
  const [scrMgdl, setScrMgdl] = useState(1.2);
  const [targetAUC, setTargetAUC] = useState(500);  // target AUC24
  const [intervalHrs, setIntervalHrs] = useState(12);
  const [ldMgPerKg, setLdMgPerKg] = useState(25);

  const [loading, setLoading] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [demoResult, setDemoResult] = useState(null);

  const crcl = useMemo(() => cockcroftGault({ ageYears, weightKg, scrMgdl, sex }), [ageYears, weightKg, scrMgdl, sex]);
  const _bmi = useMemo(() => bmi(weightKg, heightCm), [weightKg, heightCm]);

  const loadingDoseMg = useMemo(() => round(weightKg * ldMgPerKg, 0), [weightKg, ldMgPerKg]);

  // --- Derive flags for interpretation tips (tutorial-only heuristics) ---
  const aucInRange = useMemo(() => {
    const auc = demoResult?.predicted_auc_24 ?? demoResult?.auc24 ?? demoResult?.AUC24 ?? demoResult?.targetAUC;
    if (!auc) return null;
    return auc >= 400 && auc <= 600;
  }, [demoResult]);
  const highTrough = useMemo(() => {
    const trough = demoResult?.predicted_trough ?? demoResult?.predictedTrough ?? demoResult?.trough;
    if (!trough) return null;
    return trough > 20;
  }, [demoResult]);

  // --- Run demo using the SAME service the app uses ---
  async function runDemo() {
    setDemoError('');
    setDemoResult(null);
    setLoading(true);
    try {
      // Build a demo patient shaped exactly like production expects, then format via helper
      const patientRaw = {
        population_type: 'adult',
        age_years: ageYears,
        gender: sex, // expected keys in our API client
        weight_kg: weightKg,
        height_cm: heightCm,
        serum_creatinine: scrMgdl,
        indication: 'pneumonia',
        severity: 'moderate',
        is_renal_stable: true,
        crcl_method: 'cockcroft_gault',
        // Tutorial-only extras (backend may ignore unknowns):
        source: 'tutorial',
        // The backend determines dose/interval; we include target here for context
        target_auc_24: targetAUC,
      };

      const payload = typeof formatPatientForAPI === 'function'
        ? formatPatientForAPI(patientRaw)
        : patientRaw;

      // Call the real dosing endpoint used by PatientInput
      const data = await vancomyzerAPI.calculateDosing(payload);
      setDemoResult(data);
    } catch (err) {
      setDemoError(err?.message || 'Demo failed. Please check network tab or try again.');
    } finally {
      setLoading(false);
    }
  }

  // Pretty-print result fields if present (be tolerant to shape differences)
  const regimenText = useMemo(() => {
    if (!demoResult) return '';
    const dose = demoResult.recommended_dose_mg
      ?? demoResult.maintenance_dose_mg
      ?? demoResult.maintenanceDoseMg
      ?? demoResult.doseMg;
    const qh = demoResult.interval_hours
      ?? demoResult.intervalHours
      ?? intervalHrs;
    const inf = demoResult.infusion_time_hours
      ?? demoResult.infusionTimeHours
      ?? 1;
    if (dose && qh) return `${dose} mg q${qh}h (infuse over ${inf} h)`;
    return '';
  }, [demoResult, intervalHrs]);

  const aucText = useMemo(() => {
    if (!demoResult) return '';
    const auc = demoResult.predicted_auc_24
      ?? demoResult.auc24
      ?? demoResult.AUC24
      ?? demoResult.targetAUC;
    if (auc) return `${round(auc, 0)} mg·h/L`;
    return '';
  }, [demoResult]);

  const troughText = useMemo(() => {
    if (!demoResult) return '';
    const t = demoResult.predicted_trough ?? demoResult.trough ?? demoResult.predictedTrough;
    if (t) return `${round(t, 1)} mg/L`;
    return '';
  }, [demoResult]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Interactive Tutorial
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        Learn how to use Vancomyzer and interpret dosing recommendations. The demo uses the same backend
        that powers the app, but all guidance here is educational only.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stepper activeStep={-1} orientation="vertical" sx={{ '& .MuiStepContent-root': { borderLeft: '2px solid #e0e0e0' } }}>
          {/* Step 1: Overview */}
          <Step expanded>
            <StepLabel>Overview: workflow at a glance</StepLabel>
            <StepContent>
              <Typography sx={{ mb: 2 }}>
                1) Enter patient info (age, weight, height, SCr, sex).<br/>
                2) Choose targets (AUC24 window 400–600 mg·h/L).<br/>
                3) Review loading and maintenance dose suggestions.<br/>
                4) Monitor levels and re-assess; consider Bayesian updates when levels are available.
              </Typography>
              <Divider sx={{ my: 2 }} />
            </StepContent>
          </Step>

          {/* Step 2: Enter data */}
          <Step expanded>
            <StepLabel>Enter patient data (demo)</StepLabel>
            <StepContent>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 2 }}>
                <ToggleButtonGroup value={sex} exclusive onChange={(e, v) => v && setSex(v)} size="small">
                  <ToggleButton value="male">Male</ToggleButton>
                  <ToggleButton value="female">Female</ToggleButton>
                </ToggleButtonGroup>
                <TextField label="Age (years)" type="number" value={ageYears} onChange={e => setAgeYears(Number(e.target.value))} />
                <TextField label="Serum creatinine (mg/dL)" type="number" inputProps={{ step: '0.1' }} value={scrMgdl} onChange={e => setScrMgdl(Number(e.target.value))} />
                <TextField label="Weight (kg)" type="number" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))} />
                <TextField label="Height (cm)" type="number" value={heightCm} onChange={e => setHeightCm(Number(e.target.value))} />
                <TextField label="Target AUC24 (mg·h/L)" type="number" value={targetAUC} onChange={e => setTargetAUC(Number(e.target.value))} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Teaching estimates:
              </Typography>
              <Typography sx={{ mb: 1 }}>
                CrCl (Cockcroft–Gault): <b>{crcl ? `${round(crcl, 1)} mL/min` : '—'}</b>{' '}
                · BMI: <b>{_bmi ? `${round(_bmi, 1)}` : '—'}</b>
              </Typography>
              <Divider sx={{ my: 2 }} />
            </StepContent>
          </Step>

          {/* Step 3: Loading dose */}
          <Step expanded>
            <StepLabel>Choose a loading dose (mg/kg)</StepLabel>
            <StepContent>
              <Box sx={{ px: { xs: 0, sm: 1 }, mb: 1 }}>
                <Slider
                  value={ldMgPerKg}
                  onChange={(_, v) => setLdMgPerKg(v)}
                  min={15}
                  max={30}
                  step={1}
                  valueLabelDisplay="on"
                />
              </Box>
              <Typography>
                Example loading dose: <b>{loadingDoseMg || '—'} mg</b> ({ldMgPerKg} mg/kg)
              </Typography>
              <Divider sx={{ my: 2 }} />
            </StepContent>
          </Step>

          {/* Step 4: Run demo calculation */}
          <Step expanded>
            <StepLabel>Run demo calculation (uses app’s dosing service)</StepLabel>
            <StepContent>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mb: 2 }}>
                <TextField label="Interval (hours)" type="number" value={intervalHrs} onChange={e => setIntervalHrs(Number(e.target.value))} />
              </Box>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                <Button variant="contained" onClick={runDemo} disabled={loading}>
                  {loading ? <><CircularProgress size={18} sx={{ mr: 1 }} /> Running…</> : 'Run demo with these inputs'}
                </Button>
                <Tooltip title="Opens the AUC tool if available">
                  <Button variant="outlined" href="/auc">Open Interactive AUC</Button>
                </Tooltip>
              </Box>

              {demoError && <Alert severity="error" sx={{ mb: 2 }}>{demoError}</Alert>}

              {demoResult && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>How to interpret the results</Typography>
                  <Typography sx={{ mb: 1 }}>
                    <b>Suggested regimen:</b> {regimenText || '—'}
                  </Typography>
                  <Typography sx={{ mb: 1 }}>
                    <b>Predicted AUC24:</b> {aucText || '—'} {aucInRange === false && <Alert severity="warning" sx={{ display: 'inline-flex', ml: 1, p: '0 8px' }}>Out of 400–600 window</Alert>}
                  </Typography>
                  <Typography sx={{ mb: 1 }}>
                    <b>Predicted trough:</b> {troughText || '—'} {highTrough && <Alert severity="warning" sx={{ display: 'inline-flex', ml: 1, p: '0 8px' }}>High trough &gt; 20 mg/L</Alert>}
                  </Typography>

                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Tips:</Typography>
                  <ul style={{ marginTop: 0 }}>
                    <li>Match the regimen (dose + q{intervalHrs}h + infusion time) to your institution’s order set.</li>
                    <li>Prefer AUC24 in the 400–600 mg·h/L range; if out of range, consider adjusting dose or interval.</li>
                    <li>Check troughs in context; very high troughs may signal too much exposure or accumulation.</li>
                    <li>Re-evaluate after renal function changes; re-run with updated SCr/weight.</li>
                  </ul>
                </Paper>
              )}

              <Typography variant="caption" color="text.secondary">
                This demo is for education only. Clinical decisions require full context and verification.
              </Typography>

              <Divider sx={{ my: 2 }} />
            </StepContent>
          </Step>

          {/* Step 5: Monitoring and follow-up */}
          <Step expanded>
            <StepLabel>Monitoring & follow-up</StepLabel>
            <StepContent>
              <Typography sx={{ mb: 1 }}>
                • Recheck SCr and levels per protocol (e.g., within 24–48h after steady state or earlier if unstable).<br/>
                • Update inputs and re-run; consider Bayesian updates when levels are available to individualize CL/Vd.
              </Typography>
              <Divider sx={{ my: 2 }} />
            </StepContent>
          </Step>
        </Stepper>
      </Paper>

      <Paper variant="outlined" sx={{ mt: 3, p: 2 }} className="clinical-disclaimer">
        <div className="clinical-disclaimer__header">
          <Typography className="clinical-disclaimer__title">Educational use only</Typography>
        </div>
        <Typography variant="body2">
          This tutorial is intended for learning. Verify all clinical recommendations against local policy
          and patient-specific factors.
        </Typography>
      </Paper>
    </Box>
  );
}
