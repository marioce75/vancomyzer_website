// App.js
import React from 'react';
import { Container, Paper, Box, Typography, useMediaQuery, Tabs, Tab, Button } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import CssBaseline from '@mui/material/CssBaseline';
import { useTranslation } from 'react-i18next';
import { BayesianProvider } from './context/BayesianContext';
import { Routes, Route, useNavigate } from 'react-router-dom';

import LanguageSelector from './components/LanguageSelector';
import InteractiveAUC from './pages/InteractiveAUC';
import ClinicalInfo from './pages/ClinicalInfo';
import Legal from './pages/Legal';
import { Link as RouterLink } from 'react-router-dom';
import Link from '@mui/material/Link';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import './App.css';

// Brand theme palettes + rounded shapes (merged with RTL direction)
const BRAND_COLORS = {
  light: {
    palette: {
      mode: 'light',
      primary: { main: '#0E7490' },
      secondary: { main: '#4338CA' },
      error: { main: '#DC2626' },
      warning: { main: '#F59E0B' },
      success: { main: '#16A34A' },
      background: { default: '#FAFAFA', paper: '#FFFFFF' }
    },
    shape: { borderRadius: 10 }
  },
  dark: {
    palette: {
      mode: 'dark',
      primary: { main: '#22D3EE' },
      secondary: { main: '#A78BFA' },
      error: { main: '#F87171' },
      warning: { main: '#FBBF24' },
      success: { main: '#34D399' },
      background: { default: '#0B1220', paper: '#111827' }
    },
    shape: { borderRadius: 10 }
  }
};

const THEME_STORAGE_KEY = 'vancomyzer_theme_mode';
const getStoredMode = () => {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; }
};
const setStoredMode = (mode) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* ignore */ }
};

function HeroHeader(){
  const { t } = useTranslation();
  React.useEffect(() => { if (process.env.NODE_ENV !== 'production') console.debug('[Legal] disclaimers mounted'); }, []);
  return (
    <Box sx={(theme) => ({
      py: { xs: 5, md: 7 }, px: 2, textAlign: 'center',
      background: 'linear-gradient(180deg,#1976d2,#1565c0)', color: '#fff',
      borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
      borderTopLeftRadius: 18, borderTopRightRadius: 18,
      boxShadow: theme.palette.mode === 'dark' ? 1 : 2,
      mb: 2,
      overflow: 'visible'
    })}>
      <Typography
        component="h1"
        variant="h2"
        align="center"
        sx={{
          fontWeight: 800,
          letterSpacing: { xs: 0.2, md: 0.5 },
          lineHeight: 1.05,
          mb: 1,
          // tighter on large screens, readable on small
          fontSize: { xs: '2rem', sm: '2.6rem', md: '3.2rem', lg: '3.6rem' },
        }}
        aria-label="Vancomyzer"
      >
        Vancomyzer
        <Box component="sup"
          sx={{
            fontSize: '0.55em',
            lineHeight: 0,
            ml: 0.25,
            position: 'relative',
            top: '-0.6em',
            opacity: 0.9
          }}
          aria-hidden
        >
          ®
        </Box>
      </Typography>

      <Typography
        variant="subtitle1"
        align="center"
        sx={{
          fontWeight: 500,
          opacity: 0.95,
          mb: 0.5,
          fontSize: { xs: '0.95rem', md: '1.05rem' }
        }}
      >
        {t('slogan.primary','Interactive, evidence‑based vancomycin dosing')}
      </Typography>

      <Typography
        variant="body2"
        align="center"
        sx={{
          opacity: 0.9,
          fontSize: { xs: '0.85rem', md: '0.95rem' }
        }}
      >
        {t('slogan.secondary','AUC‑guided · Bayesian‑powered · Following ASHP/IDSA 2020 guidelines')}
      </Typography>

      <Typography
        variant="caption"
        align="center"
        sx={{ display: 'block', opacity: 0.85, mt: 0.75 }}
      >
        {t('legal.shortHero')}
      </Typography>
    </Box>
  );
}

function a11yProps(idBase, index){
  return { id: `${idBase}-tab-${index}`, 'aria-controls': `${idBase}-tabpanel-${index}` };
}

function TabPanel({ idBase, index, value, children }){
  return (
    <Box role="tabpanel" id={`${idBase}-tabpanel-${index}`} aria-labelledby={`${idBase}-tab-${index}`} hidden={value !== index} tabIndex={0} sx={{ pt: 2 }}>
      {value === index && children}
    </Box>
  );
}

function PopulationTabs({ initialPop = 0, initialSubByPop = {} }){
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [popIndex, setPopIndex] = React.useState(initialPop); // 0 adult, 1 peds, 2 neonate
  const [subIndex, setSubIndex] = React.useState(() => ({ 0: 0, 1: 0, 2: 0, ...initialSubByPop }));

  const onOpenGuidelines = () => {
    setSubIndex((s) => ({ ...s, [popIndex]: 1 }));
    // keep route compatibility
    navigate('/clinical', { replace: false });
  };

  const renderInteractive = (mode) => (
    <InteractiveAUC mode={mode} onOpenGuidelines={onOpenGuidelines} />
  );

  const renderClinical = (mode) => (
    <Box>
      {/* TODO: Replace with population-specific clinical content */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        {mode === 'adult' ? t('tabs.adult','Adult') : mode === 'peds' ? t('tabs.pediatric','Pediatric') : t('tabs.neonate','Neonate')}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {/* Placeholder bullets */}
        • {t('bullets.guidelines','Following ASHP/IDSA 2020 Guidelines')}<br/>
        • {t('bullets.realtimeAuc','Real-time AUC Visualization')}<br/>
        • {t('bullets.bayesian','Bayesian Optimization')}
      </Typography>
      <ClinicalInfo />
    </Box>
  );

  const currentSub = subIndex[popIndex] || 0;

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Tabs
        value={popIndex}
        onChange={(_, v) => setPopIndex(v)}
        aria-label="Population tabs"
        centered
        variant="scrollable"
        allowScrollButtonsMobile
        textColor="primary"
        indicatorColor="primary"
        TabIndicatorProps={{ sx: { backgroundColor: '#fff' } }}
      >
        <Tab label={t('tabs.adult','Adult')} {...a11yProps('pop',0)} />
        <Tab label={t('tabs.pediatric','Pediatric')} {...a11yProps('pop',1)} />
        <Tab label={t('tabs.neonate','Neonate')} {...a11yProps('pop',2)} />
      </Tabs>

      <TabPanel idBase="pop" index={0} value={popIndex}>
        <Tabs value={currentSub} onChange={(_, v) => setSubIndex((s)=>({ ...s, 0: v }))} aria-label="Adult sub tabs" variant="scrollable" allowScrollButtonsMobile>
          <Tab label={t('tabs.interactiveAuc', t('tabs.interactiveAUC','Interactive AUC'))} {...a11yProps('adult',0)} />
          <Tab label={t('tabs.clinicalInfo','Clinical Info')} {...a11yProps('adult',1)} />
        </Tabs>
        <TabPanel idBase="adult" index={0} value={currentSub}>{renderInteractive('adult')}</TabPanel>
        <TabPanel idBase="adult" index={1} value={currentSub}>{renderClinical('adult')}</TabPanel>
      </TabPanel>

      <TabPanel idBase="pop" index={1} value={popIndex}>
        <Tabs value={currentSub} onChange={(_, v) => setSubIndex((s)=>({ ...s, 1: v }))} aria-label="Pediatric sub tabs" variant="scrollable" allowScrollButtonsMobile>
          <Tab label={t('tabs.interactiveAuc', t('tabs.interactiveAUC','Interactive AUC'))} {...a11yProps('peds',0)} />
          <Tab label={t('tabs.clinicalInfo','Clinical Info')} {...a11yProps('peds',1)} />
        </Tabs>
        <TabPanel idBase="peds" index={0} value={currentSub}>{renderInteractive('peds')}</TabPanel>
        <TabPanel idBase="peds" index={1} value={currentSub}>{renderClinical('peds')}</TabPanel>
      </TabPanel>

      <TabPanel idBase="pop" index={2} value={popIndex}>
        <Tabs value={currentSub} onChange={(_, v) => setSubIndex((s)=>({ ...s, 2: v }))} aria-label="Neonate sub tabs" variant="scrollable" allowScrollButtonsMobile>
          <Tab label={t('tabs.interactiveAuc', t('tabs.interactiveAUC','Interactive AUC'))} {...a11yProps('neo',0)} />
          <Tab label={t('tabs.clinicalInfo','Clinical Info')} {...a11yProps('neo',1)} />
        </Tabs>
        <TabPanel idBase="neo" index={0} value={currentSub}>{renderInteractive('neonate')}</TabPanel>
        <TabPanel idBase="neo" index={1} value={currentSub}>{renderClinical('neonate')}</TabPanel>
      </TabPanel>
    </Paper>
  );
}

function AppInner() {
  const { t } = useTranslation();
  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <LanguageSelector />
        <Button
          variant="text"
          component={RouterLink}
          to="/"
          startIcon={<HomeRoundedIcon />}
          sx={{ textTransform: 'none' }}
          aria-label={t('nav.home','Home')}
        >
          {t('nav.home','Home')}
        </Button>
      </Box>
      <HeroHeader />
      <Routes>
        <Route path="/" element={<PopulationTabs />} />
        <Route path="/clinical" element={<PopulationTabs initialPop={0} initialSubByPop={{ 0: 1 }} />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="*" element={<PopulationTabs />} />
      </Routes>
      <Box component="footer" sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="caption" align="center" sx={{ display: 'block', opacity: 0.8 }}>
          © {new Date().getFullYear()} Vancomyzer®. {t('legal.footer')}
        </Typography>
        <Typography variant="caption" align="center" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
          <Link component={RouterLink} to="/legal" underline="hover" color="inherit">
            {t('legal.link','Terms & Privacy')}
          </Link>
        </Typography>
      </Box>
    </Container>
  );
}

function App(){
  const { i18n } = useTranslation();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = React.useState(() => getStoredMode() || (prefersDark ? 'dark' : 'light'));
  React.useEffect(() => { setStoredMode(mode); }, [mode]);

  const direction = i18n.language === 'ar' ? 'rtl' : 'ltr';
  React.useEffect(()=>{ document.dir = direction; }, [direction]);

  const cache = React.useMemo(() => createCache({ key: direction === 'rtl' ? 'mui-rtl' : 'mui', stylisPlugins: direction === 'rtl' ? [prefixer, rtlPlugin] : [prefixer] }), [direction]);
  const theme = React.useMemo(() => createTheme({ ...(BRAND_COLORS[mode] || BRAND_COLORS.light), direction }), [mode, direction]);

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* Theme toggle button (fixed) */}
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 1300 }}>
          <button
            onClick={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.35)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
            aria-label="Toggle color theme"
            title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
          >
            {mode === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
        <BayesianProvider>
          <Box sx={{ py: 3 }}>
            <AppInner />
          </Box>
        </BayesianProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

export default App;
