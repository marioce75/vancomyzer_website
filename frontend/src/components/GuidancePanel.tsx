import React, { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Info as InfoIcon } from '@mui/icons-material';

interface GuidancePanelProps {
  patientAge?: number;
  patientWeight?: number;
  patientHeight?: number;
}

export default function GuidancePanel({ patientAge = 0, patientWeight = 0, patientHeight = 0 }: GuidancePanelProps) {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  // Calculate BMI and determine special considerations
  const bmi = patientHeight > 0 ? patientWeight / ((patientHeight / 100) ** 2) : 0;
  const isGeriatric = patientAge >= 65;
  const isObese = bmi >= 30;

  return (
    <Box sx={{ mb: 2 }}>
      <Accordion 
        expanded={expanded === 'guidance'} 
        onChange={handleChange('guidance')}
        sx={{ border: '1px solid', borderColor: 'primary.light' }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ bgcolor: 'primary.50' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon color="primary" />
            <Typography variant="h6">Clinical Guidance & Method Selection</Typography>
            {(isGeriatric || isObese) && (
              <Chip size="small" label="Special Considerations" color="warning" />
            )}
          </Box>
        </AccordionSummary>
        
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            
            {/* Method Selection */}
            <Alert severity="info">
              <Typography variant="subtitle2" gutterBottom>
                <strong>Choosing a Method:</strong>
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="• Start with Deterministic when no levels available (targets AUC₂₄ 400–600 mg·h/L)" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Switch to Bayesian after obtaining measured levels (≥1 post-distribution sample)" />
                </ListItem>
              </List>
            </Alert>

            {/* Patient-specific alerts */}
            {isGeriatric && (
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Geriatric Considerations (Age ≥65):</strong>
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="• Expect reduced renal function; verify SCr trends" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• Consider starting with q12-24h intervals" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• Monitor levels early (after 3-4 doses)" />
                  </ListItem>
                </List>
              </Alert>
            )}

            {isObese && (
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Obesity Considerations (BMI ≥30):</strong>
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="• Use AdjBW for CrCl: AdjBW = IBW + 0.4×(TBW–IBW)" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• Consider higher Vd (0.7–0.9 L/kg)" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• Loading dose: 20–25 mg/kg (TBW)" />
                  </ListItem>
                </List>
              </Alert>
            )}

            {/* Practical tips */}
            <Alert severity="success">
              <Typography variant="subtitle2" gutterBottom>
                <strong>Practical Tips:</strong>
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="• If AUC < 400: ↑dose or ↓interval" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• If AUC > 600: ↓dose or ↑interval" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Always cross-check institutional policies" />
                </ListItem>
              </List>
            </Alert>

            <Typography variant="body2" color="text.secondary">
              <strong>Evidence Base:</strong> Based on ASHP/IDSA 2020 Guidelines. Always consult local protocols.
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}