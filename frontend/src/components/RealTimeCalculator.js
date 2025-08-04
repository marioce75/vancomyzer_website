import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Slider,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Paper,
  Divider
} from '@mui/material';
import { Timeline, TrendingUp, Calculate } from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const RealTimeCalculator = ({ patient, onDoseChange, onIntervalChange, onDataUpdate }) => {
  const [dose, setDose] = useState(1000);
  const [interval, setInterval] = useState(12);
  const [infusionTime, setInfusionTime] = useState(1.0);
  const [pkData, setPkData] = useState(null);
  const [calculationDetails, setCalculationDetails] = useState(null);
  const wsRef = useRef(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!patient) return;

    const connectWebSocket = () => {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/realtime-calc`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        sendCalculationRequest();
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setPkData(data);
        setCalculationDetails({
          predictedAuc: data.predicted_auc,
          predictedTrough: data.predicted_trough,
          pkParameters: data.pk_parameters,
          timestamp: data.timestamp
        });
        onDataUpdate && onDataUpdate(data);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected, attempting to reconnect...');
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [patient, onDataUpdate]);

  const sendCalculationRequest = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && patient) {
      const request = {
        patient: patient,
        dose: dose,
        interval: interval,
        infusion_time: infusionTime
      };
      wsRef.current.send(JSON.stringify(request));
    }
  }, [patient, dose, interval, infusionTime]);

  // Send calculation request whenever parameters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      sendCalculationRequest();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [sendCalculationRequest]);

  const handleDoseChange = (event, newValue) => {
    setDose(newValue);
    onDoseChange && onDoseChange(newValue);
  };

  const handleIntervalChange = (event) => {
    const newInterval = event.target.value;
    setInterval(newInterval);
    onIntervalChange && onIntervalChange(newInterval);
  };

  const getAucColor = (auc) => {
    if (auc >= 400 && auc <= 600) return '#4caf50'; // Green - optimal
    if (auc >= 350 && auc <= 650) return '#ff9800'; // Orange - acceptable
    return '#f44336'; // Red - suboptimal
  };

  const getTroughColor = (trough) => {
    if (trough >= 10 && trough <= 20) return '#4caf50';
    if (trough > 20) return '#f44336';
    return '#ff9800';
  };

  // Chart configuration
  const chartData = pkData ? {
    labels: pkData.pk_curve.map(point => point.time.toFixed(1)),
    datasets: [
      {
        label: 'Vancomycin Concentration',
        data: pkData.pk_curve.map(point => point.concentration),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        borderWidth: 3,
        fill: 'origin',
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
      },
      {
        label: 'Target Range (10-20 mg/L)',
        data: Array(pkData.pk_curve.length).fill(20),
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: '+1',
        pointRadius: 0,
      },
      {
        label: '',
        data: Array(pkData.pk_curve.length).fill(10),
        borderColor: '#4caf50',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        showLine: true,
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: 'Real-time Vancomycin Concentration-Time Curve',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            if (context.datasetIndex === 0) {
              return `Concentration: ${context.parsed.y.toFixed(2)} mg/L`;
            }
            return null;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time (hours)'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Concentration (mg/L)'
        },
        min: 0,
        max: Math.max(40, pkData ? Math.max(...pkData.pk_curve.map(p => p.concentration)) * 1.2 : 40),
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        }
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    }
  };

  if (!patient) {
    return (
      <Alert severity="info">
        Please enter patient information first to use the real-time calculator.
      </Alert>
    );
  }

  return (
    <div className="fade-in">
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <TrendingUp sx={{ mr: 1 }} />
        Real-time Interactive Dosing Calculator
        <div className="real-time-indicator" style={{ marginLeft: 10 }} />
      </Typography>

      <Grid container spacing={3}>
        {/* Control Panel */}
        <Grid item xs={12} md={4}>
          <Card className="interactive-chart">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Calculate sx={{ mr: 1, verticalAlign: 'middle' }} />
                Dosing Parameters
              </Typography>

              {/* Dose Slider */}
              <Box sx={{ mt: 3 }}>
                <Typography gutterBottom>
                  Dose: <strong>{dose} mg</strong>
                </Typography>
                <Slider
                  value={dose}
                  onChange={handleDoseChange}
                  min={250}
                  max={2500}
                  step={125}
                  marks={[
                    { value: 500, label: '500' },
                    { value: 1000, label: '1000' },
                    { value: 1500, label: '1500' },
                    { value: 2000, label: '2000' }
                  ]}
                  className="dose-slider"
                  color="primary"
                />
              </Box>

              {/* Interval Selection */}
              <Box sx={{ mt: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Dosing Interval</InputLabel>
                  <Select
                    value={interval}
                    label="Dosing Interval"
                    onChange={handleIntervalChange}
                  >
                    <MenuItem value={8}>Every 8 hours</MenuItem>
                    <MenuItem value={12}>Every 12 hours</MenuItem>
                    <MenuItem value={24}>Every 24 hours</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Infusion Time */}
              <Box sx={{ mt: 3 }}>
                <TextField
                  fullWidth
                  label="Infusion Duration (hours)"
                  type="number"
                  value={infusionTime}
                  onChange={(e) => setInfusionTime(parseFloat(e.target.value) || 1.0)}
                  inputProps={{ min: 0.5, max: 4, step: 0.5 }}
                />
              </Box>

              {/* Patient Summary */}
              <Paper sx={{ mt: 3, p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Patient Summary
                </Typography>
                <Typography variant="body2">
                  {patient.population_type} • {patient.weight_kg} kg • 
                  SCr: {patient.serum_creatinine} mg/dL
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {patient.indication} ({patient.severity})
                </Typography>
              </Paper>
            </CardContent>
          </Card>

          {/* Real-time Results */}
          {calculationDetails && (
            <Card sx={{ mt: 2 }} className="interactive-chart">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Live Results
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Chip 
                    label={`AUC₀₋₂₄: ${calculationDetails.predictedAuc.toFixed(0)} mg·h/L`}
                    color={calculationDetails.predictedAuc >= 400 && calculationDetails.predictedAuc <= 600 ? 'success' : 'warning'}
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip 
                    label={`Trough: ${calculationDetails.predictedTrough.toFixed(1)} mg/L`}
                    color={calculationDetails.predictedTrough >= 10 && calculationDetails.predictedTrough <= 20 ? 'success' : 'warning'}
                    sx={{ mb: 1 }}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary">
                  Daily dose: {((dose * 24) / interval).toFixed(0)} mg
                  ({((dose * 24) / (interval * patient.weight_kg)).toFixed(1)} mg/kg/day)
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Real-time Chart */}
        <Grid item xs={12} md={8}>
          <Card className="interactive-chart">
            <CardContent>
              <Box sx={{ height: 400, position: 'relative' }}>
                {chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%' 
                  }}>
                    <Typography color="text.secondary">
                      Connecting to real-time calculator...
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* AUC Visualization */}
          {calculationDetails && (
            <Card sx={{ mt: 2 }} className="interactive-chart">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  AUC Analysis
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'white' }}>
                      <Typography variant="h4">
                        {calculationDetails.predictedAuc.toFixed(0)}
                      </Typography>
                      <Typography variant="body2">
                        Predicted AUC₀₋₂₄
                      </Typography>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white' }}>
                      <Typography variant="h4">
                        400-600
                      </Typography>
                      <Typography variant="body2">
                        Target Range
                      </Typography>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ 
                      p: 2, 
                      textAlign: 'center', 
                      bgcolor: calculationDetails.pkParameters.clearance < 2 ? 'warning.light' : 'info.light',
                      color: 'white' 
                    }}>
                      <Typography variant="h4">
                        {calculationDetails.pkParameters.clearance.toFixed(1)}
                      </Typography>
                      <Typography variant="body2">
                        Clearance (L/h)
                      </Typography>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'secondary.light', color: 'white' }}>
                      <Typography variant="h4">
                        {calculationDetails.pkParameters.half_life.toFixed(1)}
                      </Typography>
                      <Typography variant="body2">
                        Half-life (h)
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Formula:</strong> AUC₀₋₂₄ = (Dose × 24h) ÷ (Interval × Clearance) = 
                    ({dose} × 24) ÷ ({interval} × {calculationDetails.pkParameters.clearance.toFixed(2)}) = {' '}
                    {calculationDetails.predictedAuc.toFixed(0)} mg·h/L
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </div>
  );
};

export default RealTimeCalculator;