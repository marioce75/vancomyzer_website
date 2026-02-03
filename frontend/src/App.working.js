import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { BrowserRouter, Routes, Route, Link as RouterLink } from 'react-router-dom';
import { vancomyzerAPI } from './services/api';
import InteractiveAUCVisualization from './components/InteractiveAUCVisualization';
import './App.css';

const buildDosePayload = (state) => {
  const patient = {
    age_years: Number(state.age) || 0,
    weight_kg: Number(state.weight) || 0,
    height_cm: state.height ? Number(state.height) : null,
    sex: state.sex,
    serum_creatinine: Number(state.scr) || 0,
    serious_infection: state.serious,
  };

  const levels = [];
  const infusion = state.infusionHours ? Number(state.infusionHours) : 1;
  const doseGiven = state.doseGiven ? Number(state.doseGiven) : null;

  if (state.usePeak) {
    levels.push({
      level_mg_l: Number(state.peakLevel) || 0,
      time_hours: Number(state.peakTime) || 0,
      level_type: 'peak',
      dose_mg: doseGiven,
      infusion_hours: infusion,
    });
  }

  if (state.useTrough) {
    levels.push({
      level_mg_l: Number(state.troughLevel) || 0,
      time_hours: Number(state.troughTime) || 0,
      level_type: 'trough',
      dose_mg: doseGiven,
      infusion_hours: infusion,
    });
  }

  return { patient, levels: levels.length ? levels : null };
};

const CalculatorPage = ({ onResult }) => {
  const [form, setForm] = useState({
    age: '',
    weight: '',
    height: '',
    scr: '',
    sex: 'male',
    serious: false,
    usePeak: false,
    useTrough: false,
    peakLevel: '',
    peakTime: '',
    troughLevel: '',
    troughTime: '',
    doseGiven: '',
    infusionHours: '1',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field) => (event) => {
    const value = field === 'serious' || field === 'usePeak' || field === 'useTrough'
      ? event.target.checked
      : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = buildDosePayload(form);
    try {
      const response = payload.levels
        ? await vancomyzerAPI.bayesianDose(payload)
        : await vancomyzerAPI.calculateDose(payload);
      onResult(response, payload.patient);
    } catch (err) {
      setError(err.message || 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h3" fontWeight="700" gutterBottom>
        Vancomyzer
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        AUC/MIC ≥ 400 mg·h/L target. Avoid AUC &gt; 800 mg·h/L.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField label="Age (years)" value={form.age} onChange={handleChange('age')} fullWidth />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Weight (kg)" value={form.weight} onChange={handleChange('weight')} fullWidth />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Height (cm)" value={form.height} onChange={handleChange('height')} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Sex (male/female)" value={form.sex} onChange={handleChange('sex')} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="SCr (mg/dL)" value={form.scr} onChange={handleChange('scr')} fullWidth />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={form.serious} onChange={handleChange('serious')} />}
                label="Serious/invasive infection (include loading dose)"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            Optional Bayesian input
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={<Checkbox checked={form.usePeak} onChange={handleChange('usePeak')} />}
                label="Peak level available"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={<Checkbox checked={form.useTrough} onChange={handleChange('useTrough')} />}
                label="Trough level available"
              />
            </Grid>

            {(form.usePeak || form.useTrough) && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField label="Dose given (mg)" value={form.doseGiven} onChange={handleChange('doseGiven')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Infusion hours" value={form.infusionHours} onChange={handleChange('infusionHours')} fullWidth />
                </Grid>
              </>
            )}

            {form.usePeak && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField label="Peak level (mg/L)" value={form.peakLevel} onChange={handleChange('peakLevel')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Peak time (hours after dose start)" value={form.peakTime} onChange={handleChange('peakTime')} fullWidth />
                </Grid>
              </>
            )}

            {form.useTrough && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField label="Trough level (mg/L)" value={form.troughLevel} onChange={handleChange('troughLevel')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Trough time (hours after dose start)" value={form.troughTime} onChange={handleChange('troughTime')} fullWidth />
                </Grid>
              </>
            )}
          </Grid>

          <Button type="submit" variant="contained" sx={{ mt: 3 }} disabled={loading}>
            {loading ? 'Calculating…' : 'Calculate'}
          </Button>

          <Box sx={{ mt: 2 }}>
            <Link component={RouterLink} to="/advanced" underline="hover">
              Advanced AUC/PK visualization
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

const ResultsPanel = ({ result }) => {
  if (!result) {
    return (
      <Alert severity="info" sx={{ mt: 3 }}>
        Enter patient data to calculate a regimen.
      </Alert>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Recommended regimen
      </Typography>
      <Typography variant="body1">
        Loading dose: {result.loading_dose_mg ? `${result.loading_dose_mg} mg` : 'Not indicated'}
      </Typography>
      <Typography variant="body1">
        Maintenance: {result.maintenance_dose_mg} mg every {result.interval_hours} hours
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2">Predicted peak: {result.predicted_peak_mg_l.toFixed(1)} mg/L</Typography>
        <Typography variant="body2">Predicted trough: {result.predicted_trough_mg_l.toFixed(1)} mg/L</Typography>
        <Typography variant="body2">AUC₀₋₂₄: {result.predicted_auc_24.toFixed(0)} mg·h/L</Typography>
      </Box>
    </Paper>
  );
};

const AdvancedPage = ({ result, patient }) => {
  if (!result || !patient) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="info">Calculate a regimen on the home page first.</Alert>
        <Box sx={{ mt: 2 }}>
          <Link component={RouterLink} to="/" underline="hover">
            Back to calculator
          </Link>
        </Box>
      </Container>
    );
  }

  const dosingResult = {
    recommended_dose_mg: result.maintenance_dose_mg,
    interval_hours: result.interval_hours,
    predicted_auc_24: result.predicted_auc_24,
    predicted_trough: result.predicted_trough_mg_l,
    clearance_l_per_h: result.k_e * result.vd_l,
    half_life_hours: result.half_life_hours,
    volume_distribution_l: result.vd_l,
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/" underline="hover">
          Back to calculator
        </Link>
      </Box>
      <InteractiveAUCVisualization dosingResult={dosingResult} patient={patient} />
    </Container>
  );
};

function App() {
  const [result, setResult] = useState(null);
  const [patient, setPatient] = useState(null);

  const handleResult = (data, patientInfo) => {
    setResult(data);
    setPatient(patientInfo);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <CalculatorPage onResult={handleResult} />
              <Container maxWidth="md">
                <ResultsPanel result={result} />
              </Container>
            </>
          }
        />
        <Route path="/advanced" element={<AdvancedPage result={result} patient={patient} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;