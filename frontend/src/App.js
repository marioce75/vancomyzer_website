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
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import CssBaseline from '@mui/material/CssBaseline';

import './App.css';
import './styles/disclaimer.css';
import i18n from './i18n';

function AppInner() {
  const { calculate, calculateInteractive, lastResult, error, isLoading } = useBayesian(); // new API
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [validationMessage, setValidationMessage] = useState(null); // gentle banner for incomplete form
  const [lastPatient, setLastPatient] = useState(null); // keep for potential interactive recalcs

  React.useEffect(() => {
    if (lastResult && !error) {
      setValidationMessage(null);
    }
  }, [lastResult, error]);

  // Map whatever the form provides to the canonical keys App.js expects
  function normalizePatientFields(p = {}) {
    // Some callers may send shape { patient: {...} }
    const src = p && typeof p === 'object' && p.patient ? p.patient : p;

    const toNum = (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed === '') return undefined;
        const n = parseFloat(trimmed);
        return Number.isFinite(n) ? n : undefined;
      }
      return Number.isFinite(v) ? v : undefined;
    };

    const age = toNum(
      src.age ?? src.age_years ?? src.ageYears ?? src.age_y ?? src.age_str
    );

    const weight_kg = toNum(
      src.weight_kg ?? src.weight ?? src.total_body_weight_kg ?? src.tbw_kg ?? src.weight_str
    );

    const serum_creatinine_mg_dl = toNum(
      src.serum_creatinine_mg_dl ??
        src.serum_creatinine ??
        src.scr ??
        src.s_cr ??
        src.sc ??
        src.SCr ??
        src.serum_creatinine_str
    );

    const height_cm = toNum(
      src.height_cm ?? src.height ?? src.height_cm_str
    );

    // Return the normalized flat shape the rest of the app expects
    return { ...src, age, weight_kg, serum_creatinine_mg_dl, height_cm };
  }

  const handlePatientSubmit = async (patientData) => {
    const normalized = normalizePatientFields(patientData);
    console.debug('[App] normalized patient for submit:', normalized);
    // Validation guard (minimal required fields; adjust as needed)
    const required = ['age', 'weight_kg', 'serum_creatinine_mg_dl', 'height_cm'];
    const missing = required.filter((f) => normalized[f] === undefined);
    if (missing.length) {
      setValidationMessage(t('notices.missingRequiredBanner'));
      return; // block calculate
    }
    setValidationMessage(null);
    try {
      setLastPatient(normalized);
      // Old removed: setPatient(patientData); submitDosing / calculate(patientData) with implicit levels
      await calculate({ patient: normalized, levels: normalized.levels || normalized.vancomycin_levels || [] });
      setActiveTab(1);
    } catch (e) {
      // Context should surface error; keep console for debugging
      // Previously: setError(e.message || 'Submission failed');
      // Leave silently; error banner will use context error
      console.error('Calculation failed', e);
    }
  };

  const handleTabChange = (event, newValue) => { setActiveTab(newValue); };

  // Placeholder for potential regimen adjustments routed through calculateInteractive
  const handleRegimenUpdate = async (regimen) => {
    if (!lastPatient || !lastResult) return;
    try {
      const normalizedPatient = normalizePatientFields(lastPatient);
      await calculateInteractive({ patient: normalizedPatient, levels: normalizedPatient.levels || normalizedPatient.vancomycin_levels || [], regimen });
    } catch (e) {
      console.error('Interactive regimen update failed', e);
    }
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
              <select
                aria-label="Language"
                value={i18n.language || 'en'}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                style={{ marginLeft: 12 }}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="ar">العربية</option>
              </select>
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
              <Tab icon={<Science />} label={t('tabs.interactiveAUC')} iconPosition="start" disabled={!lastResult || (lastResult?.meta?.source === 'population')} />
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
                <div>
                  <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Timeline sx={{ mr: 1 }} />
                    Dosing Results
                  </Typography>

                  {/* Source path banners */}
                  {lastResult?.meta?.source === 'population' && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      No vancomycin levels were provided. Recommendation is based on the population PK model.
                    </Alert>
                  )}
                  {lastResult?.meta?.source === 'bayesian' && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Bayesian individualization was used{lastResult?.meta?.levels_count ? ` (n = ${lastResult.meta.levels_count} levels).` : '.'}
                    </Alert>
                  )}

                  {/* Summary preview (match backend field names) */}
                  {(() => {
                    const result = lastResult; // alias for existing rendering logic
                    if (result?.recommended_dose_mg !== undefined) {
                      const summary = {
                        recommended_dose_mg: result.recommended_dose_mg,
                        interval_hours: result.interval_hours,
                        daily_dose_mg: result.daily_dose_mg,
                        predicted_auc_24: result.predicted_auc_24,
                        predicted_trough: result.predicted_trough,
                        predicted_peak: result.predicted_peak,
                        creatinine_clearance_ml_min: result.creatinine_clearance_ml_min,
                        half_life_hours: result.half_life_hours,
                        mg_per_kg_per_day: result.mg_per_kg_per_day,
                      };
                      return (
                        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(summary, null, 2)}</pre>
                      );
                    }
                    if (result?.individual_clearance !== undefined) {
                      const summary = {
                        individual_clearance: result.individual_clearance,
                        individual_volume: result.individual_volume,
                        clearance_ci: [result.clearance_ci_lower, result.clearance_ci_upper],
                        volume_ci: [result.volume_ci_lower, result.volume_ci_upper],
                        auc_ci: [result.predicted_auc_ci_lower, result.predicted_auc_ci_upper],
                        trough_ci: [result.predicted_trough_ci_lower, result.predicted_trough_ci_upper],
                        fit_r_squared: result.fit_r_squared,
                        convergence_achieved: result.convergence_achieved,
                      };
                      return (
                        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(summary, null, 2)}</pre>
                      );
                    }
                    return null;
                  })()}
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
              {lastResult ? (
                // Interactive component could be extended to accept handleRegimenUpdate
                <InteractiveAUCVisualization onRegimenChange={handleRegimenUpdate} />
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
