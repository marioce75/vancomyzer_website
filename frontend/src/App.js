import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Calculate as CalculateIcon,
  Science as ScienceIcon,
  Timeline as TimelineIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  MonitorHeart as MonitorIcon,
  LocalHospital as HospitalIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';

// Healthcare Blue Theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#0277bd',
      light: '#03a9f4',
      dark: '#01579b',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
    },
    error: {
      main: '#d32f2f',
      light: '#f44336',
      dark: '#c62828',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.125rem',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: '8px',
        },
      },
    },
  },
});

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`calculator-tabpanel-${index}`}
      aria-labelledby={`calculator-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `calculator-tab-${index}`,
    'aria-controls': `calculator-tabpanel-${index}`,
  };
}

function PatientInputForm({ patient, setPatient, dosingParams, setDosingParams }) {
  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HospitalIcon color="primary" />
          Patient Demographics
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2, mt: 2 }}>
          <TextField
            label="Age (years)"
            type="number"
            value={patient.age_years}
            onChange={(e) => setPatient({ ...patient, age_years: parseFloat(e.target.value) || 0 })}
            required
            inputProps={{ min: 0, max: 120, step: 0.1 }}
          />
          
          <FormControl required>
            <InputLabel>Gender</InputLabel>
            <Select
              value={patient.gender}
              onChange={(e) => setPatient({ ...patient, gender: e.target.value })}
              label="Gender"
            >
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            label="Height (cm)"
            type="number"
            value={patient.height_cm}
            onChange={(e) => setPatient({ ...patient, height_cm: parseFloat(e.target.value) || 0 })}
            required
            inputProps={{ min: 100, max: 250, step: 0.1 }}
          />
          
          <TextField
            label="Weight (kg)"
            type="number"
            value={patient.weight_kg}
            onChange={(e) => setPatient({ ...patient, weight_kg: parseFloat(e.target.value) || 0 })}
            required
            inputProps={{ min: 0.5, max: 300, step: 0.1 }}
          />
          
          <TextField
            label="Serum Creatinine (mg/dL)"
            type="number"
            value={patient.serum_creatinine_mg_dl}
            onChange={(e) => setPatient({ ...patient, serum_creatinine_mg_dl: parseFloat(e.target.value) || 0 })}
            required
            inputProps={{ min: 0.1, max: 20, step: 0.01 }}
          />
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={patient.use_scr_floor}
                  onChange={(e) => setPatient({ ...patient, use_scr_floor: e.target.checked })}
                />
              }
              label="SCr Floor"
            />
            {patient.use_scr_floor && (
              <TextField
                label="Floor (mg/dL)"
                type="number"
                size="small"
                value={patient.scr_floor_mg_dl}
                onChange={(e) => setPatient({ ...patient, scr_floor_mg_dl: parseFloat(e.target.value) || 0.6 })}
                inputProps={{ min: 0.1, max: 2, step: 0.1 }}
                sx={{ width: '120px' }}
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScienceIcon color="primary" />
          Dosing Parameters
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2, mt: 2 }}>
          <TextField
            label="Target AUC Min (mg·h/L)"
            type="number"
            value={dosingParams.target_auc_min}
            onChange={(e) => setDosingParams({ ...dosingParams, target_auc_min: parseFloat(e.target.value) || 400 })}
            inputProps={{ min: 200, max: 800, step: 25 }}
          />
          
          <TextField
            label="Target AUC Max (mg·h/L)"
            type="number"
            value={dosingParams.target_auc_max}
            onChange={(e) => setDosingParams({ ...dosingParams, target_auc_max: parseFloat(e.target.value) || 600 })}
            inputProps={{ min: 200, max: 800, step: 25 }}
          />
          
          <TextField
            label="MIC (mg/L)"
            type="number"
            value={dosingParams.mic_mg_l}
            onChange={(e) => setDosingParams({ ...dosingParams, mic_mg_l: parseFloat(e.target.value) || 1.0 })}
            inputProps={{ min: 0.25, max: 16, step: 0.25 }}
          />
          
          <FormControl>
            <InputLabel>Weight Basis</InputLabel>
            <Select
              value={dosingParams.weight_basis}
              onChange={(e) => setDosingParams({ ...dosingParams, weight_basis: e.target.value })}
              label="Weight Basis"
            >
              <MenuItem value="tbw">Total Body Weight</MenuItem>
              <MenuItem value="ibw">Ideal Body Weight</MenuItem>
              <MenuItem value="adjbw">Adjusted Body Weight</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            label="Dosing Interval (hours)"
            type="number"
            value={dosingParams.dosing_interval_hours || ''}
            onChange={(e) => setDosingParams({ ...dosingParams, dosing_interval_hours: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="Auto"
            inputProps={{ min: 6, max: 48, step: 1 }}
            helperText="Leave empty for auto-selection"
          />
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={dosingParams.obesity_adjustment}
                  onChange={(e) => setDosingParams({ ...dosingParams, obesity_adjustment: e.target.checked })}
                />
              }
              label="Obesity Adjustment"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={dosingParams.icu_setting}
                  onChange={(e) => setDosingParams({ ...dosingParams, icu_setting: e.target.checked })}
                />
              }
              label="ICU Setting"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={dosingParams.beta_lactam_allergy}
                  onChange={(e) => setDosingParams({ ...dosingParams, beta_lactam_allergy: e.target.checked })}
                />
              }
              label="β-lactam Allergy"
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function LevelsInput({ levels, setLevels, calculationMode }) {
  const addLevel = () => {
    setLevels([...levels, {
      concentration_mg_l: '',
      time_hours: '',
      dose_mg: '',
      infusion_duration_hours: 1.0
    }]);
  };

  const removeLevel = (index) => {
    setLevels(levels.filter((_, i) => i !== index));
  };

  const updateLevel = (index, field, value) => {
    const newLevels = [...levels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    setLevels(newLevels);
  };

  if (calculationMode === 'trough') {
    return null; // Trough mode doesn't require levels
  }

  return (
    <Card elevation={2}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon color="primary" />
            Vancomycin Levels
            {calculationMode === 'bayesian' && <Chip label="Required" color="error" size="small" />}
            {calculationMode === 'auc_guided' && <Chip label="Optional" color="info" size="small" />}
          </Typography>
          <Box>
            <Button
              variant="outlined"
              onClick={addLevel}
              size="small"
            >
              Add Level
            </Button>
          </Box>
        </Box>

        {levels.length === 0 ? (
          <Alert severity="info">
            {calculationMode === 'bayesian' 
              ? 'Add at least one measured vancomycin level for Bayesian optimization.'
              : 'Add measured levels for two-level AUC calculation, or leave empty for steady-state method.'
            }
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {levels.map((level, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">Level {index + 1}</Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => removeLevel(index)}
                  >
                    Remove
                  </Button>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label="Concentration (mg/L)"
                    type="number"
                    value={level.concentration_mg_l}
                    onChange={(e) => updateLevel(index, 'concentration_mg_l', parseFloat(e.target.value) || '')}
                    inputProps={{ min: 0, max: 200, step: 0.1 }}
                    required
                  />
                  <TextField
                    label="Time (hours)"
                    type="number"
                    value={level.time_hours}
                    onChange={(e) => updateLevel(index, 'time_hours', parseFloat(e.target.value) || '')}
                    inputProps={{ min: 0, max: 72, step: 0.1 }}
                    required
                    helperText="After dose start"
                  />
                  <TextField
                    label="Dose (mg)"
                    type="number"
                    value={level.dose_mg}
                    onChange={(e) => updateLevel(index, 'dose_mg', parseFloat(e.target.value) || '')}
                    inputProps={{ min: 0, max: 4000, step: 125 }}
                    required
                  />
                  <TextField
                    label="Infusion Duration (h)"
                    type="number"
                    value={level.infusion_duration_hours}
                    onChange={(e) => updateLevel(index, 'infusion_duration_hours', parseFloat(e.target.value) || 1.0)}
                    inputProps={{ min: 0.25, max: 24, step: 0.25 }}
                  />
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function ResultsDisplay({ result, loading }) {
  if (loading) {
    return (
      <Card elevation={2}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Calculating dosing recommendations...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card elevation={2}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            Enter patient data and click Calculate to see recommendations
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (auc) => {
    if (auc >= 400 && auc <= 600) return 'success';
    if (auc >= 350 && auc < 400) return 'warning';
    if (auc > 600 && auc <= 700) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Main Recommendations Card */}
      <Card elevation={3}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentIcon color="primary" />
            Dosing Recommendations
            <Chip 
              label={result.calculation_method} 
              color="primary" 
              size="small" 
              sx={{ ml: 'auto' }}
            />
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mt: 2 }}>
            <Box>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                {result.recommended_dose_mg} mg
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Every {result.interval_hours} hours
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Daily dose: {result.daily_dose_mg?.toFixed(0)} mg
              </Typography>
              {result.infusion_duration_hours && (
                <Typography variant="body2">
                  Infusion time: ≥{result.infusion_duration_hours} hour(s)
                </Typography>
              )}
            </Box>
            
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="h6">Predicted AUC₂₄:</Typography>
                <Chip 
                  label={`${result.predicted_auc_24?.toFixed(0)} mg·h/L`}
                  color={getStatusColor(result.predicted_auc_24)}
                  size="medium"
                />
              </Box>
              {result.predicted_trough_mg_l && (
                <Typography variant="body2">
                  Predicted trough: {result.predicted_trough_mg_l.toFixed(1)} mg/L
                </Typography>
              )}
              {result.predicted_peak_mg_l && (
                <Typography variant="body2">
                  Predicted peak: {result.predicted_peak_mg_l.toFixed(1)} mg/L
                </Typography>
              )}
              {result.auc_mic_ratio && (
                <Typography variant="body2">
                  AUC/MIC ratio: {result.auc_mic_ratio.toFixed(0)}
                </Typography>
              )}
            </Box>
          </Box>

          {result.rationale && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Rationale:</strong> {result.rationale}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Loading Dose Card */}
      {result.loading_dose && (
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScienceIcon color="secondary" />
              Loading Dose
            </Typography>
            <Typography variant="h4" color="secondary" sx={{ fontWeight: 'bold' }}>
              {result.loading_dose.loading_dose_mg} mg
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {result.loading_dose.recommendation}
            </Typography>
            {result.loading_dose.was_capped && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Dose capped at maximum ({result.loading_dose.max_dose_mg} mg)
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Safety Warnings */}
      {result.safety_warnings && result.safety_warnings.length > 0 && (
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              Safety Warnings
            </Typography>
            <List dense>
              {result.safety_warnings.map((warning, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <WarningIcon color="warning" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={warning} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Monitoring Recommendations */}
      {result.monitoring_recommendations && result.monitoring_recommendations.length > 0 && (
        <Card elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MonitorIcon color="info" />
              Monitoring Recommendations
            </Typography>
            <List dense>
              {result.monitoring_recommendations.map((rec, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <CheckCircleIcon color="info" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={rec} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* PK Parameters Details */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Pharmacokinetic Parameters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            {result.pk_parameters && Object.entries(result.pk_parameters).map(([key, value]) => {
              if (typeof value === 'number') {
                return (
                  <Box key={key}>
                    <Typography variant="body2" color="text.secondary">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                    <Typography variant="body1">
                      {value.toFixed(2)}
                    </Typography>
                  </Box>
                );
              }
              return null;
            })}
          </Box>
          
          {result.formula_used && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {result.formula_used}
              </Typography>
            </Alert>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Clinical References */}
      {result.citations && (
        <Card elevation={1}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              <strong>References:</strong> Based on {result.citations.map(c => c.short).join(', ')} guidelines
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [patient, setPatient] = useState({
    age_years: 65,
    gender: 'male',
    height_cm: 175,
    weight_kg: 75,
    serum_creatinine_mg_dl: 1.0,
    use_scr_floor: false,
    scr_floor_mg_dl: 0.6
  });
  
  const [dosingParams, setDosingParams] = useState({
    target_auc_min: 400,
    target_auc_max: 600,
    mic_mg_l: 1.0,
    dosing_interval_hours: null,
    weight_basis: 'tbw',
    obesity_adjustment: true,
    beta_lactam_allergy: false,
    icu_setting: false
  });
  
  const [levels, setLevels] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculationModes = ['trough', 'auc_guided', 'bayesian'];
  const tabLabels = ['Trough-Based', 'AUC-Guided', 'Bayesian MAP'];
  const tabIcons = [TimelineIcon, CalculateIcon, ScienceIcon];

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use environment variable if available, otherwise fallback to localhost
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      console.log('Using backend URL:', backendUrl); // Debug log
      
      const requestData = {
        calculation_mode: calculationModes[activeTab],
        patient,
        dosing_params: dosingParams,
        levels: levels.filter(l => l.concentration_mg_l && l.time_hours && l.dose_mg)
      };
      
      console.log('Request data being sent:', JSON.stringify(requestData, null, 2)); // Debug log
      
      const response = await fetch(`${backendUrl}/api/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('Response status:', response.status); // Debug log

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Network error' }));
        console.log('Error response data:', errorData); // Debug log
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('Response data:', data); // Debug log
      setResult(data.result);
    } catch (err) {
      setError(err.message);
      console.error('Calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setResult(null); // Clear results when switching tabs
    setError(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Header */}
        <Box sx={{ 
          bgcolor: 'primary.main', 
          color: 'white', 
          py: 4,
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
        }}>
          <Container maxWidth="lg">
            <Typography variant="h1" align="center" gutterBottom>
              Vancomyzer<sup style={{ fontSize: '0.6em' }}>®</sup>
            </Typography>
            <Typography variant="h5" align="center" sx={{ opacity: 0.9 }}>
              Evidence-Based Vancomycin Calculator Suite
            </Typography>
            <Typography variant="body1" align="center" sx={{ mt: 1, opacity: 0.8 }}>
              Following ASHP/IDSA 2020 Guidelines • AUC-Guided Dosing • Bayesian Optimization
            </Typography>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Chip 
                label="Educational decision-support; not a substitute for clinical judgment" 
                sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: 4 }}>
          {/* Calculator Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              {tabLabels.map((label, index) => {
                const IconComponent = tabIcons[index];
                return (
                  <Tab
                    key={label}
                    label={label}
                    icon={<IconComponent />}
                    iconPosition="start"
                    {...a11yProps(index)}
                    sx={{ textTransform: 'none', fontWeight: 500 }}
                  />
                );
              })}
            </Tabs>

            {/* Tab Content */}
            <Box sx={{ p: 3 }}>
              <TabPanel value={activeTab} index={0}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  <strong>Trough-Based Method:</strong> Traditional steady-state calculations targeting trough concentrations of 10-20 mg/L. 
                  This legacy approach is being phased out in favor of AUC-guided dosing per ASHP/IDSA 2020 guidelines.
                </Alert>
              </TabPanel>
              
              <TabPanel value={activeTab} index={1}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  <strong>AUC-Guided Method:</strong> Recommended approach targeting AUC₂₄ of 400-600 mg·h/L. 
                  Uses steady-state calculations or two-level trapezoid method when levels are available.
                </Alert>
              </TabPanel>
              
              <TabPanel value={activeTab} index={2}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  <strong>Bayesian MAP:</strong> Advanced method using measured levels to estimate individual pharmacokinetic parameters 
                  and optimize dosing. Requires at least one measured vancomycin level.
                </Alert>
              </TabPanel>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <PatientInputForm
                  patient={patient}
                  setPatient={setPatient}
                  dosingParams={dosingParams}
                  setDosingParams={setDosingParams}
                />
                
                <LevelsInput
                  levels={levels}
                  setLevels={setLevels}
                  calculationMode={calculationModes[activeTab]}
                />
                
                <Box sx={{ textAlign: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleCalculate}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <CalculateIcon />}
                    sx={{ minWidth: 200, py: 1.5 }}
                  >
                    {loading ? 'Calculating...' : 'Calculate Dosing'}
                  </Button>
                </Box>

                {error && (
                  <Alert severity="error">
                    <strong>Calculation Error:</strong> {error}
                  </Alert>
                )}

                <ResultsDisplay result={result} loading={loading} />
              </Box>
            </Box>
          </Paper>
        </Container>

        {/* Footer */}
        <Box sx={{ bgcolor: 'grey.100', py: 3, mt: 4 }}>
          <Container maxWidth="lg">
            <Typography variant="body2" align="center" color="text.secondary">
              © {new Date().getFullYear()} Vancomyzer. Educational tool for healthcare professionals.
              Always consult local protocols and clinical judgment.
            </Typography>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;