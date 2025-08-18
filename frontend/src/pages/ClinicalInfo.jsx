import React from 'react';
import { Box, Tabs, Tab, Paper, Typography, Alert } from '@mui/material';
import TutorialIntro from '../components/tutorial/TutorialIntro';
import TutorialAUC from '../components/tutorial/TutorialAUC';
import TutorialWorkflow from '../components/tutorial/TutorialWorkflow';
import GuidelinesIndex from '../components/guidelines/GuidelinesIndex';
import GuidelineArticle from '../components/guidelines/GuidelineArticle';
import { useTranslation } from 'react-i18next';

function usePersistedTab(key, initial) {
  const [value, setValue] = React.useState(() => {
    const raw = localStorage.getItem(key);
    return raw ? Number(raw) : initial;
  });
  React.useEffect(() => { localStorage.setItem(key, String(value)); }, [key, value]);
  return [value, setValue];
}

export default function ClinicalInfo() {
  const { t } = useTranslation();
  const [showNotice, setShowNotice] = React.useState(() => {
    try { return localStorage.getItem('clinical_disclaimer_dismissed') !== '1'; } catch { return true; }
  });
  const [tab, setTab] = usePersistedTab('clinical-tab', 0);
  const [activeSlug, setActiveSlug] = React.useState(null);

  return (
    <Box>
      {showNotice && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }} onClose={() => { try { localStorage.setItem('clinical_disclaimer_dismissed','1'); } catch {} setShowNotice(false); }}>
          {t('disclaimers.calculator', 'Disclaimer: This tool is provided for informational and educational purposes only. It does not replace independent clinical judgment. Always verify calculations and follow institutional protocols.')}
        </Alert>
      )}
      <Box sx={{ textAlign: 'center', my: { xs: 2, sm: 3 } }}>
        <Typography variant="h3" component="h2" sx={{ fontWeight: 800 }}>Clinical Info</Typography>
        <Typography variant="h6" sx={{ opacity: 0.9 }}>Tutorials and guidelines for AUC-guided vancomycin dosing</Typography>
      </Box>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Clinical Info tabs" variant="scrollable" allowScrollButtonsMobile>
          <Tab label="Tutorial" id="tab-tutorial" aria-controls="tabpanel-tutorial" />
          <Tab label="Guidelines" id="tab-guidelines" aria-controls="tabpanel-guidelines" />
        </Tabs>
        <Box role="tabpanel" id="tabpanel-tutorial" aria-labelledby="tab-tutorial" hidden={tab !== 0} sx={{ pt: 2 }}>
          {tab === 0 && (
            <Box>
              <TutorialIntro />
              <Box sx={{ mt: 3 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <TutorialAUC />
                </Paper>
              </Box>
              <Box sx={{ mt: 3 }}>
                <TutorialWorkflow />
              </Box>
            </Box>
          )}
        </Box>
        <Box role="tabpanel" id="tabpanel-guidelines" aria-labelledby="tab-guidelines" hidden={tab !== 1} sx={{ pt: 2 }}>
          {tab === 1 && (
            <Box>
              <GuidelinesIndex onSelect={(slug) => setActiveSlug(slug)} />
              <Box sx={{ mt: 2 }}>
                <GuidelineArticle slug={activeSlug} />
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
