import React, { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Science as ScienceIcon,
  Timeline as TimelineIcon,
  Elderly as ElderlyIcon,
  Monitor as MonitorIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface GuidancePanelProps {
  patientAge?: number;
  patientWeight?: number;
  patientHeight?: number;
}

export default function GuidancePanel({ patientAge = 0, patientWeight = 0, patientHeight = 0 }: GuidancePanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  // Calculate BMI and determine if patient has special considerations
  const bmi = patientHeight > 0 ? patientWeight / ((patientHeight / 100) ** 2) : 0;
  const isGeriatric = patientAge >= 65;
  const isObese = bmi >= 30;
  const isUnderweight = bmi > 0 && bmi < 18.5;

  return (
    <Box sx={{ mb: 2 }}>
      <Accordion 
        expanded={expanded === 'guidance'} 
        onChange={handleChange('guidance')}
        sx={{ border: '1px solid', borderColor: 'primary.light' }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon color="primary" />
            <Typography variant="h6">How to Choose a Method & Clinical Guidance</Typography>
            {(isGeriatric || isObese || isUnderweight) && (
              <Chip 
                size="small" 
                label="Special Considerations" 
                color="warning" 
                variant="outlined" 
              />
            )}
          </Box>
        </AccordionSummary>
        
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Method Selection Guide */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScienceIcon color="primary" />
                Choosing a Calculation Method
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Timeline color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Start with Deterministic (Population PK)"
                    secondary="Use when no measured levels are available. Targets AUC₂₄ 400–600 mg·h/L at MIC=1 (adjust per institutional policy)."
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <ScienceIcon color="info" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Switch to Bayesian after measuring levels"
                    secondary="Use after at least one level (preferably post-distribution sample ≥1h after infusion end). Bayesian fits patient-specific CL/V and refines AUC predictions."
                  />
                </ListItem>
              </List>
            </Box>

            <Divider />

            {/* Patient-Specific Considerations */}
            {isGeriatric && (
              <Alert severity="warning" variant="outlined">
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ElderlyIcon />
                  Geriatric Considerations (Age ≥65 years)
                </Typography>
                <List dense sx={{ pl: 2 }}>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Expect reduced renal function; verify SCr trends rather than rounding" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Consider starting intervals at q12–24h depending on CrCl and clinical severity" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Monitor levels early (after 3–4 doses) and switch to Bayesian ASAP" />
                  </ListItem>
                </List>
              </Alert>
            )}

            {(isObese || isUnderweight) && (
              <Alert severity="info" variant="outlined">
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon />
                  Weight Considerations {bmi > 0 && `(BMI: ${bmi.toFixed(1)})`}
                </Typography>
                
                {isObese && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Obesity (BMI ≥ 30):</strong>
                    </Typography>
                    <List dense sx={{ pl: 2 }}>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemText primary="• Use AdjBW for CrCl: AdjBW = IBW + 0.4×(TBW–IBW)" />
                      </ListItem>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemText primary="• Vd often higher (consider vdPerKg 0.7–0.9 L/kg)" />
                      </ListItem>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemText primary="• Consider loading dose 20–25 mg/kg (TBW), rounded to 250 mg" />
                      </ListItem>
                    </List>
                  </Box>
                )}

                {isUnderweight && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      <strong>Underweight/Cachectic:</strong>
                    </Typography>
                    <List dense sx={{ pl: 2 }}>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemText primary="• Use IBW or TBW if TBW < IBW" />
                      </ListItem>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemText primary="• Consider lower vdPerKg (0.6–0.7 L/kg)" />
                      </ListItem>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemText primary="• Requires close monitoring due to increased variability" />
                      </ListItem>
                    </List>
                  </Box>
                )}
              </Alert>
            )}

            <Divider />

            {/* Practical Tips */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MonitorIcon color="primary" />
                Practical Dosing Tips
              </Typography>
              
              <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>AUC Adjustment:</strong>
                </Typography>
                <List dense sx={{ mt: 1 }}>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• If AUC < 400: ↑dose or ↓interval" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• If AUC > 600: ↓dose or ↑interval" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Always cross-check with institutional policies" />
                  </ListItem>
                </List>
              </Alert>

              <Alert severity="warning" variant="outlined">
                <Typography variant="body2">
                  <strong>Monitoring Schedule:</strong>
                </Typography>
                <List dense sx={{ mt: 1 }}>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Obtain levels before 4th dose (steady-state achieved)" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Trough: 30 minutes before next dose" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText primary="• Peak: 1-2 hours after infusion end (if q8h dosing)" />
                  </ListItem>
                </List>
              </Alert>
            </Box>

            <Divider />

            {/* Clinical References */}
            <Box>
              <Typography variant="body2" color="text.secondary">
                <strong>Evidence Base:</strong> Based on ASHP/IDSA/SIDP 2020 Vancomycin Therapeutic Guidelines and current pharmacokinetic literature. Always consult local protocols and infectious disease specialists for complex cases.
              </Typography>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}