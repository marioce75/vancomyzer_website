import React, { useState, useEffect, useCallback } from 'react';
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
  Fab
} from '@mui/material';
import {
  Timeline,
  Calculate,
  TrendingUp,
  Science,
  Warning,
  Info,
  Help
} from '@mui/icons-material';

import PatientInputForm from './components/PatientInputForm';
import PKVisualization from './components/PKVisualization';
import BayesianOptimization from './components/BayesianOptimization';
import DosingResults from './components/DosingResults';
import CalculationExplanation from './components/CalculationExplanation';
import ClinicalGuidelines from './components/ClinicalGuidelines';
import RealTimeCalculator from './components/RealTimeCalculator';
import { vancomyzerAPI } from './services/api';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [patient, setPatient] = useState(null);
  const [dosingResult, setDosingResult] = useState(null);
  const [bayesianResult, setBayesianResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [realTimeMode, setRealTimeMode] = useState(false);

  // Real-time calculation state
  const [realTimeDose, setRealTimeDose] = useState(1000);
  const [realTimeInterval, setRealTimeInterval] = useState(12);
  const [realTimeData, setRealTimeData] = useState(null);

  const handlePatientSubmit = useCallback(async (patientData) => {
    setPatient(patientData);
    setLoading(true);
    setError(null);

    try {
      const result = await vancomyzerAPI.calculateDosing(patientData);
      setDosingResult(result);
      setActiveTab(1); // Switch to results tab
    } catch (err) {
      setError(err.message || 'Failed to calculate dosing');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBayesianOptimization = useCallback(async (levels) => {
    if (!patient) {
      setError('Please enter patient information first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await vancomyzerAPI.bayesianOptimization(patient, levels);
      setBayesianResult(result);
      setActiveTab(2); // Switch to Bayesian tab
    } catch (err) {
      setError(err.message || 'Failed to perform Bayesian optimization');
    } finally {
      setLoading(false);
    }
  }, [patient]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const toggleRealTimeMode = () => {
    setRealTimeMode(!realTimeMode);
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
            <Grid item>
              <Fab 
                color="secondary" 
                onClick={toggleRealTimeMode}
                sx={{ mr: 2 }}
              >
                <TrendingUp />
              </Fab>
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
                disabled={!dosingResult && !realTimeMode}
              />
              <Tab 
                icon={<Science />} 
                label="Bayesian Optimization" 
                iconPosition="start"
                disabled={!patient}
              />
              <Tab 
                icon={<TrendingUp />} 
                label="PK Visualization" 
                iconPosition="start"
                disabled={!dosingResult && !realTimeData}
              />
              <Tab 
                icon={<Info />} 
                label="Calculations" 
                iconPosition="start"
                disabled={!dosingResult}
              />
              <Tab 
                icon={<Help />} 
                label="Guidelines" 
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
              {realTimeMode ? (
                <RealTimeCalculator
                  patient={patient}
                  onDoseChange={setRealTimeDose}
                  onIntervalChange={setRealTimeInterval}
                  onDataUpdate={setRealTimeData}
                />
              ) : (
                dosingResult && (
                  <DosingResults 
                    result={dosingResult}
                    patient={patient}
                  />
                )
              )}
            </Box>
          )}

          {activeTab === 2 && (
            <Box sx={{ p: 3 }}>
              <BayesianOptimization
                patient={patient}
                onOptimize={handleBayesianOptimization}
                result={bayesianResult}
                disabled={loading}
              />
            </Box>
          )}

          {activeTab === 3 && (
            <Box sx={{ p: 3 }}>
              <PKVisualization
                dosingResult={dosingResult}
                bayesianResult={bayesianResult}
                realTimeData={realTimeData}
                patient={patient}
              />
            </Box>
          )}

          {activeTab === 4 && (
            <Box sx={{ p: 3 }}>
              <CalculationExplanation
                dosingResult={dosingResult}
                patient={patient}
              />
            </Box>
          )}

          {activeTab === 5 && (
            <Box sx={{ p: 3 }}>
              <ClinicalGuidelines />
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
              Always follow your institution's protocols and current clinical guidelines.
            </Typography>
          </CardContent>
        </Card>

        {/* Footer */}
        <Box sx={{ mt: 4, py: 3, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            © 2024 Vancomyzer • Evidence-based vancomycin dosing calculator
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Following ASHP/IDSA 2020 Guidelines • Built with clinical expertise
          </Typography>
        </Box>
      </Container>
    </div>
  );
}

export default App;