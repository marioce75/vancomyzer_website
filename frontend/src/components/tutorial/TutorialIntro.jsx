import React from 'react';
import { Box, Typography, Button, Paper, Grid } from '@mui/material';

export default function TutorialIntro() {
  const onStart = () => {
    const el = document.getElementById('tutorial-auc');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={8}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Interactive Tutorial</Typography>
          <Typography sx={{ mt: 1 }}>
            Learn how to use Vancomyzer to target AUC24/MIC 400–600 (assuming MIC=1) using either a Bayesian one-level approach or first-order pharmacokinetics with two levels.
          </Typography>
          <Typography sx={{ mt: 1 }}>
            You can adjust dose, interval (τ), and infusion time to see how the concentration–time curve and AUC24 respond. No network calls are required for this educational view.
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={onStart}>Start Tutorial</Button>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2">Concepts</Typography>
            <ul style={{ marginTop: 8 }}>
              <li>AUC24 is the area under the curve over 24 hours.</li>
              <li>Target AUC24/MIC is 400–600 when MIC=1.</li>
              <li>Infusion usually ≥60 min for 1 g; consider 90–120 min for larger doses.</li>
            </ul>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
