import React, { useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import {
  Science,
  Add,
  Delete,
  Timeline,
  TrendingUp,
  Assessment,
  Info
} from '@mui/icons-material';
import { formatLevelForAPI } from '../services/api';

const BayesianOptimization = ({ patient, onOptimize, result, disabled = false }) => {
  const [levels, setLevels] = useState([]);
  const [showLevelDialog, setShowLevelDialog] = useState(false);
  const [currentLevel, setCurrentLevel] = useState({
    concentration: '',
    time_after_dose_hours: '',
    dose_given_mg: '',
    infusion_duration_hours: '1.0',
    level_type: 'trough',
    draw_time: new Date().toISOString().slice(0, 16),
    notes: ''
  });
  const [editingIndex, setEditingIndex] = useState(-1);

  const handleAddLevel = () => {
    setCurrentLevel({
      concentration: '',
      time_after_dose_hours: '',
      dose_given_mg: '',
      infusion_duration_hours: '1.0',
      level_type: 'trough',
      draw_time: new Date().toISOString().slice(0, 16),
      notes: ''
    });
    setEditingIndex(-1);
    setShowLevelDialog(true);
  };

  const handleEditLevel = (index) => {
    setCurrentLevel(levels[index]);
    setEditingIndex(index);
    setShowLevelDialog(true);
  };

  const handleSaveLevel = () => {
    if (!isLevelValid()) return;

    const newLevels = [...levels];
    const formattedLevel = formatLevelForAPI(currentLevel);
    
    if (editingIndex >= 0) {
      newLevels[editingIndex] = formattedLevel;
    } else {
      newLevels.push(formattedLevel);
    }
    
    setLevels(newLevels);
    setShowLevelDialog(false);
  };

  const handleDeleteLevel = (index) => {
    const newLevels = levels.filter((_, idx) => idx !== index);
    setLevels(newLevels);
  };

  const isLevelValid = () => {
    return (
      currentLevel.concentration &&
      currentLevel.time_after_dose_hours &&
      currentLevel.dose_given_mg &&
      parseFloat(currentLevel.concentration) > 0 &&
      parseFloat(currentLevel.time_after_dose_hours) > 0 &&
      parseFloat(currentLevel.dose_given_mg) > 0
    );
  };

  const handleOptimize = () => {
    if (levels.length > 0) {
      onOptimize(levels);
    }
  };

  const getLevelTypeColor = (type) => {
    switch (type) {
      case 'trough': return 'primary';
      case 'peak': return 'secondary';
      case 'random': return 'default';
      default: return 'default';
    }
  };

  const getInterpretation = (concentration, type) => {
    if (type === 'trough') {
      if (concentration < 10) return { status: 'Low', color: 'warning' };
      if (concentration > 20) return { status: 'High', color: 'error' };
      return { status: 'Target', color: 'success' };
    } else if (type === 'peak') {
      if (concentration < 20) return { status: 'Low', color: 'warning' };
      if (concentration > 40) return { status: 'High', color: 'error' };
      return { status: 'Target', color: 'success' };
    }
    return { status: 'N/A', color: 'default' };
  };

  if (!patient) {
    return (
      <Alert severity="info">
        Please enter patient information first to use Bayesian optimization.
      </Alert>
    );
  }

  return (
    <div className="fade-in">
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Science sx={{ mr: 1 }} />
        Bayesian Optimization
      </Typography>

      <Grid container spacing={3}>
        {/* Level Entry Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">
                  Vancomycin Levels
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={handleAddLevel}
                >
                  Add Level
                </Button>
              </Box>

              {levels.length === 0 ? (
                <Alert severity="info">
                  <Typography variant="body2">
                    Add at least one vancomycin level to perform Bayesian optimization. 
                    More levels provide better parameter estimation.
                  </Typography>
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Concentration</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {levels.map((level, index) => {
                        const interpretation = getInterpretation(level.concentration, level.level_type);
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip
                                label={level.level_type}
                                size="small"
                                color={getLevelTypeColor(level.level_type)}
                              />
                            </TableCell>
                            <TableCell>
                              {level.concentration} mg/L
                            </TableCell>
                            <TableCell>
                              {level.time_after_dose_hours}h post-dose
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={interpretation.status}
                                size="small"
                                color={interpretation.color}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => handleEditLevel(index)}
                              >
                                <Assessment fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteLevel(index)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  startIcon={<TrendingUp />}
                  onClick={handleOptimize}
                  disabled={disabled || levels.length === 0}
                  size="large"
                >
                  {disabled ? 'Optimizing...' : 'Optimize Dosing'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Results Section */}
        <Grid item xs={12} md={6}>
          {result ? (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Timeline sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Optimization Results
                </Typography>

                {/* Key Results */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'primary.light', color: 'white' }}>
                      <Typography variant="h6">
                        {result.individual_clearance.toFixed(2)}
                      </Typography>
                      <Typography variant="body2">
                        Individual CL (L/h)
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'secondary.light', color: 'white' }}>
                      <Typography variant="h6">
                        {result.individual_volume.toFixed(1)}
                      </Typography>
                      <Typography variant="body2">
                        Individual Vd (L)
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Model Performance */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Model Performance
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={`R² = ${result.model_fit_r_squared.toFixed(3)}`}
                      color={result.model_fit_r_squared > 0.8 ? 'success' : 'warning'}
                      variant="outlined"
                    />
                    <Chip
                      label={result.convergence_achieved ? 'Converged' : 'No Convergence'}
                      color={result.convergence_achieved ? 'success' : 'error'}
                      variant="outlined"
                    />
                    <Chip
                      label={`${result.iterations_used} iterations`}
                      color="info"
                      variant="outlined"
                    />
                  </Box>
                </Box>

                {/* Confidence Intervals */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    95% Confidence Intervals
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Clearance:</strong> {result.clearance_ci_lower.toFixed(2)} - {result.clearance_ci_upper.toFixed(2)} L/h
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Volume:</strong> {result.volume_ci_lower.toFixed(1)} - {result.volume_ci_upper.toFixed(1)} L
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Predicted AUC:</strong> {result.predicted_auc_ci_lower.toFixed(0)} - {result.predicted_auc_ci_upper.toFixed(0)} mg·h/L
                  </Typography>
                  <Typography variant="body2">
                    <strong>Predicted Trough:</strong> {result.predicted_trough_ci_lower.toFixed(1)} - {result.predicted_trough_ci_upper.toFixed(1)} mg/L
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Science sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Ready for Bayesian Optimization
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add vancomycin levels and click "Optimize Dosing" to get 
                    patient-specific pharmacokinetic parameters.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Information Panel */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Info sx={{ mr: 1 }} />
                <Typography variant="h6">
                  About Bayesian Optimization
                </Typography>
              </Box>
              <Typography variant="body2" paragraph>
                Bayesian optimization uses measured vancomycin levels to estimate individual pharmacokinetic 
                parameters, providing more accurate dosing predictions than population-based methods alone.
              </Typography>
              <Typography variant="body2" paragraph>
                <strong>Best practices:</strong>
              </Typography>
              <Typography component="ul" variant="body2" sx={{ ml: 2 }}>
                <li>Use at least 1-2 levels for basic optimization</li>
                <li>Both trough and peak levels provide the most information</li>
                <li>Ensure accurate timing documentation</li>
                <li>Wait for steady state (4th dose) when possible</li>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Level Entry Dialog */}
      <Dialog open={showLevelDialog} onClose={() => setShowLevelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingIndex >= 0 ? 'Edit' : 'Add'} Vancomycin Level
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Concentration (mg/L)"
                type="number"
                value={currentLevel.concentration}
                onChange={(e) => setCurrentLevel(prev => ({ ...prev, concentration: e.target.value }))}
                inputProps={{ min: 0.1, max: 100, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Time After Dose (hours)"
                type="number"
                value={currentLevel.time_after_dose_hours}
                onChange={(e) => setCurrentLevel(prev => ({ ...prev, time_after_dose_hours: e.target.value }))}
                inputProps={{ min: 0.1, max: 72, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Dose Given (mg)"
                type="number"
                value={currentLevel.dose_given_mg}
                onChange={(e) => setCurrentLevel(prev => ({ ...prev, dose_given_mg: e.target.value }))}
                inputProps={{ min: 125, max: 4000, step: 125 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Infusion Duration (hours)"
                type="number"
                value={currentLevel.infusion_duration_hours}
                onChange={(e) => setCurrentLevel(prev => ({ ...prev, infusion_duration_hours: e.target.value }))}
                inputProps={{ min: 0.5, max: 4, step: 0.5 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Level Type</InputLabel>
                <Select
                  value={currentLevel.level_type}
                  label="Level Type"
                  onChange={(e) => setCurrentLevel(prev => ({ ...prev, level_type: e.target.value }))}
                >
                  <MenuItem value="trough">Trough</MenuItem>
                  <MenuItem value="peak">Peak</MenuItem>
                  <MenuItem value="random">Random</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Draw Time"
                type="datetime-local"
                value={currentLevel.draw_time}
                onChange={(e) => setCurrentLevel(prev => ({ ...prev, draw_time: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (optional)"
                multiline
                rows={2}
                value={currentLevel.notes}
                onChange={(e) => setCurrentLevel(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional clinical information..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLevelDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveLevel} variant="contained" disabled={!isLevelValid()}>
            {editingIndex >= 0 ? 'Update' : 'Add'} Level
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default BayesianOptimization;