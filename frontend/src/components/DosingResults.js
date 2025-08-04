import React, { useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Alert,
  Paper,
  Divider,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error,
  Info,
  Timeline,
  LocalHospital,
  Speed,
  Functions,
  Visibility,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';

const DosingResults = ({ result, patient }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);

  if (!result) {
    return (
      <Alert severity="info">
        No dosing results available. Please calculate dosing first.
      </Alert>
    );
  }

  // Determine safety status
  const getSafetyStatus = () => {
    const auc = result.predicted_auc_24;
    const trough = result.predicted_trough;
    
    if (auc >= 400 && auc <= 600 && trough >= 10 && trough <= 20) {
      return { status: 'safe', color: 'success', icon: CheckCircle, message: 'Optimal dosing parameters' };
    } else if ((auc >= 350 && auc <= 650) || (trough >= 8 && trough <= 25)) {
      return { status: 'caution', color: 'warning', icon: Warning, message: 'Acceptable with monitoring' };
    } else {
      return { status: 'warning', color: 'error', icon: Error, message: 'Consider dose adjustment' };
    }
  };

  const safetyStatus = getSafetyStatus();
  const StatusIcon = safetyStatus.icon;

  return (
    <div className="fade-in">
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Timeline sx={{ mr: 1 }} />
        Dosing Results & Recommendations
      </Typography>

      <Grid container spacing={3}>
        {/* Main Dosing Recommendation */}
        <Grid item xs={12}>
          <Card className={`result-card ${safetyStatus.status}`}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StatusIcon sx={{ mr: 1, color: `${safetyStatus.color}.main` }} />
                <Typography variant="h6" color={`${safetyStatus.color}.main`}>
                  {safetyStatus.message}
                </Typography>
              </Box>
              
              <Typography variant="h4" color="primary" gutterBottom>
                {result.recommended_dose_mg} mg every {result.interval_hours} hours
              </Typography>
              
              <Typography variant="body1" color="text.secondary" paragraph>
                Daily dose: {result.daily_dose_mg.toFixed(0)} mg 
                ({result.mg_per_kg_per_day.toFixed(1)} mg/kg/day)
              </Typography>

              {result.loading_dose_mg && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Loading Dose Recommended:</strong> {result.loading_dose_mg} mg
                  </Typography>
                </Alert>
              )}

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Method: {result.calculation_method}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Key Metrics */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
                Predicted Pharmacokinetic Parameters
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h5" color="primary">
                      {result.predicted_auc_24.toFixed(0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      AUC₀₋₂₄ (mg·h/L)
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={Math.min((result.predicted_auc_24 / 600) * 100, 100)}
                      color={result.predicted_auc_24 >= 400 && result.predicted_auc_24 <= 600 ? 'success' : 'warning'}
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Target: 400-600
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h5" color="secondary">
                      {result.predicted_trough.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Trough (mg/L)
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={Math.min((result.predicted_trough / 25) * 100, 100)}
                      color={result.predicted_trough >= 10 && result.predicted_trough <= 20 ? 'success' : 'warning'}
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Target: 10-20
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h5" color="info.main">
                      {result.predicted_peak.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Peak (mg/L)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      1h post-infusion
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h5" color="success.main">
                      {(result.target_achievement_probability * 100).toFixed(0)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Target Achievement
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={result.target_achievement_probability * 100}
                      color={result.target_achievement_probability > 0.8 ? 'success' : 'warning'}
                      sx={{ mt: 1 }}
                    />
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Clinical Guidance */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <LocalHospital sx={{ mr: 1, verticalAlign: 'middle' }} />
                Clinical Guidance
              </Typography>

              {/* Safety Warnings */}
              {result.safety_warnings && result.safety_warnings.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="warning.main" gutterBottom>
                    Safety Warnings:
                  </Typography>
                  {result.safety_warnings.map((warning, idx) => (
                    <Alert key={idx} severity="warning" sx={{ mb: 1, fontSize: '0.875rem' }}>
                      {warning}
                    </Alert>
                  ))}
                </Box>
              )}

              {/* Quick Monitoring */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Key Monitoring:
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <Info sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Levels before 4th dose"
                      secondary="Allow steady state"
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Info sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Renal function q2-3d"
                      secondary="Monitor SCr, BUN"
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Info sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Hearing assessment"
                      secondary="If therapy >7 days"
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                </List>

                <Button
                  onClick={() => setShowMonitoring(!showMonitoring)}
                  endIcon={showMonitoring ? <ExpandLess /> : <ExpandMore />}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {showMonitoring ? 'Less' : 'More'} Monitoring Details
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Monitoring Guidelines */}
        <Grid item xs={12}>
          <Collapse in={showMonitoring}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Comprehensive Monitoring Guidelines
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Laboratory Monitoring:
                    </Typography>
                    <List dense>
                      {result.monitoring_recommendations.map((rec, idx) => (
                        <ListItem key={idx}>
                          <ListItemIcon>
                            <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={rec}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Clinical Assessment:
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Daily clinical response evaluation"
                          secondary="Temperature, WBC, infection markers"
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Fluid balance monitoring"
                          secondary="I/O, weight, edema assessment"
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Adverse effect screening"
                          secondary="Red man syndrome, infusion reactions"
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Collapse>
        </Grid>

        {/* Detailed PK Parameters */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Functions sx={{ mr: 1 }} />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Pharmacokinetic Details
                </Typography>
                <Button
                  onClick={() => setShowDetails(!showDetails)}
                  endIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
                >
                  {showDetails ? 'Hide' : 'Show'} Details
                </Button>
              </Box>

              <Collapse in={showDetails}>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Clearance
                      </Typography>
                      <Typography variant="h6">
                        {result.clearance_l_per_h.toFixed(2)} L/h
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Volume of Distribution
                      </Typography>
                      <Typography variant="h6">
                        {result.volume_distribution_l.toFixed(1)} L
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Half-life
                      </Typography>
                      <Typography variant="h6">
                        {result.half_life_hours.toFixed(1)} hours
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Creatinine Clearance
                      </Typography>
                      <Typography variant="h6">
                        {result.creatinine_clearance.toFixed(0)} mL/min
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="text.secondary" paragraph>
                  <strong>Calculation Method:</strong> {result.calculation_method}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Clinical Guidelines:</strong> ASHP/IDSA 2020 Vancomycin Therapeutic Monitoring Guidelines
                </Typography>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* Patient Summary */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom>
              Patient Summary
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {patient.population_type.charAt(0).toUpperCase() + patient.population_type.slice(1)} • 
              {patient.weight_kg} kg • 
              SCr: {patient.serum_creatinine} mg/dL • 
              {patient.indication.replace('_', ' ')} ({patient.severity})
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
};

export default DosingResults;