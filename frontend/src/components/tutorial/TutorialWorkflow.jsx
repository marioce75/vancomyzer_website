import React from 'react';
import { Typography, Paper, Box, Stack } from '@mui/material';

export default function TutorialWorkflow(){
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Workflow: From Patient to AUC</Typography>
      <Stack spacing={3} aria-label="Tutorial workflow timeline">
        <Box>
          <Typography variant="subtitle1">Enter patient covariates</Typography>
          <Typography variant="body2">Age, sex, weight, height, and serum creatinine. The calculator estimates renal function to inform clearance.</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle1">Choose an initial regimen</Typography>
          <Typography variant="body2">Select dose (mg), interval (τ hours), and infusion time. Infuse ≥60 min for 1 g; consider 90–120 min for 1.5–2 g.</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle1">Sampling strategy</Typography>
          <Typography variant="body2">One level (Bayesian): obtain 1–2 h after infusion ends. Two levels (first-order PK): post-distribution peak + trough ≤1 h pre-dose.</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle1">Interpret outputs</Typography>
          <Typography variant="body2">Target AUC24/MIC 400–600 (MIC=1). Review predicted peak, trough, and uncertainty band. Adjust regimen as needed.</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
