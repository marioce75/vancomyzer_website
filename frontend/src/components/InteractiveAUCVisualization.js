import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Slider,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField
} from '@mui/material';
import {
  TrendingUp,
  Timeline,
  Functions,
  Speed
} from '@mui/icons-material';

const InteractiveAUCVisualization = ({ dosingResult, patient, onParameterChange }) => {
  const [dose, setDose] = useState(dosingResult?.recommended_dose_mg || 1000);
  const [interval, setInterval] = useState(dosingResult?.interval_hours || 12);
  const [calculatedAuc, setCalculatedAuc] = useState(dosingResult?.predicted_auc_24 || 400);
  const [calculatedTrough, setCalculatedTrough] = useState(dosingResult?.predicted_trough || 15);

  // Simplified pharmacokinetic calculations
  useEffect(() => {
    if (patient && dose && interval) {
      // Simplified AUC calculation: AUC = (Dose * 24) / (Interval * Clearance)
      const estimatedClearance = dosingResult?.clearance_l_per_h || 3.5; // L/h default
      const newAuc = (dose * 24) / (interval * estimatedClearance);
      
      // Simplified trough calculation based on half-life
      const halfLife = dosingResult?.half_life_hours || 6; // hours default
      const ke = 0.693 / halfLife; // elimination constant
      const concentrationAfterInfusion = dose / (dosingResult?.volume_distribution_l || 50); // mg/L
      const newTrough = concentrationAfterInfusion * Math.exp(-ke * interval);
      
      setCalculatedAuc(newAuc);
      setCalculatedTrough(Math.max(0, newTrough));
      
      // Notify parent component
      if (onParameterChange) {
        onParameterChange({ dose, interval, auc: newAuc, trough: newTrough });
      }
    }
  }, [dose, interval, patient, dosingResult, onParameterChange]);

  const handleDoseChange = (event, newValue) => {
    setDose(newValue);
  };

  const handleIntervalChange = (event) => {
    setInterval(event.target.value);
  };

  // AUC status determination
  const getAucStatus = (auc) => {
    if (auc >= 400 && auc <= 600) {
      return { status: 'Optimal', color: '#4caf50', bgColor: 'success.light' };
    } else if (auc > 600) {
      return { status: 'High Risk', color: '#f44336', bgColor: 'error.light' };
    } else {
      return { status: 'Suboptimal', color: '#ff9800', bgColor: 'warning.light' };
    }
  };

  const getTroughStatus = (trough) => {
    if (trough >= 10 && trough <= 20) {
      return { status: 'Optimal', color: '#4caf50' };
    } else if (trough > 20) {
      return { status: 'High Risk', color: '#f44336' };
    } else {
      return { status: 'Low', color: '#ff9800' };
    }
  };

  const aucStatus = getAucStatus(calculatedAuc);
  const troughStatus = getTroughStatus(calculatedTrough);

  // Generate concentration-time curve points (simplified)
  const generatePKCurve = () => {
    const points = [];
    const timePoints = 48; // 48 hours
    const ke = 0.693 / (dosingResult?.half_life_hours || 6);
    const vd = dosingResult?.volume_distribution_l || 50;
    const infusionTime = 1; // 1 hour infusion

    for (let i = 0; i <= timePoints; i++) {
      const time = i;
      let concentration = 0;
      
      // Add contribution from each dose
      const numberOfDoses = Math.floor(time / interval) + 1;
      for (let doseNum = 0; doseNum < numberOfDoses; doseNum++) {
        const timeFromDose = time - (doseNum * interval);
        if (timeFromDose >= 0) {
          if (timeFromDose <= infusionTime) {
            // During infusion
            const instantConc = (dose / vd) * (timeFromDose / infusionTime);
            concentration += instantConc;
          } else {
            // After infusion
            const maxConc = dose / vd;
            const timeAfterInfusion = timeFromDose - infusionTime;
            concentration += maxConc * Math.exp(-ke * timeAfterInfusion);
          }
        }
      }
      
      points.push({ time, concentration: Math.max(0, concentration) });
    }
    
    return points;
  };

  const pkCurve = generatePKCurve();
  const maxConcentration = Math.max(...pkCurve.map(p => p.concentration));

  // CSS-based curve visualization
  const CurveVisualization = () => {
    const svgHeight = 300;
    const svgWidth = 600;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;

    const xScale = (time) => (time / 48) * chartWidth;
    const yScale = (conc) => chartHeight - (conc / Math.max(maxConcentration, 40)) * chartHeight;

    const pathData = pkCurve.map((point, index) => {
      const x = xScale(point.time);
      const y = yScale(point.concentration);
      return index === 0 ? `M${x},${y}` : `L${x},${y}`;
    }).join(' ');

    return (
      <Box sx={{ width: '100%', height: 300, position: 'relative', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="50" height="30" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 30" fill="none" stroke="#e0e0e0" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Target range area */}
          <rect 
            x={margin.left} 
            y={margin.top + yScale(20)} 
            width={chartWidth} 
            height={yScale(10) - yScale(20)} 
            fill="rgba(76, 175, 80, 0.1)" 
          />
          
          {/* Concentration curve */}
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            <path
              d={pathData}
              fill="none"
              stroke="#1976d2"
              strokeWidth="3"
              style={{ 
                animation: 'drawLine 2s ease-in-out',
                strokeDasharray: pathData ? '1000' : '0',
                strokeDashoffset: '0'
              }}
            />
            
            {/* Target lines */}
            <line x1="0" y1={yScale(20)} x2={chartWidth} y2={yScale(20)} stroke="#4caf50" strokeDasharray="5,5" strokeWidth="2" />
            <line x1="0" y1={yScale(10)} x2={chartWidth} y2={yScale(10)} stroke="#4caf50" strokeDasharray="5,5" strokeWidth="2" />
            
            {/* Axis labels */}
            <text x={chartWidth / 2} y={chartHeight + 30} textAnchor="middle" fontSize="12" fill="#666">Time (hours)</text>
            <text x={-30} y={chartHeight / 2} textAnchor="middle" fontSize="12" fill="#666" transform={`rotate(-90, -30, ${chartHeight / 2})`}>
              Concentration (mg/L)
            </text>
          </g>
          
          {/* X-axis ticks */}
          <g transform={`translate(${margin.left}, ${svgHeight - margin.bottom})`}>
            {[0, 12, 24, 36, 48].map(tick => (
              <g key={tick}>
                <line x1={xScale(tick)} y1="0" x2={xScale(tick)} y2="5" stroke="#666" />
                <text x={xScale(tick)} y="18" textAnchor="middle" fontSize="10" fill="#666">{tick}</text>
              </g>
            ))}
          </g>
          
          {/* Y-axis ticks */}
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {[0, 10, 20, 30, 40].map(tick => (
              <g key={tick}>
                <line x1="-5" y1={yScale(tick)} x2="0" y2={yScale(tick)} stroke="#666" />
                <text x="-10" y={yScale(tick) + 3} textAnchor="end" fontSize="10" fill="#666">{tick}</text>
              </g>
            ))}
          </g>
        </svg>
        
        <style jsx>{`
          @keyframes drawLine {
            from {
              stroke-dashoffset: 1000;
            }
            to {
              stroke-dashoffset: 0;
            }
          }
        `}</style>
      </Box>
    );
  };

  return (
    <div className="fade-in">
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <TrendingUp sx={{ mr: 1 }} />
        Interactive AUC Visualization
      </Typography>

      <Grid container spacing={3}>
        {/* Controls */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
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
                  color="primary"
                  sx={{
                    '& .MuiSlider-thumb': {
                      transition: 'all 0.3s ease-in-out',
                      '&:hover': {
                        transform: 'scale(1.1)'
                      }
                    }
                  }}
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

              {/* Live Results */}
              <Paper sx={{ mt: 3, p: 2, bgcolor: aucStatus.bgColor, transition: 'all 0.5s ease' }}>
                <Typography variant="h6" gutterBottom>
                  Live Results
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h4" sx={{ mr: 1, fontWeight: 'bold' }}>
                    {calculatedAuc.toFixed(0)}
                  </Typography>
                  <Box>
                    <Typography variant="body2">mg·h/L AUC₀₋₂₄</Typography>
                    <Chip 
                      label={aucStatus.status} 
                      size="small" 
                      sx={{ 
                        bgcolor: aucStatus.color, 
                        color: 'white',
                        animation: 'pulse 2s ease-in-out infinite'
                      }} 
                    />
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="h5" sx={{ mr: 1 }}>
                    {calculatedTrough.toFixed(1)}
                  </Typography>
                  <Box>
                    <Typography variant="body2">mg/L Trough</Typography>
                    <Chip 
                      label={troughStatus.status} 
                      size="small" 
                      sx={{ bgcolor: troughStatus.color, color: 'white' }} 
                    />
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
                  Daily dose: {((dose * 24) / interval).toFixed(0)} mg
                  {patient && ` (${((dose * 24) / (interval * patient.weight_kg)).toFixed(1)} mg/kg/day)`}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Visualization */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Timeline sx={{ mr: 1, verticalAlign: 'middle' }} />
                Real-time Concentration-Time Curve
              </Typography>
              
              <CurveVisualization />
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Green zone:</strong> Target trough range (10-20 mg/L)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Updates automatically as you modify dose and interval
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* AUC Progress Visualization */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Functions sx={{ mr: 1, verticalAlign: 'middle' }} />
                AUC Target Achievement
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption">0</Typography>
                  <Typography variant="caption" color="success.main">400 (Target)</Typography>
                  <Typography variant="caption" color="success.main">600 (Target)</Typography>
                  <Typography variant="caption">800+</Typography>
                </Box>
                
                <Box sx={{ 
                  width: '100%', 
                  height: 30, 
                  bgcolor: 'grey.200', 
                  borderRadius: 2, 
                  overflow: 'hidden', 
                  position: 'relative',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {/* Target range background */}
                  <Box sx={{ 
                    position: 'absolute',
                    left: '50%',
                    width: '25%',
                    height: '100%',
                    bgcolor: 'success.light',
                    opacity: 0.5
                  }} />
                  
                  {/* Current AUC indicator */}
                  <Box sx={{ 
                    position: 'absolute',
                    left: `${Math.min((calculatedAuc / 800) * 100, 100)}%`,
                    width: 6,
                    height: '100%',
                    bgcolor: aucStatus.color,
                    borderRadius: 1,
                    transition: 'all 0.5s ease',
                    animation: calculatedAuc !== (dosingResult?.predicted_auc_24 || 400) ? 'slideIndicator 0.5s ease' : 'none',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: -8,
                      left: -2,
                      width: 10,
                      height: 10,
                      bgcolor: aucStatus.color,
                      borderRadius: '50%',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }
                  }} />
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Current AUC: <strong>{calculatedAuc.toFixed(0)} mg·h/L</strong> • 
                  Target: 400-600 mg·h/L • 
                  Status: <span style={{ color: aucStatus.color, fontWeight: 'bold' }}>{aucStatus.status}</span>
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary">
                <strong>Formula:</strong> AUC₀₋₂₄ = (Dose × 24h) ÷ (Interval × Clearance) = 
                ({dose} × 24) ÷ ({interval} × {(dosingResult?.clearance_l_per_h || 3.5).toFixed(2)}) = {' '}
                <strong style={{ color: aucStatus.color }}>{calculatedAuc.toFixed(0)} mg·h/L</strong>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes slideIndicator {
          from { transform: translateX(-10px); opacity: 0.7; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default InteractiveAUCVisualization;