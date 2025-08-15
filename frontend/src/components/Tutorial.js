import React, { useState } from 'react';
import { Box, Stepper, Step, StepLabel, Button, Typography, Grid, TextField, Paper, Chip, Card, CardContent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useBayesian } from '../context/BayesianContext';

const steps = ['tutorial.steps.overview','tutorial.steps.patientFields','tutorial.steps.clinicalOptions','tutorial.steps.dosingAuc','tutorial.steps.tryIt'];

const presets = [
  { label: 'Adult 70kg', patient: { population_type:'adult', age_years:45, gender:'male', weight_kg:70, height_cm:175, serum_creatinine:1.0, indication:'pneumonia', severity:'moderate' } },
  { label: 'Elderly 55kg', patient: { population_type:'adult', age_years:78, gender:'female', weight_kg:55, height_cm:160, serum_creatinine:1.3, indication:'bacteremia', severity:'severe' } },
  { label: 'Pediatric 25kg', patient: { population_type:'pediatric', age_years:8, gender:'female', weight_kg:25, height_cm:130, serum_creatinine:0.5, indication:'osteomyelitis', severity:'moderate' } }
];

export default function Tutorial({ onSubmit }) {
  const { t } = useTranslation();
  const { calculate } = useBayesian();
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState({ population_type:'adult', age_years:'', gender:'male', weight_kg:'', height_cm:'', serum_creatinine:'', indication:'pneumonia', severity:'moderate' });

  const handleChange = (field, value) => setForm(p=>({ ...p, [field]: value }));
  const applyPreset = (p) => setForm({ ...p });

  const handleSend = async () => {
    const patient = { ...form };
    if (onSubmit) {
      onSubmit(patient);
    } else {
      await calculate({ patient, levels: [] });
    }
  };

  return (
    <Box>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
        {steps.map(key => <Step key={key}><StepLabel>{t(key)}</StepLabel></Step>)}
      </Stepper>
      {activeStep === 0 && (
        <Paper sx={{ p:2 }}>
          <Typography variant="h6" gutterBottom>{t('tutorial.steps.overview')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('app.subtitle')}</Typography>
          <Box sx={{ mt:2 }}>
            <Typography variant="subtitle2" gutterBottom>{t('tutorial.presets.title')}</Typography>
            <Grid container spacing={1}>{presets.map(p => (
              <Grid item key={p.label}><Chip label={p.label} onClick={()=>applyPreset(p.patient)} /></Grid>
            ))}</Grid>
          </Box>
          <Box sx={{ mt:2 }}><Button variant="contained" onClick={()=>setActiveStep(1)}>Next</Button></Box>
        </Paper>
      )}
      {activeStep === 1 && (
        <Paper sx={{ p:2 }}>
          <Typography variant="h6" gutterBottom>{t('tutorial.steps.patientFields')}</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField label={t('fields.age')} value={form.age_years} onChange={e=>handleChange('age_years', e.target.value)} fullWidth /></Grid>
            <Grid item xs={6}><TextField label={t('fields.gender')} value={form.gender} onChange={e=>handleChange('gender', e.target.value)} fullWidth /></Grid>
            <Grid item xs={6}><TextField label={t('fields.weight_kg')} value={form.weight_kg} onChange={e=>handleChange('weight_kg', e.target.value)} fullWidth /></Grid>
            <Grid item xs={6}><TextField label={t('fields.height_cm')} value={form.height_cm} onChange={e=>handleChange('height_cm', e.target.value)} fullWidth helperText="IBW/AdjBW use height" /></Grid>
            <Grid item xs={12}><TextField label={t('fields.serum_creatinine_mg_dl')} value={form.serum_creatinine} onChange={e=>handleChange('serum_creatinine', e.target.value)} fullWidth /></Grid>
          </Grid>
          <Box sx={{ mt:2, display:'flex', gap:1 }}>
            <Button onClick={()=>setActiveStep(0)}>Back</Button>
            <Button variant="contained" onClick={()=>setActiveStep(2)}>Next</Button>
          </Box>
        </Paper>
      )}
      {activeStep === 2 && (
        <Paper sx={{ p:2 }}>
          <Typography variant="h6" gutterBottom>{t('tutorial.steps.clinicalOptions')}</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField label={t('fields.indication')} value={form.indication} onChange={e=>handleChange('indication', e.target.value)} fullWidth /></Grid>
            <Grid item xs={6}><TextField label={t('fields.severity')} value={form.severity} onChange={e=>handleChange('severity', e.target.value)} fullWidth /></Grid>
          </Grid>
          <Box sx={{ mt:2, display:'flex', gap:1 }}>
            <Button onClick={()=>setActiveStep(1)}>Back</Button>
            <Button variant="contained" onClick={()=>setActiveStep(3)}>Next</Button>
          </Box>
        </Paper>
      )}
      {activeStep === 3 && (
        <Paper sx={{ p:2 }}>
          <Typography variant="h6" gutterBottom>{t('tutorial.steps.dosingAuc')}</Typography>
          <Typography variant="body2" color="text.secondary">Simplified display – full calculation occurs in main calculator.</Typography>
          <Card sx={{ mt:2 }}><CardContent>
            <Typography variant="body2">{t('fields.weight_kg')}: {form.weight_kg}</Typography>
            <Typography variant="body2">{t('fields.serum_creatinine_mg_dl')}: {form.serum_creatinine}</Typography>
          </CardContent></Card>
          <Box sx={{ mt:2, display:'flex', gap:1 }}>
            <Button onClick={()=>setActiveStep(2)}>Back</Button>
            <Button variant="contained" onClick={()=>setActiveStep(4)}>Next</Button>
          </Box>
        </Paper>
      )}
      {activeStep === 4 && (
        <Paper sx={{ p:2 }}>
          <Typography variant="h6" gutterBottom>{t('tutorial.steps.tryIt')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb:2 }}>Submit the example to the main calculator.</Typography>
          <Button variant="contained" onClick={handleSend}>{t('tutorial.sendToCalculator')}</Button>
          <Button sx={{ ml:1 }} onClick={()=>setActiveStep(0)}>Restart</Button>
        </Paper>
      )}
    </Box>
  );
}
