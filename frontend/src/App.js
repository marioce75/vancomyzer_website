// App.js
import React from 'react';
import { Container, Paper, Box, Typography, useMediaQuery } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import CssBaseline from '@mui/material/CssBaseline';
import { useTranslation } from 'react-i18next';
import { BayesianProvider } from './context/BayesianContext';
import { Routes, Route, Link as RouterLink } from 'react-router-dom';

import InteractiveAUC from './pages/InteractiveAUC';
import ClinicalInfo from './pages/ClinicalInfo';
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

function Header() {
  const { t } = useTranslation();
  return (
    <Box sx={{ textAlign: 'center', my: { xs: 2, sm: 3 } }}>
      <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
        {t('app.title')}
      </Typography>
      <Typography variant="h6" sx={{ opacity: 0.9 }}>
        {t('app.subtitle')}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
        {t('app.tagline')}
      </Typography>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Typography variant="body2" component={RouterLink} to="/" style={{ textDecoration: 'none' }}>Interactive AUC</Typography>
        <Typography variant="body2" component={RouterLink} to="/clinical" style={{ textDecoration: 'none' }}>Clinical Info</Typography>
      </Box>
    </Box>
  );
}

function AppInner() {
  return (
    <Container maxWidth="lg">
      <Header />
      <Paper elevation={2} sx={{ p: 2 }}>
        <Routes>
          <Route path="/" element={<InteractiveAUC />} />
          <Route path="/clinical" element={<ClinicalInfo />} />
          <Route path="*" element={<InteractiveAUC />} />
        </Routes>
      </Paper>
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
