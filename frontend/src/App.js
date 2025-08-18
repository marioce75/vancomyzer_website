// App.js
import React from 'react';
import { Container, Paper, Box, Typography } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';
import CssBaseline from '@mui/material/CssBaseline';
import { useTranslation } from 'react-i18next';
import { BayesianProvider } from './context/BayesianContext';

import InteractiveAUC from './pages/InteractiveAUC';
import './App.css';

function AppInner() {
  const { t } = useTranslation();
  return (
    <Container maxWidth="lg">
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
      </Box>
      <Paper elevation={2} sx={{ p: 2 }}>
        <InteractiveAUC />
      </Paper>
    </Container>
  );
}

function App(){
  const { i18n } = useTranslation();
  const direction = i18n.language === 'ar' ? 'rtl' : 'ltr';
  React.useEffect(()=>{ document.dir = direction; }, [direction]);
  const cache = React.useMemo(() => createCache({ key: direction === 'rtl' ? 'mui-rtl' : 'mui', stylisPlugins: direction === 'rtl' ? [prefixer, rtlPlugin] : [prefixer] }), [direction]);
  const theme = React.useMemo(()=>createTheme({ direction }), [direction]);
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
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
