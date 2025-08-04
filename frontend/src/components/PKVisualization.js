import React, { useState, useMemo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Paper,
  Divider,
  Chip
} from '@mui/material';
import {
  Timeline,
  ShowChart,
  TrendingUp,
  Science,
  Functions
} from '@mui/icons-material';
import Plot from 'react-plotly.js';

const PKVisualization = ({ dosingResult, bayesianResult, realTimeData, patient }) => {
  const [viewMode, setViewMode] = useState('concentration');
  const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(true);
  const [showTargetRanges, setShowTargetRanges] = useState(true);
  const [showMultipleDoses, setShowMultipleDoses] = useState(true);

  // Main concentration-time plot
  const concentrationPlot = useMemo(() => {
    if (!dosingResult && !realTimeData) return null;

    const data = dosingResult || realTimeData;
    const pkCurve = data.pk_curve || data.pk_curve;
    
    if (!pkCurve) return null;

    const traces = [];

    // Main PK curve
    traces.push({
      x: pkCurve.map(p => p.time),
      y: pkCurve.map(p => p.concentration),
      type: 'scatter',
      mode: 'lines',
      name: 'Predicted Concentration',
      line: { 
        color: '#1976d2', 
        width: 3,
        shape: 'spline' 
      },
      fill: 'tonexty',
      fillcolor: 'rgba(25, 118, 210, 0.1)'
    });

    // Target range
    if (showTargetRanges) {
      traces.push({
        x: pkCurve.map(p => p.time),
        y: Array(pkCurve.length).fill(20),
        type: 'scatter',
        mode: 'lines',
        name: 'Target Upper (20 mg/L)',
        line: { 
          color: '#4caf50', 
          width: 2,
          dash: 'dash' 
        },
        showlegend: false
      });

      traces.push({
        x: pkCurve.map(p => p.time),
        y: Array(pkCurve.length).fill(10),
        type: 'scatter',
        mode: 'lines',
        name: 'Target Range (10-20 mg/L)',
        fill: 'tonexty',
        fillcolor: 'rgba(76, 175, 80, 0.1)',
        line: { 
          color: '#4caf50', 
          width: 2,
          dash: 'dash' 
        }
      });
    }

    // Bayesian individual curve
    if (bayesianResult && bayesianResult.individual_pk_curve) {
      traces.push({
        x: bayesianResult.individual_pk_curve.map(p => p.time),
        y: bayesianResult.individual_pk_curve.map(p => p.concentration),
        type: 'scatter',
        mode: 'lines',
        name: 'Individual (Bayesian)',
        line: { 
          color: '#e91e63', 
          width: 3 
        }
      });

      // Population comparison
      if (bayesianResult.population_pk_curve) {
        traces.push({
          x: bayesianResult.population_pk_curve.map(p => p.time),
          y: bayesianResult.population_pk_curve.map(p => p.concentration),
          type: 'scatter',
          mode: 'lines',
          name: 'Population Average',
          line: { 
            color: '#757575', 
            width: 2,
            dash: 'dot' 
          }
        });
      }
    }

    return {
      data: traces,
      layout: {
        title: {
          text: 'Vancomycin Concentration-Time Profile',
          font: { size: 18 }
        },
        xaxis: {
          title: 'Time (hours)',
          gridcolor: 'rgba(0,0,0,0.1)',
          showgrid: true
        },
        yaxis: {
          title: 'Concentration (mg/L)',
          gridcolor: 'rgba(0,0,0,0.1)',
          showgrid: true,
          range: [0, Math.max(40, Math.max(...pkCurve.map(p => p.concentration)) * 1.2)]
        },
        hovermode: 'x unified',
        showlegend: true,
        legend: {
          x: 0.7,
          y: 1
        },
        margin: { l: 60, r: 30, t: 80, b: 60 },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
      },
      config: { 
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
      }
    };
  }, [dosingResult, realTimeData, bayesianResult, showTargetRanges]);

  // AUC visualization
  const aucVisualization = useMemo(() => {
    if (!dosingResult && !realTimeData) return null;

    const data = dosingResult || realTimeData;
    const auc = data.predicted_auc_24 || data.predicted_auc;
    
    // Create AUC breakdown pie chart
    const intervals = showMultipleDoses ? 3 : 1;
    const aucPerInterval = auc / intervals;

    return {
      data: [{
        type: 'bar',
        x: ['Current Regimen', 'Target Range'],
        y: [auc, 500], // 500 is middle of target range
        marker: {
          color: [
            auc >= 400 && auc <= 600 ? '#4caf50' : auc > 600 ? '#f44336' : '#ff9800',
            '#2196f3'
          ]
        },
        text: [`${auc.toFixed(0)} mg·h/L`, '400-600 mg·h/L'],
        textposition: 'auto',
      }],
      layout: {
        title: {
          text: 'AUC₀₋₂₄ Comparison',
          font: { size: 18 }
        },
        yaxis: {
          title: 'AUC₀₋₂₄ (mg·h/L)',
          range: [0, Math.max(auc * 1.2, 700)]
        },
        showlegend: false,
        margin: { l: 60, r: 30, t: 80, b: 60 }
      },
      config: { responsive: true }
    };
  }, [dosingResult, realTimeData, showMultipleDoses]);

  // Parameter comparison radar chart
  const parameterComparison = useMemo(() => {
    if (!bayesianResult) return null;

    return {
      data: [{
        type: 'scatterpolar',
        r: [
          bayesianResult.individual_clearance,
          bayesianResult.individual_volume,
          1 / (bayesianResult.individual_clearance / bayesianResult.individual_volume), // Half-life
          bayesianResult.model_fit_r_squared * 10 // Scale R² to 0-10
        ],
        theta: ['Clearance (L/h)', 'Volume (L)', 'Half-life (h)', 'Model Fit (R²×10)'],
        fill: 'toself',
        name: 'Individual',
        line: { color: '#e91e63' },
        fillcolor: 'rgba(233, 30, 99, 0.1)'
      }],
      layout: {
        title: {
          text: 'Individual vs Population Parameters',
          font: { size: 18 }
        },
        polar: {
          radialaxis: {
            visible: true,
            range: [0, 10]
          }
        },
        margin: { l: 80, r: 80, t: 80, b: 80 }
      },
      config: { responsive: true }
    };
  }, [bayesianResult]);

  // Dose-AUC relationship plot
  const doseAucPlot = useMemo(() => {
    if (!patient) return null;

    const doses = [500, 750, 1000, 1250, 1500, 1750, 2000];
    const intervals = [8, 12, 24];
    
    const traces = intervals.map(interval => {
      // Simplified AUC calculation based on dose and interval
      const clearance = dosingResult?.clearance_l_per_h || 3.5;
      
      return {
        x: doses,
        y: doses.map(dose => (dose * 24) / (interval * clearance)),
        type: 'scatter',
        mode: 'lines+markers',
        name: `q${interval}h`,
        line: { width: 2 }
      };
    });

    // Add target range
    traces.push({
      x: doses,
      y: Array(doses.length).fill(400),
      type: 'scatter',
      mode: 'lines',
      name: 'Target Lower',
      line: { color: '#4caf50', width: 1, dash: 'dash' },
      showlegend: false
    });

    traces.push({
      x: doses,
      y: Array(doses.length).fill(600),
      type: 'scatter',
      mode: 'lines',
      name: 'Target Range',
      fill: 'tonexty',
      fillcolor: 'rgba(76, 175, 80, 0.1)',
      line: { color: '#4caf50', width: 1, dash: 'dash' }
    });

    return {
      data: traces,
      layout: {
        title: {
          text: 'Dose-AUC Relationship',
          font: { size: 18 }
        },
        xaxis: {
          title: 'Dose (mg)',
          gridcolor: 'rgba(0,0,0,0.1)'
        },
        yaxis: {
          title: 'Predicted AUC₀₋₂₄ (mg·h/L)',
          gridcolor: 'rgba(0,0,0,0.1)'
        },
        hovermode: 'x unified',
        margin: { l: 60, r: 30, t: 80, b: 60 }
      },
      config: { responsive: true }
    };
  }, [patient, dosingResult]);

  if (!dosingResult && !realTimeData && !bayesianResult) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary" align="center">
            No data available for visualization. Please calculate dosing first.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="fade-in">
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <ShowChart sx={{ mr: 1 }} />
        Interactive Pharmacokinetic Visualization
      </Typography>

      {/* Control Panel */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>View Mode</InputLabel>
              <Select
                value={viewMode}
                label="View Mode"
                onChange={(e) => setViewMode(e.target.value)}
              >
                <MenuItem value="concentration">Concentration-Time</MenuItem>
                <MenuItem value="auc">AUC Analysis</MenuItem>
                <MenuItem value="parameters">Parameter Comparison</MenuItem>
                <MenuItem value="dose-response">Dose-AUC Relationship</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={showTargetRanges}
                  onChange={(e) => setShowTargetRanges(e.target.checked)}
                  size="small"
                />
              }
              label="Target Ranges"
            />
          </Grid>

          {bayesianResult && (
            <Grid item>
              <FormControlLabel
                control={
                  <Switch
                    checked={showConfidenceIntervals}
                    onChange={(e) => setShowConfidenceIntervals(e.target.checked)}
                    size="small"
                  />
                }
                label="Confidence Intervals"
              />
            </Grid>
          )}

          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={showMultipleDoses}
                  onChange={(e) => setShowMultipleDoses(e.target.checked)}
                  size="small"
                />
              }
              label="Multiple Doses"
            />
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Main Visualization */}
        <Grid item xs={12} lg={8}>
          <Card className="interactive-chart">
            <CardContent>
              <Box sx={{ height: 500 }}>
                {viewMode === 'concentration' && concentrationPlot && (
                  <Plot
                    data={concentrationPlot.data}
                    layout={concentrationPlot.layout}
                    config={concentrationPlot.config}
                    style={{ width: '100%', height: '100%' }}
                  />
                )}

                {viewMode === 'auc' && aucVisualization && (
                  <Plot
                    data={aucVisualization.data}
                    layout={aucVisualization.layout}
                    config={aucVisualization.config}
                    style={{ width: '100%', height: '100%' }}
                  />
                )}

                {viewMode === 'parameters' && parameterComparison && (
                  <Plot
                    data={parameterComparison.data}
                    layout={parameterComparison.layout}
                    config={parameterComparison.config}
                    style={{ width: '100%', height: '100%' }}
                  />
                )}

                {viewMode === 'dose-response' && doseAucPlot && (
                  <Plot
                    data={doseAucPlot.data}
                    layout={doseAucPlot.layout}
                    config={doseAucPlot.config}
                    style={{ width: '100%', height: '100%' }}
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Side Panel */}
        <Grid item xs={12} lg={4}>
          {/* Key Metrics */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Functions sx={{ mr: 1, verticalAlign: 'middle' }} />
                Key Metrics
              </Typography>

              {dosingResult && (
                <Box>
                  <Chip 
                    label={`AUC: ${dosingResult.predicted_auc_24.toFixed(0)} mg·h/L`}
                    color={dosingResult.predicted_auc_24 >= 400 && dosingResult.predicted_auc_24 <= 600 ? 'success' : 'warning'}
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip 
                    label={`Trough: ${dosingResult.predicted_trough.toFixed(1)} mg/L`}
                    color={dosingResult.predicted_trough >= 10 && dosingResult.predicted_trough <= 20 ? 'success' : 'warning'}
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip 
                    label={`Half-life: ${dosingResult.half_life_hours.toFixed(1)} h`}
                    color="info"
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip 
                    label={`Clearance: ${dosingResult.clearance_l_per_h.toFixed(2)} L/h`}
                    color="secondary"
                    sx={{ mb: 1 }}
                  />
                </Box>
              )}

              {bayesianResult && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Bayesian Results
                  </Typography>
                  <Chip 
                    label={`R²: ${bayesianResult.model_fit_r_squared.toFixed(3)}`}
                    color={bayesianResult.model_fit_r_squared > 0.8 ? 'success' : 'warning'}
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip 
                    label={`Converged: ${bayesianResult.convergence_achieved ? 'Yes' : 'No'}`}
                    color={bayesianResult.convergence_achieved ? 'success' : 'error'}
                    sx={{ mb: 1 }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Clinical Interpretation */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Science sx={{ mr: 1, verticalAlign: 'middle' }} />
                Clinical Interpretation
              </Typography>

              {dosingResult && (
                <Box>
                  <Typography variant="body2" paragraph>
                    <strong>Target Achievement:</strong> {' '}
                    {dosingResult.target_achievement_probability > 0.8 ? 'High' : 
                     dosingResult.target_achievement_probability > 0.6 ? 'Moderate' : 'Low'} 
                    ({(dosingResult.target_achievement_probability * 100).toFixed(0)}%)
                  </Typography>

                  {dosingResult.safety_warnings.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="warning.main" gutterBottom>
                        Safety Warnings:
                      </Typography>
                      {dosingResult.safety_warnings.map((warning, idx) => (
                        <Typography key={idx} variant="body2" color="warning.dark" paragraph>
                          {warning}
                        </Typography>
                      ))}
                    </Box>
                  )}

                  <Typography variant="subtitle2" gutterBottom>
                    Monitoring:
                  </Typography>
                  {dosingResult.monitoring_recommendations.slice(0, 3).map((rec, idx) => (
                    <Typography key={idx} variant="body2" paragraph>
                      {rec}
                    </Typography>
                  ))}
                </Box>
              )}

              {bayesianResult && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Bayesian Analysis:
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Individual clearance is {' '}
                    {((bayesianResult.individual_clearance / 3.5) * 100).toFixed(0)}% 
                    of population average.
                  </Typography>
                  <Typography variant="body2">
                    Model explains {(bayesianResult.model_fit_r_squared * 100).toFixed(1)}% 
                    of observed variability.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </div>
  );
};

export default PKVisualization;