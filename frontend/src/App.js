import React from 'react';
import { Container, Box, Typography, Chip } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';
import InteractiveAUC from './components/InteractiveAUC.jsx';

// Healthcare Blue Theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#0277bd',
      light: '#03a9f4',
      dark: '#01579b',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
    },
    error: {
      main: '#d32f2f',
      light: '#f44336',
      dark: '#c62828',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.125rem',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: '8px',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Header - keep existing beautiful design */}
        <Box sx={{ 
          bgcolor: 'primary.main', 
          color: 'white', 
          py: 4,
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
        }}>
          <Container maxWidth="lg">
            <Typography variant="h1" align="center" gutterBottom>
              Vancomyzer<sup style={{ fontSize: '0.6em' }}>®</sup>
            </Typography>
            <Typography variant="h5" align="center" sx={{ opacity: 0.9 }}>
              Evidence-Based Vancomycin Calculator Suite
            </Typography>
            <Typography variant="body1" align="center" sx={{ mt: 1, opacity: 0.8 }}>
              Following ASHP/IDSA 2020 Guidelines • AUC-Guided Dosing • Bayesian Optimization
            </Typography>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Chip 
                label="Educational decision-support; not a substitute for clinical judgment" 
                sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </Box>
          </Container>
        </Box>

        {/* Main Content - Enhanced InteractiveAUC Component */}
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <InteractiveAUC mode="adult" />
        </Container>

        {/* Footer - keep existing */}
        <Box sx={{ bgcolor: 'grey.100', py: 3, mt: 4 }}>
          <Container maxWidth="lg">
            <Typography variant="body2" align="center" color="text.secondary">
              © {new Date().getFullYear()} Vancomyzer. Educational tool for healthcare professionals.
              Always consult local protocols and clinical judgment.
            </Typography>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;