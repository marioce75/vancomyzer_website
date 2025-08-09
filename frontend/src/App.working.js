import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Box,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Chip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  Link
} from '@mui/material';
import {
  Science,
  Calculate,
  Timeline,
  Info,
  Warning,
  School
} from '@mui/icons-material';

import PatientInputForm from './components/PatientInputForm';
import InteractiveAUCVisualization from './components/InteractiveAUCVisualization';
import { vancomyzerAPI, formatPatientForAPI } from './services/api';
import './App.css';
import './styles/disclaimer.css';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [patient, setPatient] = useState(null);
  const [dosingResult, setDosingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tutorial state
  const [tutorialStep, setTutorialStep] = useState(0);
  const [usePatientForTutorial, setUsePatientForTutorial] = useState(true);
  const [tutorialInputs, setTutorialInputs] = useState({
    age_years: 40,
    weight_kg: 80,
    height_cm: 172,
    sex: 'male',
    serum_creatinine: 1.0,
    target_auc: 500
  });

  // Whenever a patient is available and toggle is on, mirror values into tutorial
  React.useEffect(() => {
    if (usePatientForTutorial && patient) {
      setTutorialInputs(prev => ({
        ...prev,
        age_years: patient.age_years ?? prev.age_years,
        weight_kg: patient.weight_kg ?? prev.weight_kg,
        height_cm: patient.height_cm ?? prev.height_cm,
        sex: (patient.gender || patient.sex || prev.sex) === 'female' ? 'female' : 'male',
        serum_creatinine: patient.serum_creatinine ?? prev.serum_creatinine,
      }));
    }
  }, [usePatientForTutorial, patient]);

  // Simple teaching calculators (for tutorial only, NOT for clinical use)
  const cockcroftGault = ({ age_years, weight_kg, sex, serum_creatinine }) => {
    if (!age_years || !weight_kg || !serum_creatinine) return null;
    const scr = Math.max(Number(serum_creatinine), 0.1);
    const sexFactor = sex === 'female' ? 0.85 : 1.0;
    const crcl = (((140 - Number(age_years)) * Number(weight_kg)) / (72 * scr)) * sexFactor; // mL/min
    return Math.max(0, crcl);
  };

  // Very rough CL estimate from CrCl for demonstration only
  const estClearanceLhr = (crcl) => {
    if (crcl == null) return null;
    return (Number(crcl) * 0.06); // ~convert mL/min to L/hr (teaching approximation)
  };

  const handlePatientSubmit = async (patientData) => {
    setPatient(patientData);
    setLoading(true);
    setError(null);

    try {
      const formattedPatient = formatPatientForAPI(patientData);
      const result = await vancomyzerAPI.calculateDosing(formattedPatient);
      setDosingResult(result);
      setActiveTab(1); // Switch to results tab
    } catch (err) {
      setError(err.message || 'Failed to calculate dosing');
      console.error('Dosing calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <div className="App">
      {/* Header */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
        color: 'white',
        py: 4,
        mb: 3
      }}>
        <Container maxWidth="lg">
          <Grid container alignItems="center" spacing={2}>
            <Grid item>
              <Science sx={{ fontSize: 48 }} />
            </Grid>
            <Grid item xs>
              <Typography variant="h3" component="h1" fontWeight="bold">
                Vancomyzer
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                Interactive Evidence-Based Vancomycin Dosing Calculator
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                Following ASHP/IDSA 2020 Guidelines • Real-time AUC Visualization • Bayesian Optimization
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Error Display */}
      {error && (
        <Container maxWidth="lg" sx={{ mb: 2 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Container>
      )}

      {/* Main Content */}
      <Container maxWidth="lg">
        <Paper elevation={2}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange} 
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab 
                icon={<Calculate />} 
                label="Patient Input" 
                iconPosition="start"
              />
              <Tab 
                icon={<Timeline />} 
                label="Dosing Results" 
                iconPosition="start"
                disabled={!dosingResult}
              />
              <Tab 
                icon={<Science />} 
                label="Interactive AUC" 
                iconPosition="start"
                disabled={!dosingResult}
              />
              <Tab 
                icon={<Info />} 
                label="Clinical Info" 
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* Loading Indicator */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>
                Calculating optimal vancomycin dosing...
              </Typography>
            </Box>
          )}

          {/* Tab Panels */}
          {activeTab === 0 && (
            <Box sx={{ p: 3 }}>
              <PatientInputForm 
                onSubmit={handlePatientSubmit}
                disabled={loading}
              />
            </Box>
          )}

          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              {dosingResult ? (
                <div>
                  <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Timeline sx={{ mr: 1 }} />
                    Dosing Results
                  </Typography>
                  
                  <Grid container spacing={3}>
                    {/* Main Recommendation */}
                    <Grid item xs={12}>
                      <Card sx={{ bgcolor: 'primary.light', color: 'white' }}>
                        <CardContent>
                          <Typography variant="h4" gutterBottom>
                            {dosingResult.recommended_dose_mg} mg every {dosingResult.interval_hours} hours
                          </Typography>
                          <Typography variant="body1">
                            Daily dose: {(dosingResult.recommended_dose_mg * 24 / dosingResult.interval_hours).toFixed(0)} mg
                            {patient && ` (${(dosingResult.recommended_dose_mg * 24 / dosingResult.interval_hours / patient.weight_kg).toFixed(1)} mg/kg/day)`}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Key Metrics */}
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Predicted Parameters
                          </Typography>
                          <Box sx={{ mb: 2 }}>
                            <Chip 
                              label={`AUC₀₋₂₄: ${dosingResult.predicted_auc_24?.toFixed(0) || 'N/A'} mg·h/L`}
                              color={dosingResult.predicted_auc_24 >= 400 && dosingResult.predicted_auc_24 <= 600 ? 'success' : 'warning'}
                              sx={{ mr: 1, mb: 1 }}
                            />
                            <Chip 
                              label={`Trough: ${dosingResult.predicted_trough?.toFixed(1) || 'N/A'} mg/L`}
                              color={dosingResult.predicted_trough >= 10 && dosingResult.predicted_trough <= 20 ? 'success' : 'warning'}
                              sx={{ mr: 1, mb: 1 }}
                            />
                            <Chip 
                              label={`Half-life: ${dosingResult.half_life_hours?.toFixed(1) || 'N/A'} h`}
                              color="info"
                              sx={{ mb: 1 }}
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            Target AUC: 400-600 mg·h/L | Target Trough: 10-20 mg/L
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Monitoring */}
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Monitoring Guidelines
                          </Typography>
                          <Typography variant="body2" paragraph>
                            • Draw levels before 4th dose (steady state)
                          </Typography>
                          <Typography variant="body2" paragraph>
                            • Monitor renal function every 2-3 days
                          </Typography>
                          <Typography variant="body2">
                            • Assess clinical response daily
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Warnings */}
                    {dosingResult.safety_warnings && dosingResult.safety_warnings.length > 0 && (
                      <Grid item xs={12}>
                        <Alert severity="warning">
                          <Typography variant="subtitle2" gutterBottom>
                            Safety Warnings:
                          </Typography>
                          {dosingResult.safety_warnings.map((warning, idx) => (
                            <Typography key={idx} variant="body2">
                              • {warning}
                            </Typography>
                          ))}
                        </Alert>
                      </Grid>
                    )}

                    {/* Simple AUC Visualization */}
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            AUC Analysis
                          </Typography>
                          {dosingResult.predicted_auc_24 && (
                            <Box>
                              <Typography variant="body1" paragraph>
                                Predicted AUC₀₋₂₄: <strong>{dosingResult.predicted_auc_24.toFixed(0)} mg·h/L</strong>
                              </Typography>
                              <Box sx={{ width: '100%', bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden', mb: 2 }}>
                                <Box 
                                  sx={{ 
                                    width: `${Math.min((dosingResult.predicted_auc_24 / 600) * 100, 100)}%`,
                                    height: 20,
                                    bgcolor: dosingResult.predicted_auc_24 >= 400 && dosingResult.predicted_auc_24 <= 600 ? 'success.main' : 'warning.main',
                                    transition: 'width 0.5s ease'
                                  }} 
                                />
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                Target Range: 400-600 mg·h/L (shown as green zone)
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </div>
              ) : (
                <Typography color="text.secondary" align="center">
                  Please calculate dosing from the Patient Input tab first.
                </Typography>
              )}
            </Box>
          )}

          {activeTab === 2 && (
            <Box sx={{ p: 3 }}>
              {dosingResult ? (
                <InteractiveAUCVisualization
                  dosingResult={dosingResult}
                  patient={patient}
                  onParameterChange={(params) => {
                    console.log('Real-time parameter change:', params);
                    // Could update state or trigger re-calculations here
                  }}
                />
              ) : (
                <Typography color="text.secondary" align="center">
                  Please calculate dosing first to view interactive AUC visualization.
                </Typography>
              )}
            </Box>
          )}

          {activeTab === 3 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <School sx={{ mr: 1 }} /> Interactive Tutorial
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                A hands-on walkthrough from basic vancomycin pharmacokinetics to AUC-based strategies and a conceptual Bayesian update. 
                This tutorial is for education only and does not replace clinical judgment.
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={usePatientForTutorial}
                    onChange={(e) => setUsePatientForTutorial(e.target.checked)}
                  />
                }
                label="Use current patient values when available"
              />

              <Grid container spacing={2} sx={{ mt: 1, mb: 2 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Age (years)"
                    fullWidth
                    type="number"
                    value={tutorialInputs.age_years}
                    onChange={(e) => setTutorialInputs({ ...tutorialInputs, age_years: Number(e.target.value) })}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Weight (kg)"
                    fullWidth
                    type="number"
                    value={tutorialInputs.weight_kg}
                    onChange={(e) => setTutorialInputs({ ...tutorialInputs, weight_kg: Number(e.target.value) })}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Height (cm)"
                    fullWidth
                    type="number"
                    value={tutorialInputs.height_cm}
                    onChange={(e) => setTutorialInputs({ ...tutorialInputs, height_cm: Number(e.target.value) })}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Sex"
                    select
                    fullWidth
                    value={tutorialInputs.sex}
                    onChange={(e) => setTutorialInputs({ ...tutorialInputs, sex: e.target.value })}
                    SelectProps={{ native: true }}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Serum Creatinine (mg/dL)"
                    fullWidth
                    type="number"
                    inputProps={{ step: 0.1 }}
                    value={tutorialInputs.serum_creatinine}
                    onChange={(e) => setTutorialInputs({ ...tutorialInputs, serum_creatinine: Number(e.target.value) })}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Target AUC₀₋₂₄ (mg·h/L)"
                    fullWidth
                    type="number"
                    value={tutorialInputs.target_auc}
                    onChange={(e) => setTutorialInputs({ ...tutorialInputs, target_auc: Number(e.target.value) })}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ mb: 2 }} />

              <Stepper activeStep={tutorialStep} orientation="vertical">
                <Step>
                  <StepLabel>Basic PK Concepts</StepLabel>
                  <StepContent>
                    <Typography sx={{ mb: 1 }}>
                      Vancomycin exposure is often summarized as AUC₀₋₂₄ (area under the concentration–time curve over 24 h). 
                      Clinical targets commonly aim for 400–600 mg·h/L. Loading doses are typically weight-based.
                    </Typography>
                    <Button variant="contained" onClick={() => setTutorialStep(1)}>Next</Button>
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel>Cockcroft–Gault (CrCl) — teaching calculator</StepLabel>
                  <StepContent>
                    {(() => {
                      const crcl = cockcroftGault(tutorialInputs);
                      return (
                        <Box>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            Estimated CrCl ≈ <strong>{crcl ? crcl.toFixed(0) : '—'}</strong> mL/min
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                            Formula: ((140 − age) × weight) / (72 × SCr) × (0.85 if female)
                          </Typography>
                          <Button onClick={() => setTutorialStep(2)}>Next</Button>
                        </Box>
                      );
                    })()}
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel>Loading Dose (teaching example)</StepLabel>
                  <StepContent>
                    <Typography gutterBottom>
                      A simple rule of thumb is 20–25 mg/kg. Adjust per institution policy.
                    </Typography>
                    <Slider
                      min={15}
                      max={30}
                      step={1}
                      valueLabelDisplay="auto"
                      value={Math.round((tutorialInputs.loading_per_kg || 25))}
                      onChange={(_, v) => setTutorialInputs({ ...tutorialInputs, loading_per_kg: Number(v) })}
                    />
                    <Typography sx={{ mt: 1 }}>
                      Suggested loading dose ≈ <strong>{Math.round((tutorialInputs.loading_per_kg || 25) * (tutorialInputs.weight_kg || 0))} mg</strong>
                    </Typography>
                    <Button sx={{ mt: 1 }} onClick={() => setTutorialStep(3)}>Next</Button>
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel>Maintenance Dose from AUC target (teaching example)</StepLabel>
                  <StepContent>
                    {(() => {
                      const crcl = cockcroftGault(tutorialInputs);
                      const cl = estClearanceLhr(crcl);
                      const dose24 = cl && tutorialInputs.target_auc ? cl * tutorialInputs.target_auc : null; // mg/day
                      const interval = 12; // show example q12h
                      const perDose = dose24 ? Math.round(dose24 / (24 / interval)) : null;
                      return (
                        <Box>
                          <Typography gutterBottom>
                            Very rough daily dose estimate (for teaching): Dose₍24h₎ ≈ CL × AUC.
                          </Typography>
                          <Typography variant="body2">Estimated CL ≈ {cl ? cl.toFixed(1) : '—'} L/h</Typography>
                          <Typography variant="body2">Daily dose ≈ {dose24 ? Math.round(dose24) : '—'} mg/day</Typography>
                          <Typography variant="body2">Example q12h dose ≈ {perDose ? perDose : '—'} mg</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                            This section demonstrates relationships only and is not a clinical recommendation.
                          </Typography>
                          <Button sx={{ mt: 1 }} onClick={() => setTutorialStep(4)}>Next</Button>
                        </Box>
                      );
                    })()}
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel>AUC Monitoring</StepLabel>
                  <StepContent>
                    <Typography gutterBottom>
                      In practice, measured concentrations refine the model. Keeping AUC in the 400–600 range helps balance efficacy and safety.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Tip: Use the Interactive AUC tab to visualize how interval and dose change predicted exposure.
                    </Typography>
                    <Button onClick={() => setTutorialStep(5)}>Next</Button>
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel>Bayesian Update (concept)</StepLabel>
                  <StepContent>
                    <Typography gutterBottom>
                      Bayesian dosing combines prior population PK with your patient’s levels to update parameters and dosing.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      This app’s production calculator performs model-based predictions; here we only illustrate the concept.
                    </Typography>
                    <Button variant="outlined" onClick={() => setTutorialStep(0)}>Restart tutorial</Button>
                  </StepContent>
                </Step>
              </Stepper>

              <Divider sx={{ mt: 2, mb: 1 }} />
              <Typography variant="caption" color="text.secondary">
                Educational content only. See ASHP/IDSA 2020 guidance and your local policies.{' '}
                <Link href="https://www.ashp.org/" target="_blank" rel="noreferrer">ASHP</Link>
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Clinical Disclaimer */}
        <div className="clinical-disclaimer" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Warning className="clinical-disclaimer__icon" />
            <h4 className="clinical-disclaimer__title">Clinical Disclaimer</h4>
          </div>
          <p>
            Vancomyzer is intended for use by qualified healthcare professionals as a clinical 
            decision support tool. All dosing recommendations should be reviewed by appropriate 
            clinical staff and adjusted based on patient-specific factors and clinical judgment.
          </p>
        </div>

        {/* Footer */}
        <Box sx={{ mt: 4, py: 3, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            © 2024 Vancomyzer • Evidence-based vancomycin dosing calculator
          </Typography>
        </Box>
      </Container>
    </div>
  );
}

export default App;