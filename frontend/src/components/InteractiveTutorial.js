import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  TextField,
  Button,
  Slider,
  Grid,
  Chip,
  Divider,
  LinearProgress,
  Alert,
  Card,
  CardContent,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

// Session storage key
const SS_KEY = 'interactiveTutorialStateV1';

// Utility helpers
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const round = (v, dp = 0) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  const m = Math.pow(10, dp);
  return Math.round(v * m) / m;
};

// Very simple educational mapping from CrCl to interval
function suggestedIntervalHrs(crcl) {
  if (crcl >= 100) return 8;
  if (crcl >= 60) return 12;
  if (crcl >= 30) return 24;
  return 48; // 10–29 → q48h (educational bucket)
}

// Toy PK functions (educational demo only)
// Approximate vancomycin clearance from CrCl (mL/min) to L/h: CL ≈ 0.06 × CrCl
function estimateCLFromCrCl(crcl) {
  if (!crcl || Number.isNaN(crcl)) return null;
  const cl = 0.06 * crcl; // L/h
  return clamp(cl, 1, 12); // keep in a reasonable educational range
}

// Given dailyDose (mg) and CL (L/h): AUC24 = dailyDose / CL
function estimateAUC24(dailyDoseMg, clLPerH) {
  if (!dailyDoseMg || !clLPerH) return null;
  return dailyDoseMg / clLPerH;
}

export default function InteractiveTutorial() {
  // Load initial state from session storage
  const initial = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const [activeStep, setActiveStep] = useState(initial?.activeStep ?? 0);
  const [weightKg, setWeightKg] = useState(initial?.weightKg ?? 70);
  const [crcl, setCrcl] = useState(initial?.crcl ?? 80);
  const [targetAUC, setTargetAUC] = useState(initial?.targetAUC ?? 500);
  const [mgPerKg, setMgPerKg] = useState(initial?.mgPerKg ?? 20); // loading dose 20–25 mg/kg
  const [measuredLevel, setMeasuredLevel] = useState(initial?.measuredLevel ?? 15); // mg/L

  // Persist to session storage
  useEffect(() => {
    const state = { activeStep, weightKg, crcl, targetAUC, mgPerKg, measuredLevel };
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(state)); } catch {}
  }, [activeStep, weightKg, crcl, targetAUC, mgPerKg, measuredLevel]);

  // Validation
  const weightValid = weightKg >= 20 && weightKg <= 250;
  const crclValid = crcl >= 10 && crcl <= 200;
  const aucValid = targetAUC >= 300 && targetAUC <= 800; // broader, but we show 400–600 target

  // Calculations
  const loadingDose = useMemo(() => {
    if (!weightValid) return null;
    const raw = weightKg * mgPerKg;
    // Round to nearest 250 mg for teaching visuals
    return Math.round(raw / 250) * 250;
  }, [weightKg, mgPerKg, weightValid]);

  const intervalHrs = useMemo(() => suggestedIntervalHrs(crcl), [crcl]);
  const cl = useMemo(() => estimateCLFromCrCl(crcl), [crcl]);

  // Daily dose that would hit the target AUC with our toy CL
  const dailyDoseForTarget = useMemo(() => {
    if (!cl || !aucValid) return null;
    return targetAUC * cl; // mg
  }, [targetAUC, cl, aucValid]);

  // Predicted exposure with an example fixed daily dose (e.g., 15 mg/kg q12h)
  const exampleDailyDose = useMemo(() => weightValid ? weightKg * 15 * (24 / 12) : null, [weightKg, weightValid]); // 15 mg/kg q12h
  const exampleAUC = useMemo(() => estimateAUC24(exampleDailyDose, cl), [exampleDailyDose, cl]);

  // Tiny Bayesian demo: adjust CL by ratio of predicted average concentration vs measured level
  // Predicted average concentration Cavg ≈ AUC24 / 24
  const predictedCavg = useMemo(() => (exampleAUC ? exampleAUC / 24 : null), [exampleAUC]);
  const bayesCL = useMemo(() => {
    if (!cl || !predictedCavg || !measuredLevel) return null;
    const ratio = predictedCavg / measuredLevel; // if measured is higher than expected, ratio < 1 → CL decreases
    const scaled = cl * clamp(ratio, 0.5, 2);
    return clamp(scaled, 0.5, 15);
  }, [cl, predictedCavg, measuredLevel]);
  const bayesAUC = useMemo(() => estimateAUC24(exampleDailyDose, bayesCL), [exampleDailyDose, bayesCL]);

  const steps = [
    'Basic PK',
    'First-Dose Calc',
    'AUC/MIC concept',
    'Bayesian update',
  ];

  const progress = Math.round(((activeStep + 1) / steps.length) * 100);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Interactive Vancomycin Tutorial
        </Typography>
        <Chip label={`Step ${activeStep + 1} / ${steps.length}`} color="primary" aria-label={`Progress: step ${activeStep + 1} of ${steps.length}`} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Educational demo only. All math below uses simplified toy formulas to build intuition — not for direct clinical use.
      </Typography>

      <LinearProgress variant="determinate" value={progress} aria-label="Tutorial progress" sx={{ mb: 2 }} />

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stepper activeStep={activeStep} orientation="vertical" sx={{ '& .MuiStepContent-root': { borderLeft: '2px solid #e0e0e0' } }}>
          {/* Step 1: Basic PK */}
          <Step>
            <StepLabel>{steps[0]}</StepLabel>
            <StepContent>
              <Typography sx={{ mb: 2 }}>
                Start with patient-specific inputs. Clearance often tracks renal function; here we use a toy mapping from creatinine clearance to vancomycin clearance (CL ≈ 0.06 × CrCl).
              </Typography>

              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    id="weightKg"
                    label="Weight (kg)"
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    inputProps={{ min: 20, max: 250, step: '1', 'aria-describedby': 'weight-helper' }}
                    error={!weightValid}
                    helperText={!weightValid ? 'Enter 20–250 kg' : 'Enter 20–250 kg'}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    id="crcl"
                    label="CrCl (mL/min)"
                    type="number"
                    value={crcl}
                    onChange={(e) => setCrcl(Number(e.target.value))}
                    inputProps={{ min: 10, max: 200, step: '1', 'aria-describedby': 'crcl-helper' }}
                    error={!crclValid}
                    helperText={!crclValid ? 'Enter 10–200 mL/min' : 'Enter 10–200 mL/min'}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    id="targetAuc"
                    label="Target AUC24 (mg·h/L)"
                    type="number"
                    value={targetAUC}
                    onChange={(e) => setTargetAUC(Number(e.target.value))}
                    inputProps={{ min: 300, max: 800, step: '10', 'aria-describedby': 'auc-helper' }}
                    error={!aucValid}
                    helperText={!aucValid ? 'Typical target window 400–600' : 'Typical target window 400–600'}
                    fullWidth
                  />
                </Grid>
              </Grid>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Estimated PK (educational)</Typography>
                  <Typography>Estimated CL: <b>{cl ? `${round(cl, 2)} L/h` : '—'}</b></Typography>
                  <Typography variant="body2" color="text.secondary">CL is a toy estimate, not a clinical model.</Typography>
                </CardContent>
              </Card>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="contained" onClick={() => setActiveStep(1)} disabled={!weightValid || !crclValid || !aucValid} aria-label="Next to First-Dose Calc">
                  Next
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 2: First-Dose Calc */}
          <Step>
            <StepLabel>{steps[1]}</StepLabel>
            <StepContent>
              <Typography sx={{ mb: 2 }}>
                Choose a loading dose of 20–25 mg/kg and a maintenance interval based on CrCl. This is a simplified bucketed approach for learning.
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography id="mgkg-label" sx={{ minWidth: 120 }}>Loading dose (mg/kg)</Typography>
                <Slider
                  aria-labelledby="mgkg-label"
                  value={mgPerKg}
                  min={20}
                  max={25}
                  step={1}
                  marks
                  onChange={(_, v) => setMgPerKg(v)}
                  valueLabelDisplay="on"
                  sx={{ maxWidth: 360 }}
                />
              </Box>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Loading dose</Typography>
                      <Typography>
                        {loadingDose ? <b>{loadingDose} mg</b> : '—'}
                        {loadingDose ? <span> ({mgPerKg} mg/kg)</span> : null}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Rounded to nearest 250 mg.</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Maintenance interval</Typography>
                      <Typography>
                        Suggested: <b>q{intervalHrs}h</b> based on CrCl {crclValid ? `${round(crcl,0)} mL/min` : '—'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Educational buckets: ≥100→q8h, 60–99→q12h, 30–59→q24h, 10–29→q48h.</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" onClick={() => setActiveStep(0)} aria-label="Back to Basic PK">Back</Button>
                <Button variant="contained" onClick={() => setActiveStep(2)} disabled={!weightValid || !crclValid} aria-label="Next to AUC/MIC concept">Next</Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 3: AUC/MIC concept */}
          <Step>
            <StepLabel>{steps[2]}</StepLabel>
            <StepContent>
              <Typography sx={{ mb: 2 }}>
                AUC24 reflects total exposure over 24 hours. In a simple model, AUC24 ≈ daily dose ÷ CL. Below we compare an example regimen against your target.
              </Typography>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Example regimen</Typography>
                      <Typography>Example daily dose: <b>{exampleDailyDose ? `${round(exampleDailyDose, 0)} mg/day` : '—'}</b> (15 mg/kg q12h)</Typography>
                      <Typography>Estimated CL: <b>{cl ? `${round(cl, 2)} L/h` : '—'}</b></Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography>Predicted AUC24: <b>{exampleAUC ? `${round(exampleAUC, 0)} mg·h/L` : '—'}</b></Typography>
                      <Chip
                        size="small"
                        sx={{ mt: 1 }}
                        color={exampleAUC && exampleAUC >= 400 && exampleAUC <= 600 ? 'success' : 'warning'}
                        label={`Target 400–600`}
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Dose to hit your target</Typography>
                      <Typography>Target AUC24: <b>{aucValid ? `${round(targetAUC, 0)} mg·h/L` : '—'}</b></Typography>
                      <Typography>Estimated CL: <b>{cl ? `${round(cl, 2)} L/h` : '—'}</b></Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography>Daily dose needed: <b>{dailyDoseForTarget ? `${round(dailyDoseForTarget, 0)} mg/day` : '—'}</b></Typography>
                      <Typography variant="body2" color="text.secondary">Divide by chosen interval to get dose per administration.</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" onClick={() => setActiveStep(1)} aria-label="Back to First-Dose Calc">Back</Button>
                <Button variant="contained" onClick={() => setActiveStep(3)} disabled={!exampleAUC} aria-label="Next to Bayesian update">Next</Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 4: Bayesian update */}
          <Step>
            <StepLabel>{steps[3]}</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                Educational demo: Enter a measured level (e.g., a trough). We adjust CL by the ratio of expected average concentration (AUC24/24) to the measured level.
              </Alert>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    id="measuredLevel"
                    label="Measured level (mg/L)"
                    type="number"
                    value={measuredLevel}
                    onChange={(e) => setMeasuredLevel(Number(e.target.value))}
                    inputProps={{ min: 2, max: 50, step: '0.1' }}
                    fullWidth
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Before level</Typography>
                      <Typography>Cavg ≈ AUC24/24: <b>{predictedCavg ? `${round(predictedCavg, 2)} mg/L` : '—'}</b></Typography>
                      <Typography>Predicted AUC24: <b>{exampleAUC ? `${round(exampleAUC, 0)} mg·h/L` : '—'}</b></Typography>
                      <Typography>CL: <b>{cl ? `${round(cl, 2)} L/h` : '—'}</b></Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>After Bayesian update</Typography>
                      <Typography>Measured level: <b>{measuredLevel ? `${round(measuredLevel, 2)} mg/L` : '—'}</b></Typography>
                      <Typography>Updated CL: <b>{bayesCL ? `${round(bayesCL, 2)} L/h` : '—'}</b></Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography>Updated AUC24: <b>{bayesAUC ? `${round(bayesAUC, 0)} mg·h/L` : '—'}</b></Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={() => setActiveStep(2)} aria-label="Back to AUC/MIC concept">Back</Button>
                <Button variant="contained" onClick={() => setActiveStep(0)} aria-label="Restart tutorial">Restart</Button>
                <Button
                  variant="text"
                  component={RouterLink}
                  to="/"
                  aria-label="Back to app"
                >
                  Back to App
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Paper>

      <Paper variant="outlined" sx={{ mt: 3, p: 2 }} className="clinical-disclaimer">
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Educational demo only</Typography>
        <Typography variant="body2" color="text.secondary">
          The above is a simplified, self-contained tutorial. It does not use the backend and should not be used directly for patient care.
        </Typography>
      </Paper>
    </Box>
  );
}
