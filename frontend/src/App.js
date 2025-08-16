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
import ClinicalInfo from './components/ClinicalInfo';
import Tutorial from './components/Tutorial';
import { BayesianProvider, useBayesian } from './context/BayesianContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import CssBaseline from '@mui/material/CssBaseline';
import { normalizePatientFields } from './services/normalizePatient';

import './App.css';
import './styles/disclaimer.css';
import DosingResults from './components/DosingResults.jsx';
import InteractiveAUC from './components/InteractiveAUC.jsx';

function AppInner() {
  const { calculate, lastResult, error, isLoading, lastPatient, setInitialRegimen, initialRegimen } = useBayesian();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [validationMessage, setValidationMessage] = useState(null);

  React.useEffect(() => {
    if (lastResult && !error) {
      setValidationMessage(null);
    }
  }, [lastResult, error]);

  const handlePatientSubmit = async (patientData) => {
    const normalized = normalizePatientFields(patientData);
    console.debug('[App] normalized patient for submit:', normalized);
    // Validation guard (minimal required fields; adjust as needed)
    const required = ['age_years', 'weight_kg', 'serum_creatinine', 'height_cm'];
    const missing = required.filter((f) => normalized[f] === undefined);
    if (missing.length) {
      setValidationMessage(t('notices.missingRequiredBanner'));
      return; // block calculate
    }
    setValidationMessage(null);
    try {
      await calculate({ ...normalized, levels: normalized.levels || normalized.vancomycin_levels || [] });
      setActiveTab(1);
    } catch (e) {
      console.error('Calculation failed', e);
    }
  };

  const handleTabChange = (event, newValue) => { setActiveTab(newValue); };

  // Jump to interactive with regimen from lastResult
  const openInteractiveAUC = () => {
    if (!lastPatient || !lastResult) return;
    const regimen = {
      dose_mg: lastResult.recommended_dose_mg,
      interval_hours: lastResult.interval_hours,
      infusion_minutes: lastResult.infusion_minutes ?? 60
    };
    setInitialRegimen(regimen);
    setActiveTab(2);
  };

  return (
    <div className="App">
      {/* Header */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
        color: 'white',
        py: 4,
        mb: 3,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Container maxWidth="lg">
          <Grid container alignItems="center" spacing={2}>
            <Grid item>
              <Science sx={{ fontSize: 48 }} />
            </Grid>
            <Grid item xs>
              <Typography variant="h3" component="h1" fontWeight="bold">
                {t('app.title')}
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                {t('app.subtitle')}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                {t('app.tagline')}
              </Typography>
            </Grid>
            <Grid item>
              <LanguageSwitcher />
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
      {validationMessage && (
        <Container maxWidth="lg" sx={{ mb: 2 }}>
          <Alert severity="warning">{validationMessage}</Alert>
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
              <Tab icon={<Calculate />} label={t('tabs.patientInput')} iconPosition="start" />
              <Tab icon={<Timeline />} label={t('tabs.dosingResults')} iconPosition="start" disabled={!lastResult} />
              <Tab icon={<Science />} label={t('tabs.interactiveAUC')} iconPosition="start" disabled={!lastResult} />
              <Tab icon={<MenuBook />} label={t('tabs.tutorial')} iconPosition="start" />
              <Tab icon={<Info />} label={t('tabs.clinicalInfo')} iconPosition="start" />
            </Tabs>
          </Box>

          {/* Loading Indicator */}
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>
                {t('actions.calculating')}
              </Typography>
            </Box>
          )}

          {/* Tab Panels */}
          {activeTab === 0 && (
            <Box sx={{ p: 3 }}>
              <PatientInputForm onSubmit={handlePatientSubmit} disabled={isLoading} />
            </Box>
          )}
          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              {lastResult ? (
                <DosingResults result={lastResult} onOpenInteractive={openInteractiveAUC} />
              ) : (
                <Typography color="text.secondary" align="center">
                  Please calculate dosing from the Patient Input tab first.
                </Typography>
              )}
            </Box>
          )}
          {activeTab === 2 && (
            <Box sx={{ p: 3 }}>
              {lastResult ? (
                <InteractiveAUC patient={lastPatient} initialRegimen={initialRegimen} onGoPatient={() => setActiveTab(0)} />
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
            <h4 className="clinical-disclaimer__title" id="clinical-disclaimer-title">{t('disclaimer.title')}</h4>
          </div>
          <p>{t('disclaimer.clinical')}</p>
        </div>

        {/* Footer */}
        <Box sx={{ mt: 4, py: 3, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            © 2024 Vancomyzer
          </Typography>
        </Box>
      </Container>
    </div>
  );
}

function App(){
  const { i18n } = useTranslation();
  const direction = i18n.language === 'ar' ? 'rtl' : 'ltr';
  React.useEffect(()=>{ document.dir = direction; }, [direction]);
  const cache = React.useMemo(() => createCache({ key: direction === 'rtl' ? 'mui-rtl' : 'mui', stylisPlugins: direction === 'rtl' ? [prefixer, rtlPlugin] : [prefixer] }), [direction]);
  const theme = React.useMemo(()=>createTheme({ direction }), [direction]);
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BayesianProvider>
          <AppInner />
        </BayesianProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

export default App;
