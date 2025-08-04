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
  Chip
} from '@mui/material';
import {
  Science,
  Calculate,
  Timeline,
  Info,
  Warning
} from '@mui/icons-material';

import PatientInputForm from './components/PatientInputForm';
import PKVisualization from './components/PKVisualization.enhanced';
import { vancomyzerAPI, formatPatientForAPI } from './services/api';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [patient, setPatient] = useState(null);
  const [dosingResult, setDosingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
                label="PK Visualization" 
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
                <PKVisualization
                  dosingResult={dosingResult}
                  bayesianResult={null}
                  realTimeData={null}
                  patient={patient}
                />
              ) : (
                <Typography color="text.secondary" align="center">
                  Please calculate dosing first to view visualizations.
                </Typography>
              )}
            </Box>
          )}

          {activeTab === 3 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Clinical Information
              </Typography>
              <Typography variant="body1" paragraph>
                Vancomyzer follows the ASHP/IDSA 2020 guidelines for vancomycin therapeutic monitoring.
              </Typography>
              <Typography variant="body2">
                <strong>Key Principles:</strong>
              </Typography>
              <Typography variant="body2" component="ul" sx={{ mt: 1 }}>
                <li>AUC-based dosing is preferred over trough-based dosing</li>
                <li>Target AUC₀₋₂₄: 400-600 mg·h/L for serious MRSA infections</li>
                <li>Trough levels should be kept below 20 mg/L to minimize toxicity</li>
                <li>Monitor renal function and hearing for long-term therapy</li>
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Clinical Disclaimer */}
        <Card sx={{ mt: 3, bgcolor: 'warning.light' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Warning sx={{ mr: 1, color: 'warning.dark' }} />
              <Typography variant="h6" color="warning.dark">
                Clinical Disclaimer
              </Typography>
            </Box>
            <Typography variant="body2" color="warning.dark">
              Vancomyzer is intended for use by qualified healthcare professionals as a clinical 
              decision support tool. All dosing recommendations should be reviewed by appropriate 
              clinical staff and adjusted based on patient-specific factors and clinical judgment.
            </Typography>
          </CardContent>
        </Card>

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