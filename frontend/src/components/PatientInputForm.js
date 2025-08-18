import React, { useState, useEffect, useRef } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
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
  Info,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const PatientInputForm = ({ onSubmit, disabled = false }) => {
  const { t } = useTranslation();

  const ALLOWED_GENDERS = ['male', 'female'];

  // Helper to test numeric presence (updated per spec)
  const isFiniteNumber = v => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));
  const toNumOrUndefined = v => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

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
  // New form-level error banner
  const [formError, setFormError] = useState('');
  const [errorFields, setErrorFields] = useState([]); // track missing requireds
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [estimatedCrCl, setEstimatedCrCl] = useState(null);
  const isAdult = patient.population_type === 'adult';
  const [heightTouched, setHeightTouched] = useState(false);

  // Refs for focusing
  const weightRef = useRef(null);
  const scrRef = useRef(null);

  // Real-time validation
  useEffect(() => {
    validateForm();
    calculateEstimatedCrCl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient]);

  const validateForm = () => {
    const errors = {};

    // Age validation
    if (patient.population_type === 'adult') {
      if (!patient.age_years || patient.age_years < 18) {
        errors.age_years = t('errors.ageAdultMin');
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
      errors.weight_kg = t('errors.weightRange');
    }
    // Height validation (optional for all populations now). Validate only if provided.
    if (patient.height_cm !== '' && patient.height_cm !== null && patient.height_cm !== undefined) {
      if (patient.population_type === 'adult') {
        if (patient.height_cm < 100 || patient.height_cm > 250) {
          errors.height_cm = 'Height must be 100-250 cm (adult)';
        }
      } else {
        if (patient.height_cm < 30 || patient.height_cm > 250) {
          errors.height_cm = 'Height must be 30-250 cm';
        }
      }
    }
    // Serum creatinine validation
    if (!patient.serum_creatinine || patient.serum_creatinine <= 0 || patient.serum_creatinine > 20) {
      errors.serum_creatinine = t('errors.scrRange');
    }

    // Custom CrCl validation
    if (patient.crcl_method === 'custom') {
      if (!patient.custom_crcl || patient.custom_crcl <= 0 || patient.custom_crcl > 200) {
        errors.custom_crcl = 'CrCl must be 1-200 mL/min';
      }
    }

    // Gender validation
    if (!ALLOWED_GENDERS.includes(patient.gender)) {
      errors.gender = t('errors.genderInvalid') || 'Invalid gender selection';
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
    if (field === 'height_cm') setHeightTouched(true);
    setPatient(prev => {
      let nextValue = value;
      if (field === 'gender') {
        nextValue = ALLOWED_GENDERS.includes(value) ? value : 'male';
      }
      const newPatient = { ...prev, [field]: nextValue };

      // If user fixes a previously missing required field, clear it from errorFields & possibly banner
      if (field === 'weight_kg' || field === 'serum_creatinine') {
        const weightValid = isFiniteNumber(newPatient.weight_kg);
        const scrValid = isFiniteNumber(newPatient.serum_creatinine);

        setErrorFields(prevFields => prevFields.filter(f => {
          if (f === 'weight_kg' && weightValid) return false;
          if (f === 'serum_creatinine' && scrValid) return false;
          return true;
        }));

        if (weightValid && scrValid) setFormError('');
      }

      return newPatient;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Build coerced patient object to guarantee numeric types or undefined
    const patientForApi = {
      ...patient,
      weight_kg: toNumOrUndefined(patient.weight_kg),
      serum_creatinine: toNumOrUndefined(patient.serum_creatinine),
      height_cm: toNumOrUndefined(patient.height_cm),
      age_years: toNumOrUndefined(patient.age_years),
      age_months: toNumOrUndefined(patient.age_months),
      gestational_age_weeks: toNumOrUndefined(patient.gestational_age_weeks),
      postnatal_age_days: toNumOrUndefined(patient.postnatal_age_days),
      custom_crcl: toNumOrUndefined(patient.custom_crcl),
      gender: ALLOWED_GENDERS.includes(patient.gender) ? patient.gender : 'male',
    };

    const missing = [];
    if (!isFiniteNumber(patientForApi.weight_kg)) missing.push('weight_kg');
    if (!isFiniteNumber(patientForApi.serum_creatinine)) missing.push('serum_creatinine');

    if (missing.length) {
      setErrorFields(missing);
      setFormError('Please enter: ' + missing.map(k => k === 'weight_kg' ? 'Weight (kg)' : 'Serum creatinine').join(', '));
      // Focus first missing field
      if (missing[0] === 'weight_kg' && weightRef.current) {
        weightRef.current.focus();
      } else if (missing[0] === 'serum_creatinine' && scrRef.current) {
        scrRef.current.focus();
      }
      return; // Do not proceed to API
    }

    setFormError('');
    setErrorFields([]);

    // Proceed with existing submit path (upstream caller handles API call)
    if (Object.keys(validation).length === 0) {
      onSubmit(patientForApi);
    } else {
      // Still pass coerced object; upstream may further validate
      onSubmit(patientForApi);
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

  // const isFormValid = Object.keys(validation).length === 0; // no longer needed after submit gating change
  const numericHeight = Number(patient.height_cm);
  const numericWeight = Number(patient.weight_kg);
  const bmi = (isFinite(numericHeight) && isFinite(numericWeight) && numericHeight >= 100 && numericHeight <= 250 && numericWeight > 0)
    ? +(numericWeight / Math.pow(numericHeight / 100, 2)).toFixed(1)
    : null;

  return (
    <div className="fade-in">
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Person sx={{ mr: 1 }} />
        {t('tabs.patientInput')}
      </Typography>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Population Selection */}
          <Grid item xs={12}>
            <Card className="result-card">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('fields.populationType')}
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
                  {t('fields.age')}
                </Typography>
                <Grid container spacing={2}>
                  {/* Age fields based on population */}
                  {patient.population_type === 'adult' && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>{t('fields.ageYears')}</Typography>
                      <TextField
                        fullWidth
                        type="number"
                        value={patient.age_years}
                        onChange={(e) => handleInputChange('age_years', e.target.value)}
                        error={!!validation.age_years}
                        helperText={validation.age_years}
                        inputProps={{ min: 18, max: 120 }}
                        aria-label={t('fields.ageYears')}
                      />
                    </Grid>
                  )}

                  {patient.population_type === 'pediatric' && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>{t('fields.ageYears')}</Typography>
                      <TextField
                        fullWidth
                        type="number"
                        value={patient.age_years}
                        onChange={(e) => handleInputChange('age_years', e.target.value)}
                        error={!!validation.age_years}
                        helperText={validation.age_years || "Enter as decimal (e.g., 2.5 for 2.5 years)"}
                        inputProps={{ min: 0.08, max: 17.99, step: 0.1 }}
                        aria-label={t('fields.ageYears')}
                      />
                    </Grid>
                  )}

                  {patient.population_type === 'neonate' && (
                    <>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" gutterBottom>{t('fields.gestationalAgeWeeks')}</Typography>
                        <TextField
                          fullWidth
                          type="number"
                          value={patient.gestational_age_weeks}
                          onChange={(e) => handleInputChange('gestational_age_weeks', e.target.value)}
                          error={!!validation.gestational_age_weeks}
                          helperText={validation.gestational_age_weeks}
                          inputProps={{ min: 24, max: 44, step: 0.1 }}
                          aria-label={t('fields.gestationalAgeWeeks')}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="subtitle2" gutterBottom>{t('fields.postnatalAgeDays')}</Typography>
                        <TextField
                          fullWidth
                          type="number"
                          value={patient.postnatal_age_days}
                          onChange={(e) => handleInputChange('postnatal_age_days', e.target.value)}
                          error={!!validation.postnatal_age_days}
                          helperText={validation.postnatal_age_days}
                          inputProps={{ min: 0, max: 365 }}
                          aria-label={t('fields.postnatalAgeDays')}
                        />
                      </Grid>
                    </>
                  )}

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>{t('fields.gender')}</Typography>
                    <Select
                      value={patient.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      aria-label={t('fields.gender')}
                      sx={{ width: '100%' }}
                      error={!!validation.gender}
                      displayEmpty
                    >
                      <MenuItem value="male">{t('genders.male')}</MenuItem>
                      <MenuItem value="female">{t('genders.female')}</MenuItem>
                    </Select>
                    {validation.gender && (
                      <Typography variant="caption" color="error">{validation.gender}</Typography>
                    )}
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
                  {t('fields.physicalParameters')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" gutterBottom>{t('fields.weightKg')}</Typography>
                    <TextField
                      fullWidth
                      type="number"
                      value={patient.weight_kg}
                      onChange={(e) => handleInputChange('weight_kg', e.target.value)}
                      error={!!validation.weight_kg || errorFields.includes('weight_kg')}
                      helperText={validation.weight_kg}
                      inputProps={{ min: 0.1, max: 300, step: 0.1 }}
                      inputRef={weightRef}
                      className={errorFields.includes('weight_kg') ? 'input error' : undefined}
                      aria-label={t('fields.weightKg')}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" gutterBottom>{t('fields.heightCm')}</Typography>
                    <TextField
                      fullWidth
                      type="number"
                      value={patient.height_cm}
                      onChange={(e) => handleInputChange('height_cm', e.target.value)}
                      onBlur={() => setHeightTouched(true)}
                      error={!!validation.height_cm && (heightTouched)}
                      helperText={validation.height_cm || 'Enter height if known to improve IBW/AdjBW calculations'}
                      inputProps={{ min: isAdult ? 100 : 30, max: 250 }}
                      aria-label={t('fields.heightCm')}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>{t('fields.serumCreatinine')}</Typography>
                    <TextField
                      fullWidth
                      type="number"
                      value={patient.serum_creatinine}
                      onChange={(e) => handleInputChange('serum_creatinine', e.target.value)}
                      error={!!validation.serum_creatinine || errorFields.includes('serum_creatinine')}
                      helperText={validation.serum_creatinine}
                      inputProps={{ min: 0.1, max: 20, step: 0.1 }}
                      inputRef={scrRef}
                      className={errorFields.includes('serum_creatinine') ? 'input error' : undefined}
                      aria-label={t('fields.serumCreatinine')}
                    />
                  </Grid>
                </Grid>

                {/* BMI Display */}
                {bmi && (
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: 'secondary.light', borderRadius: 1 }}>
                    <Typography variant="body2" color="secondary.dark">
                      BMI: <strong>{bmi}</strong>
                    </Typography>
                  </Box>
                )}
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
                  {t('fields.clinicalInformation')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>{t('fields.indication')}</Typography>
                    <Select
                      value={patient.indication}
                      onChange={(e) => handleInputChange('indication', e.target.value)}
                      aria-label={t('fields.indication')}
                      sx={{ width: '100%' }}
                    >
                      <MenuItem value="pneumonia">{t('indications.pneumonia')}</MenuItem>
                      <MenuItem value="skin_soft_tissue">{t('indications.skinSoftTissue')}</MenuItem>
                      <MenuItem value="bacteremia">{t('indications.bacteremia')}</MenuItem>
                      <MenuItem value="endocarditis">{t('indications.endocarditis')}</MenuItem>
                      <MenuItem value="meningitis">{t('indications.meningitis')}</MenuItem>
                      <MenuItem value="osteomyelitis">{t('indications.osteomyelitis')}</MenuItem>
                      <MenuItem value="other">{t('indications.other')}</MenuItem>
                    </Select>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>{t('fields.infectionSeverity')}</Typography>
                    <Select
                      value={patient.severity}
                      onChange={(e) => handleInputChange('severity', e.target.value)}
                      aria-label={t('fields.infectionSeverity')}
                      sx={{ width: '100%' }}
                    >
                      <MenuItem value="mild">{t('severities.mild')}</MenuItem>
                      <MenuItem value="moderate">{t('severities.moderate')}</MenuItem>
                      <MenuItem value="severe">{t('severities.severe')}</MenuItem>
                    </Select>
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
                    {t('fields.advancedOptions')}
                  </Typography>
                  <Button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
                  >
                    {showAdvanced ? t('actions.hide') : t('actions.show')}
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
                        label={t('fields.renalFunctionStable')}
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
                        label={t('fields.onHemodialysis')}
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
                        label={t('fields.onCRRT')}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>{t('fields.crclMethod')}</Typography>
                      <Select
                        value={patient.crcl_method}
                        onChange={(e) => handleInputChange('crcl_method', e.target.value)}
                        aria-label={t('fields.crclMethod')}
                        sx={{ width: '100%' }}
                      >
                        <MenuItem value="cockcroft_gault">{t('methods.cockcroftGault')}</MenuItem>
                        <MenuItem value="mdrd">{t('methods.mdrd')}</MenuItem>
                        <MenuItem value="ckd_epi">{t('methods.ckdEpi')}</MenuItem>
                        <MenuItem value="custom">{t('methods.custom')}</MenuItem>
                      </Select>
                    </Grid>

                    {patient.crcl_method === 'custom' && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>{t('fields.customCrcl')}</Typography>
                        <TextField
                          fullWidth
                          type="number"
                          value={patient.custom_crcl}
                          onChange={(e) => handleInputChange('custom_crcl', e.target.value)}
                          error={!!validation.custom_crcl}
                          helperText={validation.custom_crcl}
                          inputProps={{ min: 1, max: 200 }}
                          aria-label={t('fields.customCrcl')}
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
            {formError && (
              <div role="alert" className="alert error" style={{ marginBottom: 12 }}>
                {formError}
              </div>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={disabled}
                startIcon={<Calculate />}
                sx={{ minWidth: 200, py: 1.5 }}
              >
                {disabled ? t('actions.calculating') : t('actions.calculate')}
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