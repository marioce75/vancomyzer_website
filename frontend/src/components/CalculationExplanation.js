import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Paper,
  Chip,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Functions,
  ExpandMore,
  Calculate,
  TrendingUp,
  Science
} from '@mui/icons-material';

const CalculationExplanation = ({ dosingResult, patient }) => {
  const [activeStep, setActiveStep] = useState(0);

  if (!dosingResult || !patient) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary" align="center">
            No calculation data available. Please calculate dosing first.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const calculationSteps = [
    {
      label: 'Patient Assessment',
      description: 'Evaluate patient characteristics and clinical factors'
    },
    {
      label: 'Pharmacokinetic Parameters',
      description: 'Calculate individual PK parameters based on patient data'
    },
    {
      label: 'Target AUC Determination',
      description: 'Select appropriate AUC target based on indication and severity'
    },
    {
      label: 'Dose & Interval Calculation',
      description: 'Calculate optimal dose and interval using PK principles'
    },
    {
      label: 'Safety Assessment',
      description: 'Evaluate predicted levels and safety considerations'
    }
  ];

  const getStepContent = (stepIndex) => {
    switch (stepIndex) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Patient Assessment</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Demographics</Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Population:</strong> {patient.population_type}<br/>
                    <strong>Age:</strong> {patient.age_years ? `${patient.age_years} years` : 
                      `${patient.gestational_age_weeks} weeks GA, ${patient.postnatal_age_days} days PNA`}<br/>
                    <strong>Weight:</strong> {patient.weight_kg} kg<br/>
                    <strong>Gender:</strong> {patient.gender}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Clinical Status</Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Indication:</strong> {patient.indication.replace('_', ' ')}<br/>
                    <strong>Severity:</strong> {patient.severity}<br/>
                    <strong>Serum Creatinine:</strong> {patient.serum_creatinine} mg/dL<br/>
                    <strong>Renal Status:</strong> {patient.is_renal_stable ? 'Stable' : 'Unstable'}
                    {patient.is_on_hemodialysis && <><br/><strong>Hemodialysis:</strong> Yes</>}
                    {patient.is_on_crrt && <><br/><strong>CRRT:</strong> Yes</>}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Pharmacokinetic Parameter Calculation</Typography>
            
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Clearance Calculation</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box className="calculation-step">
                  <Typography variant="body2" paragraph>
                    Clearance is calculated using population pharmacokinetic models adjusted for patient-specific factors:
                  </Typography>
                  <div className="formula">
                    {patient.population_type === 'adult' ? (
                      <>
                        CL<sub>vanc</sub> = CL<sub>pop</sub> × (Weight/70) × (CrCl/120) × Age<sub>factor</sub><br/>
                        CL<sub>vanc</sub> = 3.5 × ({patient.weight_kg}/70) × ({dosingResult.creatinine_clearance.toFixed(0)}/120) × 1.0<br/>
                        CL<sub>vanc</sub> = {dosingResult.clearance_l_per_h.toFixed(2)} L/h
                      </>
                    ) : patient.population_type === 'pediatric' ? (
                      <>
                        CL<sub>vanc</sub> = 0.1 × Weight × (CrCl/120)<br/>
                        CL<sub>vanc</sub> = 0.1 × {patient.weight_kg} × ({dosingResult.creatinine_clearance.toFixed(0)}/120)<br/>
                        CL<sub>vanc</sub> = {dosingResult.clearance_l_per_h.toFixed(2)} L/h
                      </>
                    ) : (
                      <>
                        CL<sub>vanc</sub> = CL<sub>base</sub> × Weight<sub>factor</sub> × GA<sub>factor</sub> × PNA<sub>factor</sub><br/>
                        CL<sub>vanc</sub> = {dosingResult.clearance_l_per_h.toFixed(2)} L/h
                      </>
                    )}
                  </div>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Factors considered:</strong> Body weight, renal function, age, population-specific parameters
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Volume of Distribution</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box className="calculation-step">
                  <Typography variant="body2" paragraph>
                    Volume of distribution is calculated based on total body weight:
                  </Typography>
                  <div className="formula">
                    V<sub>d</sub> = V<sub>d,specific</sub> × Weight<br/>
                    V<sub>d</sub> = 0.7 × {patient.weight_kg}<br/>
                    V<sub>d</sub> = {dosingResult.volume_distribution_l.toFixed(1)} L
                  </div>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Derived Parameters</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box className="calculation-step">
                  <Typography variant="body2" paragraph>
                    Additional pharmacokinetic parameters derived from clearance and volume:
                  </Typography>
                  <div className="formula">
                    k<sub>el</sub> = CL / V<sub>d</sub> = {dosingResult.clearance_l_per_h.toFixed(2)} / {dosingResult.volume_distribution_l.toFixed(1)} = {dosingResult.elimination_rate_constant.toFixed(4)} h⁻¹<br/><br/>
                    t<sub>½</sub> = 0.693 / k<sub>el</sub> = 0.693 / {dosingResult.elimination_rate_constant.toFixed(4)} = {dosingResult.half_life_hours.toFixed(1)} hours
                  </div>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Target AUC Determination</Typography>
            <Box className="calculation-step">
              <Typography variant="body2" paragraph>
                Target AUC is selected based on infection type and severity following ASHP/IDSA 2020 guidelines:
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Base Target</Typography>
                    <Typography variant="body2">
                      <strong>{patient.indication.replace('_', ' ')}:</strong> {
                        patient.indication === 'pneumonia' || patient.indication === 'bacteremia' ? '450' :
                        patient.indication === 'endocarditis' || patient.indication === 'osteomyelitis' ? '500' :
                        patient.indication === 'meningitis' ? '550' : '400'
                      } mg·h/L
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Severity Adjustment</Typography>
                    <Typography variant="body2">
                      <strong>{patient.severity}:</strong> {
                        patient.severity === 'severe' ? '×1.1' :
                        patient.severity === 'mild' ? '×0.95' : '×1.0'
                      } multiplier
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <div className="formula">
                Target AUC = Base Target × Severity Factor<br/>
                Target AUC = {
                  (patient.indication === 'pneumonia' || patient.indication === 'bacteremia' ? 450 :
                   patient.indication === 'endocarditis' || patient.indication === 'osteomyelitis' ? 500 :
                   patient.indication === 'meningitis' ? 550 : 400)
                } × {
                  patient.severity === 'severe' ? '1.1' :
                  patient.severity === 'mild' ? '0.95' : '1.0'
                } = {Math.round(dosingResult.predicted_auc_24 / (dosingResult.daily_dose_mg / (dosingResult.clearance_l_per_h * 24)))} mg·h/L
              </div>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Dose & Interval Calculation</Typography>
            
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Daily Dose Calculation</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box className="calculation-step">
                  <Typography variant="body2" paragraph>
                    Daily dose is calculated to achieve target AUC using first-order kinetics:
                  </Typography>
                  <div className="formula">
                    Daily Dose = Target AUC × Clearance<br/>
                    Daily Dose = {Math.round(dosingResult.predicted_auc_24 / (dosingResult.daily_dose_mg / (dosingResult.clearance_l_per_h * 24)))} × {dosingResult.clearance_l_per_h.toFixed(2)}<br/>
                    Daily Dose = {dosingResult.daily_dose_mg.toFixed(0)} mg/day
                  </div>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Interval Selection</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box className="calculation-step">
                  <Typography variant="body2" paragraph>
                    Dosing interval is selected based on half-life to maintain therapeutic levels:
                  </Typography>
                  <div className="formula">
                    Half-life = {dosingResult.half_life_hours.toFixed(1)} hours<br/>
                    {dosingResult.half_life_hours <= 6 ? 'Recommended interval: 8 hours (short half-life)' :
                     dosingResult.half_life_hours <= 12 ? 'Recommended interval: 12 hours (moderate half-life)' :
                     'Recommended interval: 24 hours (long half-life)'}
                  </div>
                  <Typography variant="body2" paragraph sx={{ mt: 2 }}>
                    <strong>Selected interval:</strong> {dosingResult.interval_hours} hours
                  </Typography>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Individual Dose</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box className="calculation-step">
                  <Typography variant="body2" paragraph>
                    Individual dose per interval:
                  </Typography>
                  <div className="formula">
                    Dose per Interval = Daily Dose × (Interval / 24)<br/>
                    Dose per Interval = {dosingResult.daily_dose_mg.toFixed(0)} × ({dosingResult.interval_hours} / 24)<br/>
                    Dose per Interval = {(dosingResult.daily_dose_mg * dosingResult.interval_hours / 24).toFixed(0)} mg<br/>
                    <em>Rounded to practical dose: {dosingResult.recommended_dose_mg} mg</em>
                  </div>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        );

      case 4:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Safety Assessment & Predictions</Typography>
            
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Level Predictions</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box className="calculation-step">
                  <Typography variant="body2" paragraph>
                    Steady-state concentrations are predicted using pharmacokinetic principles:
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>AUC₀₋₂₄ Calculation:</Typography>
                  <div className="formula">
                    AUC₀₋₂₄ = Daily Dose / Clearance<br/>
                    AUC₀₋₂₄ = {dosingResult.daily_dose_mg.toFixed(0)} / {dosingResult.clearance_l_per_h.toFixed(2)}<br/>
                    AUC₀₋₂₄ = {dosingResult.predicted_auc_24.toFixed(0)} mg·h/L
                  </div>

                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Trough Prediction:</Typography>
                  <div className="formula">
                    C<sub>trough</sub> = (Dose/V<sub>d</sub>) × e<sup>-kt</sup> / (1 - e<sup>-kτ</sup>)<br/>
                    C<sub>trough</sub> = {dosingResult.predicted_trough.toFixed(1)} mg/L
                  </div>

                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Peak Prediction:</Typography>
                  <div className="formula">
                    C<sub>peak</sub> = (Dose/(V<sub>d</sub>×k×t<sub>inf</sub>)) × (1 - e<sup>-kt<sub>inf</sub></sup>)<br/>
                    C<sub>peak</sub> = {dosingResult.predicted_peak.toFixed(1)} mg/L
                  </div>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">Safety Analysis</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Target Achievement</Typography>
                      <Chip 
                        label={`AUC: ${dosingResult.predicted_auc_24.toFixed(0)} mg·h/L`}
                        color={dosingResult.predicted_auc_24 >= 400 && dosingResult.predicted_auc_24 <= 600 ? 'success' : 'warning'}
                        sx={{ mr: 1, mb: 1 }}
                      />
                      <Chip 
                        label={`Trough: ${dosingResult.predicted_trough.toFixed(1)} mg/L`}
                        color={dosingResult.predicted_trough >= 10 && dosingResult.predicted_trough <= 20 ? 'success' : 'warning'}
                      />
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        <strong>Target Probability:</strong> {(dosingResult.target_achievement_probability * 100).toFixed(0)}%
                      </Typography>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Safety Warnings</Typography>
                      {dosingResult.safety_warnings.length > 0 ? (
                        dosingResult.safety_warnings.map((warning, idx) => (
                          <Typography key={idx} variant="body2" color="warning.dark" paragraph>
                            {warning}
                          </Typography>
                        ))
                      ) : (
                        <Typography variant="body2" color="success.dark">
                          No safety warnings identified
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  return (
    <div className="fade-in">
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Functions sx={{ mr: 1 }} />
        Step-by-Step Calculation Breakdown
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ position: 'sticky', top: 20 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Calculation Steps
              </Typography>
              <Stepper activeStep={activeStep} orientation="vertical">
                {calculationSteps.map((step, index) => (
                  <Step key={step.label}>
                    <StepLabel
                      onClick={() => setActiveStep(index)}
                      sx={{ cursor: 'pointer' }}
                    >
                      {step.label}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              {getStepContent(activeStep)}
              
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((prev) => prev - 1)}
                >
                  Previous
                </Button>
                <Button
                  disabled={activeStep === calculationSteps.length - 1}
                  onClick={() => setActiveStep((prev) => prev + 1)}
                  variant="contained"
                >
                  Next
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Summary Card */}
      <Card sx={{ mt: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <Calculate sx={{ mr: 1, verticalAlign: 'middle' }} />
            Calculation Summary
          </Typography>
          <Typography variant="body1">
            Final Recommendation: <strong>{dosingResult.recommended_dose_mg} mg every {dosingResult.interval_hours} hours</strong>
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
            This dosing regimen is predicted to achieve an AUC₀₋₂₄ of {dosingResult.predicted_auc_24.toFixed(0)} mg·h/L 
            with a trough level of {dosingResult.predicted_trough.toFixed(1)} mg/L, following ASHP/IDSA 2020 evidence-based guidelines.
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalculationExplanation;