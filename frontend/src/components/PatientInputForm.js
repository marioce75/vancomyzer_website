import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Chip,
  FormControlLabel,
  Switch,
  Alert,
  Collapse,
  Paper
} from '@mui/material';
import {
  Person,
  Calculate,
  Warning,
  Info,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';

const PatientInputForm = ({ onSubmit, disabled = false }) => {
  const [patient, setPatient] = useState({
    population_type: 'adult',
    age_years: '',
    age_months: '',
    gestational_age_weeks: '',
    postnatal_age_days: '',
    gender: 'male',
    weight_kg: '',
    height_cm: '',
    serum_creatinine: '',
    indication: 'pneumonia',
    severity: 'moderate',
    is_renal_stable: true,
    is_on_hemodialysis: false,
    is_on_crrt: false,
    crcl_method: 'cockcroft_gault',
    custom_crcl: ''
  });

  const [validation, setValidation] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [estimatedCrCl, setEstimatedCrCl] = useState(null);

  // Real-time validation
  useEffect(() => {
    validateForm();
    calculateEstimatedCrCl();
  }, [patient]);

  const validateForm = () => {
    const errors = {};

    // Age validation
    if (patient.population_type === 'adult') {
      if (!patient.age_years || patient.age_years < 18) {
        errors.age_years = 'Adults must be ≥18 years';
      }
    } else if (patient.population_type === 'pediatric') {
      if (!patient.age_years || patient.age_years < 1/12 || patient.age_years >= 18) {
        errors.age_years = 'Pediatrics: 1 month to 17 years';
      }
    } else if (patient.population_type === 'neonate') {
      if (!patient.gestational_age_weeks || patient.gestational_age_weeks < 24 || patient.gestational_age_weeks > 44) {
        errors.gestational_age_weeks = 'GA must be 24-44 weeks';
      }
      if (!patient.postnatal_age_days || patient.postnatal_age_days < 0 || patient.postnatal_age_days > 365) {
        errors.postnatal_age_days = 'PNA must be 0-365 days';
      }
    }

    // Weight validation
    if (!patient.weight_kg || patient.weight_kg <= 0 || patient.weight_kg > 300) {
      errors.weight_kg = 'Weight must be 0.1-300 kg';
    }

    // Height validation (optional but if provided must be valid)
    if (patient.height_cm && (patient.height_cm < 30 || patient.height_cm > 250)) {
      errors.height_cm = 'Height must be 30-250 cm';
    }

    // Serum creatinine validation
    if (!patient.serum_creatinine || patient.serum_creatinine <= 0 || patient.serum_creatinine > 20) {
      errors.serum_creatinine = 'SCr must be 0.1-20 mg/dL';
    }

    // Custom CrCl validation
    if (patient.crcl_method === 'custom') {
      if (!patient.custom_crcl || patient.custom_crcl <= 0 || patient.custom_crcl > 200) {
        errors.custom_crcl = 'CrCl must be 1-200 mL/min';
      }
    }

    setValidation(errors);
  };

  const calculateEstimatedCrCl = () => {
    if (patient.population_type !== 'adult' || !patient.age_years || !patient.weight_kg || !patient.serum_creatinine) {
      setEstimatedCrCl(null);
      return;
    }

    // Cockcroft-Gault equation
    const weight = parseFloat(patient.weight_kg);
    const age = parseFloat(patient.age_years);
    const scr = parseFloat(patient.serum_creatinine);

    if (weight > 0 && age > 0 && scr > 0) {
      let crcl = ((140 - age) * weight) / (72 * scr);
      if (patient.gender === 'female') {
        crcl *= 0.85;
      }
      setEstimatedCrCl(Math.round(crcl));
    } else {
      setEstimatedCrCl(null);
    }
  };

  const handleInputChange = (field, value) => {
    setPatient(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (Object.keys(validation).length === 0) {
      onSubmit(patient);
    }
  };

  const getPopulationInfo = (population) => {
    const info = {
      adult: {
        description: '≥18 years old',
        color: 'primary',
        guidelines: 'Standard adult dosing algorithms'
      },
      pediatric: {
        description: '1 month - 17 years',
        color: 'secondary',
        guidelines: 'Weight-based pediatric dosing'
      },
      neonate: {
        description: '≤1 month old',
        color: 'success',
        guidelines: 'GA and PNA-adjusted dosing'
      }
    };
    return info[population];
  };

  const isFormValid = Object.keys(validation).length === 0;

  return (
    <div className="fade-in">
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Person sx={{ mr: 1 }} />
        Patient Information
      </Typography>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Population Selection */}
          <Grid item xs={12}>
            <Card className="result-card">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Population Type
                </Typography>
                <Grid container spacing={2}>
                  {['adult', 'pediatric', 'neonate'].map(pop => {
                    const info = getPopulationInfo(pop);
                    return (
                      <Grid item xs={12} md={4} key={pop}>
                        <Paper
                          sx={{
                            p: 2,
                            border: patient.population_type === pop ? 2 : 1,
                            borderColor: patient.population_type === pop ? 'primary.main' : 'grey.300',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              borderColor: 'primary.main',
                              transform: 'translateY(-2px)'
                            }
                          }}
                          onClick={() => handleInputChange('population_type', pop)}
                        >
                          <Typography variant="h6" color={info.color}>
                            {pop.charAt(0).toUpperCase() + pop.slice(1)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {info.description}
                          </Typography>
                          <Chip label={info.guidelines} size="small" color={info.color} variant="outlined" />
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Demographics */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Demographics
                </Typography>
                <Grid container spacing={2}>
                  {/* Age fields based on population */}
                  {patient.population_type === 'adult' && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Age (years)"
                        type="number"
                        value={patient.age_years}
                        onChange={(e) => handleInputChange('age_years', e.target.value)}
                        error={!!validation.age_years}
                        helperText={validation.age_years}
                        inputProps={{ min: 18, max: 120 }}
                      />
                    </Grid>
                  )}

                  {patient.population_type === 'pediatric' && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Age (years)"
                        type="number"
                        value={patient.age_years}
                        onChange={(e) => handleInputChange('age_years', e.target.value)}
                        error={!!validation.age_years}
                        helperText={validation.age_years || "Enter as decimal (e.g., 2.5 for 2.5 years)"}
                        inputProps={{ min: 0.08, max: 17.99, step: 0.1 }}
                      />
                    </Grid>
                  )}

                  {patient.population_type === 'neonate' && (
                    <>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Gestational Age (weeks)"
                          type="number"
                          value={patient.gestational_age_weeks}
                          onChange={(e) => handleInputChange('gestational_age_weeks', e.target.value)}
                          error={!!validation.gestational_age_weeks}
                          helperText={validation.gestational_age_weeks}
                          inputProps={{ min: 24, max: 44, step: 0.1 }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Postnatal Age (days)"
                          type="number"
                          value={patient.postnatal_age_days}
                          onChange={(e) => handleInputChange('postnatal_age_days', e.target.value)}
                          error={!!validation.postnatal_age_days}
                          helperText={validation.postnatal_age_days}
                          inputProps={{ min: 0, max: 365 }}
                        />
                      </Grid>
                    </>
                  )}

                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Gender</InputLabel>
                      <Select
                        value={patient.gender}
                        label="Gender"
                        onChange={(e) => handleInputChange('gender', e.target.value)}
                      >
                        <MenuItem value="male">Male</MenuItem>
                        <MenuItem value="female">Female</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Physical Parameters */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Physical Parameters
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Weight (kg)"
                      type="number"
                      value={patient.weight_kg}
                      onChange={(e) => handleInputChange('weight_kg', e.target.value)}
                      error={!!validation.weight_kg}
                      helperText={validation.weight_kg}
                      inputProps={{ min: 0.1, max: 300, step: 0.1 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Height (cm, optional)"
                      type="number"
                      value={patient.height_cm}
                      onChange={(e) => handleInputChange('height_cm', e.target.value)}
                      error={!!validation.height_cm}
                      helperText={validation.height_cm}
                      inputProps={{ min: 30, max: 250 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Serum Creatinine (mg/dL)"
                      type="number"
                      value={patient.serum_creatinine}
                      onChange={(e) => handleInputChange('serum_creatinine', e.target.value)}
                      error={!!validation.serum_creatinine}
                      helperText={validation.serum_creatinine}
                      inputProps={{ min: 0.1, max: 20, step: 0.1 }}
                    />
                  </Grid>
                </Grid>

                {/* Estimated CrCl Display */}
                {estimatedCrCl && (
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: 'info.light', borderRadius: 1 }}>
                    <Typography variant="body2" color="info.dark">
                      <Info sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      Estimated CrCl: <strong>{estimatedCrCl} mL/min</strong>
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Clinical Information */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Clinical Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Indication</InputLabel>
                      <Select
                        value={patient.indication}
                        label="Indication"
                        onChange={(e) => handleInputChange('indication', e.target.value)}
                      >
                        <MenuItem value="pneumonia">Pneumonia</MenuItem>
                        <MenuItem value="skin_soft_tissue">Skin/Soft Tissue</MenuItem>
                        <MenuItem value="bacteremia">Bacteremia</MenuItem>
                        <MenuItem value="endocarditis">Endocarditis</MenuItem>
                        <MenuItem value="meningitis">Meningitis</MenuItem>
                        <MenuItem value="osteomyelitis">Osteomyelitis</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Infection Severity</InputLabel>
                      <Select
                        value={patient.severity}
                        label="Infection Severity"
                        onChange={(e) => handleInputChange('severity', e.target.value)}
                      >
                        <MenuItem value="mild">Mild</MenuItem>
                        <MenuItem value="moderate">Moderate</MenuItem>
                        <MenuItem value="severe">Severe</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Advanced Options */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Advanced Options
                  </Typography>
                  <Button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
                  >
                    {showAdvanced ? 'Hide' : 'Show'}
                  </Button>
                </Box>

                <Collapse in={showAdvanced}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={patient.is_renal_stable}
                            onChange={(e) => handleInputChange('is_renal_stable', e.target.checked)}
                          />
                        }
                        label="Renal function is stable"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={patient.is_on_hemodialysis}
                            onChange={(e) => handleInputChange('is_on_hemodialysis', e.target.checked)}
                          />
                        }
                        label="On hemodialysis"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={patient.is_on_crrt}
                            onChange={(e) => handleInputChange('is_on_crrt', e.target.checked)}
                          />
                        }
                        label="On CRRT"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>CrCl Method</InputLabel>
                        <Select
                          value={patient.crcl_method}
                          label="CrCl Method"
                          onChange={(e) => handleInputChange('crcl_method', e.target.value)}
                        >
                          <MenuItem value="cockcroft_gault">Cockcroft-Gault</MenuItem>
                          <MenuItem value="mdrd">MDRD</MenuItem>
                          <MenuItem value="ckd_epi">CKD-EPI</MenuItem>
                          <MenuItem value="custom">Custom</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    {patient.crcl_method === 'custom' && (
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Custom CrCl (mL/min)"
                          type="number"
                          value={patient.custom_crcl}
                          onChange={(e) => handleInputChange('custom_crcl', e.target.value)}
                          error={!!validation.custom_crcl}
                          helperText={validation.custom_crcl}
                          inputProps={{ min: 1, max: 200 }}
                        />
                      </Grid>
                    )}
                  </Grid>
                </Collapse>
              </CardContent>
            </Card>
          </Grid>

          {/* Submit Button */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={!isFormValid || disabled}
                startIcon={<Calculate />}
                sx={{ minWidth: 200, py: 1.5 }}
              >
                {disabled ? 'Calculating...' : 'Calculate Dosing'}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Validation Summary */}
        {Object.keys(validation).length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Please correct the following errors:
            </Typography>
            {Object.values(validation).map((error, idx) => (
              <Typography key={idx} variant="body2">
                • {error}
              </Typography>
            ))}
          </Alert>
        )}
      </form>
    </div>
  );
};

export default PatientInputForm;