import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

export default function Legal(){
  const { t } = useTranslation();
  return (
    <Box sx={{ my: 3 }}>
      {/* Back to Calculator button just under the header banner */}
      <Button
        variant="outlined"
        component={RouterLink}
        to="/"
        sx={{ mb: 2, textTransform: 'none' }}
      >
        ← Back to Calculator
      </Button>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>{t('legal.title','Terms & Privacy')}</Typography>

        <section>
          <Typography variant="h6" gutterBottom>{t('legal.intendedUse.title','Intended Use')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.intendedUse.body','Vancomyzer® is intended for use by licensed healthcare professionals for educational and informational purposes to support vancomycin dosing concepts. It is not a substitute for professional medical advice, diagnosis, or treatment.')}
          </Typography>
        </section>

        <section style={{ marginTop: 16 }}>
          <Typography variant="h6" gutterBottom>{t('legal.medicalDisclaimer.title','Medical Disclaimer')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.medicalDisclaimer.body','Clinical decisions must be based on independent clinical judgment and patient-specific factors. Always verify calculations and consult institutional policies and current ASHP/IDSA guidelines before applying recommendations in practice.')}
          </Typography>
        </section>

        <section style={{ marginTop: 16 }}>
          <Typography variant="h6" gutterBottom>{t('legal.liability.title','Limitations of Liability')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.liability.body','Vancomyzer® is provided "as-is" without warranties of any kind. The developers and contributors shall not be liable for any direct, indirect, incidental, or consequential damages resulting from use of the app or website.')}
          </Typography>
        </section>

        <section style={{ marginTop: 16 }}>
          <Typography variant="h6" gutterBottom>{t('legal.privacy.title','Privacy & Data Handling')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('legal.privacy.body','Vancomyzer® does not collect protected health information (PHI). Input data may be processed locally or via secured endpoints for computation. Do not enter personally identifiable information. See repository documentation for technical details.')}
          </Typography>
        </section>
      </Paper>
    </Box>
  );
}
