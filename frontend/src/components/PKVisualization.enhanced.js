import React, { useState, useMemo, lazy, Suspense } from 'react';
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
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ShowChart,
  Functions,
  Science
} from '@mui/icons-material';

// Lazy load Plotly to reduce initial bundle size
const Plot = lazy(() => import('react-plotly.js'));

const PKVisualization = ({ dosingResult, bayesianResult, realTimeData, patient }) => {
  const [viewMode, setViewMode] = useState('concentration');
  const [showTargetRanges, setShowTargetRanges] = useState(true);
  const [plotError, setPlotError] = useState(null);

  // Main concentration-time plot with memory-optimized approach
  const concentrationPlot = useMemo(() => {
    try {
      if (!dosingResult && !realTimeData) return null;

      const data = dosingResult || realTimeData;
      const pkCurve = data.pk_curve;
      
      if (!pkCurve || !Array.isArray(pkCurve)) {
        return null;
      }

      // Limit data points to prevent memory issues
      const maxPoints = 100;
      const step = Math.max(1, Math.floor(pkCurve.length / maxPoints));
      const limitedCurve = pkCurve.filter((_, index) => index % step === 0);

      const traces = [];

      // Main PK curve - simplified for memory efficiency
      traces.push({
        x: limitedCurve.map(p => p.time),
        y: limitedCurve.map(p => p.concentration),
        type: 'scatter',
        mode: 'lines',
        name: 'Predicted Concentration',
        line: { 
          color: '#1976d2', 
          width: 3
        },
        hovertemplate: 'Time: %{x}h<br>Concentration: %{y:.2f} mg/L<extra></extra>'
      });

      // Target range - only if enabled
      if (showTargetRanges) {
        const timePoints = limitedCurve.map(p => p.time);
        
        traces.push({
          x: timePoints,
          y: Array(timePoints.length).fill(20),
          type: 'scatter',
          mode: 'lines',
          name: 'Upper Target (20 mg/L)',
          line: { 
            color: '#4caf50', 
            width: 2,
            dash: 'dash' 
          },
          hoverinfo: 'skip',
          showlegend: false
        });

        traces.push({
          x: timePoints,
          y: Array(timePoints.length).fill(10),
          type: 'scatter',
          mode: 'lines',
          name: 'Target Range',
          fill: 'tonexty',
          fillcolor: 'rgba(76, 175, 80, 0.1)',
          line: { 
            color: '#4caf50', 
            width: 2,
            dash: 'dash' 
          },
          hoverinfo: 'skip'
        });
      }

      const maxConcentration = Math.max(...limitedCurve.map(p => p.concentration));

      return {
        data: traces,
        layout: {
          title: {
            text: 'Vancomycin Concentration-Time Profile',
            font: { size: 16 }
          },
          xaxis: {
            title: 'Time (hours)',
            showgrid: true,
            gridcolor: 'rgba(0,0,0,0.1)'
          },
          yaxis: {
            title: 'Concentration (mg/L)',
            showgrid: true,
            gridcolor: 'rgba(0,0,0,0.1)',
            range: [0, Math.max(40, maxConcentration * 1.2)]
          },
          hovermode: 'x unified',
          showlegend: true,
          legend: {
            x: 0.7,
            y: 1
          },
          margin: { l: 60, r: 30, t: 60, b: 50 },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          // Memory optimization
          autosize: true,
          responsive: true
        },
        config: { 
          responsive: true,
          displayModeBar: false, // Hide toolbar to save memory
          staticPlot: false
        }
      };
    } catch (error) {
      console.error('Error creating concentration plot:', error);
      setPlotError('Failed to create concentration plot');
      return null;
    }
  }, [dosingResult, realTimeData, showTargetRanges]);

  // AUC visualization - simplified bar chart
  const aucVisualization = useMemo(() => {
    try {
      if (!dosingResult && !realTimeData) return null;

      const data = dosingResult || realTimeData;
      const auc = data.predicted_auc_24 || data.predicted_auc;
      
      if (!auc) return null;

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
          hovertemplate: '%{y} mg·h/L<extra></extra>'
        }],
        layout: {
          title: {
            text: 'AUC₀₋₂₄ Comparison',
            font: { size: 16 }
          },
          yaxis: {
            title: 'AUC₀₋₂₄ (mg·h/L)',
            range: [0, Math.max(auc * 1.2, 700)]
          },
          showlegend: false,
          margin: { l: 60, r: 30, t: 60, b: 50 },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)'
        },
        config: { 
          responsive: true,
          displayModeBar: false
        }
      };
    } catch (error) {
      console.error('Error creating AUC plot:', error);
      setPlotError('Failed to create AUC plot');
      return null;
    }
  }, [dosingResult, realTimeData]);

  // Interactive AUC calculator
  const InteractiveAUC = ({ currentAuc }) => {
    const getAucStatus = (auc) => {
      if (auc >= 400 && auc <= 600) return { status: 'Optimal', color: 'success' };
      if (auc > 600) return { status: 'High Risk', color: 'error' };
      return { status: 'Suboptimal', color: 'warning' };
    };

    const status = getAucStatus(currentAuc);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Interactive AUC Analysis
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h3" color={`${status.color}.main`} sx={{ mr: 2 }}>
            {currentAuc.toFixed(0)}
          </Typography>
          <Box>
            <Typography variant="body1">mg·h/L</Typography>
            <Chip label={status.status} color={status.color} size="small" />
          </Box>
        </Box>
        
        {/* Visual progress bar */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption">0</Typography>
            <Typography variant="caption">400</Typography>
            <Typography variant="caption">600</Typography>
            <Typography variant="caption">800+</Typography>
          </Box>
          <Box sx={{ width: '100%', height: 20, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
            {/* Target range background */}
            <Box sx={{ 
              position: 'absolute',
              left: '50%',
              width: '25%',
              height: '100%',
              bgcolor: 'success.light',
              opacity: 0.3
            }} />
            
            {/* Current AUC indicator */}
            <Box sx={{ 
              position: 'absolute',
              left: `${Math.min((currentAuc / 800) * 100, 100)}%`,
              width: 4,
              height: '100%',
              bgcolor: status.color === 'success' ? 'success.main' : status.color === 'error' ? 'error.main' : 'warning.main',
              borderRadius: 1
            }} />
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary">
          <strong>Target Range:</strong> 400-600 mg·h/L (shown in green)
          <br />
          <strong>Current Position:</strong> {currentAuc < 400 ? 'Below target' : currentAuc > 600 ? 'Above target' : 'Within target'}
        </Typography>
      </Box>
    );
  };

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
                <MenuItem value="interactive">Interactive AUC</MenuItem>
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
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Main Visualization */}
        <Grid item xs={12} lg={8}>
          <Card className="interactive-chart">
            <CardContent>
              {plotError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {plotError}
                </Alert>
              )}
              
              <Box sx={{ height: 400 }}>
                {viewMode === 'concentration' && concentrationPlot && (
                  <Suspense fallback={<CircularProgress />}>
                    <Plot
                      data={concentrationPlot.data}
                      layout={concentrationPlot.layout}
                      config={concentrationPlot.config}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </Suspense>
                )}

                {viewMode === 'auc' && aucVisualization && (
                  <Suspense fallback={<CircularProgress />}>
                    <Plot
                      data={aucVisualization.data}
                      layout={aucVisualization.layout}
                      config={aucVisualization.config}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </Suspense>
                )}

                {viewMode === 'interactive' && (dosingResult || realTimeData) && (
                  <InteractiveAUC 
                    currentAuc={(dosingResult || realTimeData)?.predicted_auc_24 || 0}
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

              {(dosingResult || realTimeData) && (
                <Box>
                  <Chip 
                    label={`AUC: ${((dosingResult || realTimeData).predicted_auc_24 || 0).toFixed(0)} mg·h/L`}
                    color={(dosingResult || realTimeData).predicted_auc_24 >= 400 && (dosingResult || realTimeData).predicted_auc_24 <= 600 ? 'success' : 'warning'}
                    sx={{ mr: 1, mb: 1 }}
                  />
                  {(dosingResult || realTimeData).predicted_trough && (
                    <Chip 
                      label={`Trough: ${(dosingResult || realTimeData).predicted_trough.toFixed(1)} mg/L`}
                      color={(dosingResult || realTimeData).predicted_trough >= 10 && (dosingResult || realTimeData).predicted_trough <= 20 ? 'success' : 'warning'}
                      sx={{ mr: 1, mb: 1 }}
                    />
                  )}
                  {(dosingResult || realTimeData).half_life_hours && (
                    <Chip 
                      label={`Half-life: ${(dosingResult || realTimeData).half_life_hours.toFixed(1)} h`}
                      color="info"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  )}
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

              {(dosingResult || realTimeData) && (
                <Box>
                  <Typography variant="body2" paragraph>
                    <strong>AUC Status:</strong> {' '}
                    {(() => {
                      const auc = (dosingResult || realTimeData).predicted_auc_24;
                      if (auc >= 400 && auc <= 600) return 'Optimal target range';
                      if (auc > 600) return 'Above target - consider dose reduction';
                      return 'Below target - consider dose increase';
                    })()}
                  </Typography>

                  <Typography variant="body2" paragraph>
                    <strong>Monitoring:</strong> Draw levels before 4th dose for steady-state assessment
                  </Typography>

                  <Typography variant="body2">
                    <strong>Next Steps:</strong> Monitor renal function and clinical response
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