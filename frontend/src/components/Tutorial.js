import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import References from './References';

// Lightweight reuse of logic from InteractiveTutorial.js (simplified & embedded)
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const round = (v, dp = 0) => { if (v === null || v === undefined || Number.isNaN(v)) return ''; const m = Math.pow(10, dp); return Math.round(v * m) / m; };
const suggestedIntervalHrs = (crcl) => {
  if (crcl >= 100) return 8;
  if (crcl >= 60) return 12;
  if (crcl >= 30) return 24;
  return 48;
};
const estimateCLFromCrCl = (crcl) => { if (!crcl || Number.isNaN(crcl)) return null; const cl = 0.06 * crcl; return clamp(cl, 1, 12); };
const estimateAUC24 = (dailyDoseMg, clLPerH) => { if (!dailyDoseMg || !clLPerH) return null; return dailyDoseMg / clLPerH; };

export default function Tutorial() {
  const [weightKg, setWeightKg] = React.useState(70);
  const [crcl, setCrcl] = React.useState(80);
  const [targetAUC, setTargetAUC] = React.useState(500);
  const [mgPerKg, setMgPerKg] = React.useState(20);
  const [measuredLevel, setMeasuredLevel] = React.useState(15);

  const weightValid = weightKg >= 20 && weightKg <= 250;
  const crclValid = crcl >= 10 && crcl <= 200;
  const aucValid = targetAUC >= 300 && targetAUC <= 800;

  const loadingDose = React.useMemo(() => {
    if (!weightValid) return null; const raw = weightKg * mgPerKg; return Math.round(raw / 250) * 250;
  }, [weightValid, weightKg, mgPerKg]);
  const intervalHrs = React.useMemo(() => suggestedIntervalHrs(crcl), [crcl]);
  const cl = React.useMemo(() => estimateCLFromCrCl(crcl), [crcl]);
  const dailyDoseForTarget = React.useMemo(() => { if (!cl || !aucValid) return null; return targetAUC * cl; }, [cl, aucValid, targetAUC]);
  const exampleDailyDose = React.useMemo(() => weightValid ? weightKg * 15 * (24 / 12) : null, [weightValid, weightKg]);
  const exampleAUC = React.useMemo(() => estimateAUC24(exampleDailyDose, cl), [exampleDailyDose, cl]);
  const predictedCavg = React.useMemo(() => (exampleAUC ? exampleAUC / 24 : null), [exampleAUC]);
  const bayesCL = React.useMemo(() => {
    if (!cl || !predictedCavg || !measuredLevel) return null; const ratio = predictedCavg / measuredLevel; const scaled = cl * clamp(ratio, 0.5, 2); return clamp(scaled, 0.5, 15);
  }, [cl, predictedCavg, measuredLevel]);
  const bayesAUC = React.useMemo(() => estimateAUC24(exampleDailyDose, bayesCL), [exampleDailyDose, bayesCL]);

  return (
    <Box component="main" sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <section aria-labelledby="tut-intro">
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>Tutorial</Typography>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h5" id="tut-intro" sx={{ fontWeight: 600, mb: 1 }}>How to Use Vancomyzer</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Brief overview of steps to generate and interpret evidence-based vancomycin dosing.
            </Typography>
            <ol style={{ marginTop: 0, paddingLeft: '1.25rem' }}>
              <li>Enter demographics, renal function, and indication.</li>
              <li>Click <b>Calculate Dosing</b> to view recommended regimen, predicted AUC and trough.</li>
              <li>Use visualization to explore what-if dose/interval scenarios.</li>
              <li>Optionally enter measured levels to perform Bayesian optimization.</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="tut-step-by-step">
        <Typography variant="h5" id="tut-step-by-step" sx={{ fontWeight: 600, mb: 2 }}>Step-by-Step</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>1. Basic PK Inputs</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Simplified educational model mapping renal function to clearance.
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={4}>
                    <TextField label="Weight (kg)" type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))} error={!weightValid} helperText={!weightValid? '20–250' : ' '} fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField label="CrCl (mL/min)" type="number" value={crcl} onChange={e=>setCrcl(Number(e.target.value))} error={!crclValid} helperText={!crclValid? '10–200' : ' '} fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField label="Target AUC24" type="number" value={targetAUC} onChange={e=>setTargetAUC(Number(e.target.value))} error={!aucValid} helperText={!aucValid? '300–800' : ' '} fullWidth />
                  </Grid>
                </Grid>
                <Typography variant="body2">Estimated CL: <b>{cl? `${round(cl,2)} L/h` : '—'}</b></Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>2. Loading Dose & Interval</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Educational buckets; real engine performs full PK.</Typography>
                <Typography id="mgkg-label" variant="body2" sx={{ mb: 1 }}>Loading dose (mg/kg)</Typography>
                <Slider aria-labelledby="mgkg-label" value={mgPerKg} onChange={(_,v)=>setMgPerKg(v)} min={20} max={25} step={1} marks valueLabelDisplay="on" sx={{ mb: 2 }} />
                <Typography>Loading dose: <b>{loadingDose? `${loadingDose} mg` : '—'}</b></Typography>
                <Typography>Suggested interval: <b>q{intervalHrs}h</b></Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>3. AUC Concept</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>AUC24 ≈ daily dose ÷ CL (simplified one-compartment).</Typography>
                <Typography>Example daily dose (15 mg/kg q12h): <b>{exampleDailyDose? `${round(exampleDailyDose,0)} mg` : '—'}</b></Typography>
                <Typography>Predicted AUC24: <b>{exampleAUC? `${round(exampleAUC,0)} mg·h/L` : '—'}</b></Typography>
                <Chip size="small" sx={{ mt: 1 }} color={exampleAUC && exampleAUC>=400 && exampleAUC<=600 ? 'success' : 'warning'} label="Target 400–600" />
                <Divider sx={{ my: 2 }} />
                <Typography>Daily dose needed for your target: <b>{dailyDoseForTarget? `${round(dailyDoseForTarget,0)} mg` : '—'}</b></Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>4. Bayesian Update (Toy)</Typography>
                <Alert severity="info" sx={{ mb: 2 }}>Adjust clearance using ratio of expected vs measured average concentration.</Alert>
                <TextField label="Measured level (mg/L)" type="number" value={measuredLevel} onChange={e=>setMeasuredLevel(Number(e.target.value))} fullWidth sx={{ mb: 2 }} />
                <Typography>Original CL: <b>{cl? `${round(cl,2)} L/h` : '—'}</b></Typography>
                <Typography>Updated CL: <b>{bayesCL? `${round(bayesCL,2)} L/h` : '—'}</b></Typography>
                <Divider sx={{ my: 1 }} />
                <Typography>Updated AUC24: <b>{bayesAUC? `${round(bayesAUC,0)} mg·h/L` : '—'}</b></Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </section>

      <section aria-labelledby="tut-tips" style={{ marginTop: '2rem' }}>
        <Typography variant="h5" id="tut-tips" sx={{ fontWeight: 600, mb: 1 }}>Tips & Common Pitfalls</Typography>
        <ul style={{ marginTop: 0, paddingLeft: '1.25rem' }}>
          <li>AUC goal typically 400–600 mg·h/L for serious MRSA infections (2020 consensus).</li>
          <li>Reassess renal function; trough alone is not a surrogate for AUC.</li>
          <li>Use a loading dose in severe infections or high inoculum states (e.g., endocarditis, meningitis).</li>
        </ul>
      </section>

      <section aria-labelledby="tut-refs" style={{ marginTop: '2rem' }}>
        <Typography variant="h5" id="tut-refs" sx={{ fontWeight: 600, mb: 1 }}>References</Typography>
        <References />
      </section>

      <Paper variant="outlined" sx={{ mt: 4, p: 2 }} role="note" aria-label="Educational disclaimer">
        <Typography variant="body2" color="text.secondary">
          Educational model only. Production dosing calculations use a more comprehensive PK engine and Bayesian optimization when levels are entered.
        </Typography>
      </Paper>
    </Box>
  );
}
