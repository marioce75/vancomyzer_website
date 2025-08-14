// App.js
import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Box,
  Tabs,
  Tab,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Science,
  Calculate,
  Timeline,
  Info,
  Warning
} from '@mui/icons-material';
import MenuBook from '@mui/icons-material/MenuBook';

import PatientInputForm from './components/PatientInputForm';
import InteractiveAUCVisualization from './components/InteractiveAUCVisualization';
import ClinicalInfo from './components/ClinicalInfo';
import Tutorial from './components/Tutorial';
import { BayesianProvider, useBayesian } from './context/BayesianContext';
import './App.css';
import './styles/disclaimer.css';

function AppInner() {
  const [activeTab, setActiveTab] = useState(0);
  const { setPatient, result, loading, calculate } = useBayesian();
  const [error, setError] = useState(null);

  const handlePatientSubmit = async (patientData) => {
    try {
      setError(null);
      setPatient(patientData);
      // Defer calculate to next tick so state is committed; pass patientData as override to avoid race
      setTimeout(() => { calculate(patientData).catch(e => setError(e.message || 'Calculation failed')); }, 0);
      setActiveTab(1);
    } catch (e) {
      setError(e.message || 'Submission failed');
    }
  };
  const handleTabChange = (event, newValue) => { setActiveTab(newValue); };

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
          <Alert severity="error">{error}</Alert>
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
              <Tab icon={<Calculate />} label="Patient Input" iconPosition="start" />
              <Tab icon={<Timeline />} label="Dosing Results" iconPosition="start" disabled={!result} />
              <Tab icon={<Science />} label="Interactive AUC" iconPosition="start" disabled={!result || (result?.meta?.source === 'population')} />
              <Tab icon={<MenuBook />} label="Tutorial" iconPosition="start" />
              <Tab icon={<Info />} label="Clinical Info" iconPosition="start" />
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
              <PatientInputForm onSubmit={handlePatientSubmit} disabled={loading} />
            </Box>
          )}
          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              {result ? (
                <div>
                  <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Timeline sx={{ mr: 1 }} />
                    Dosing Results
                  </Typography>

                  {/* Indicate whether we used Bayesian optimization or population fallback */}
                  {(() => {
                    const meta = result.meta || {};
                    const inferredSource =
                      meta.source ||
                      result.source ||
                      result.model_source ||
                      (result.usedBayesian === false ? 'population' : (result.usedBayesian === true ? 'bayesian' : null));

                    if (inferredSource === 'population') {
                      return (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          No vancomycin levels were provided. The recommendation is based on the
                          <strong> population PK model</strong>. Add one or more measured levels to enable
                          Bayesian individualization.
                        </Alert>
                      );
                    }
                    if (inferredSource === 'bayesian') {
                      return (
                        <Alert severity="success" sx={{ mb: 2 }}>
                          Results individualized using <strong>Bayesian optimization</strong>.
                        </Alert>
                      );
                    }
                    return null;
                  })()}

                  {/* Summary preview for quick verification */}
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(
                      {
                        auc24: result.auc24,
                        cmin: result.cmin,
                        cmax: result.cmax,
                        recommendation: result.recommendation,
                      },
                      null,
                      2
                    )}
                  </pre>
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
              {result ? (
                <InteractiveAUCVisualization />
              ) : (
                <Typography color="text.secondary" align="center">
                  Please calculate dosing first to view interactive AUC visualization.
                </Typography>
              )}
            </Box>
          )}
          {activeTab === 3 && (
            <Box sx={{ p: 3 }}>
              <Tutorial />
            </Box>
          )}
          {activeTab === 4 && (
            <Box sx={{ p: 3 }}>
              <ClinicalInfo />
            </Box>
          )}
        </Paper>

        {/* Clinical Disclaimer */}
        <div className="clinical-disclaimer" role="note" aria-labelledby="clinical-disclaimer-title" style={{ marginTop: 24 }}>
          <div className="clinical-disclaimer__header">
            <Warning className="clinical-disclaimer__icon" aria-hidden="true" focusable="false" />
            <h4 className="clinical-disclaimer__title" id="clinical-disclaimer-title">Clinical Disclaimer</h4>
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

function App(){
  return (
    <BayesianProvider>
      <AppInner />
    </BayesianProvider>
  );
}

export default App;
