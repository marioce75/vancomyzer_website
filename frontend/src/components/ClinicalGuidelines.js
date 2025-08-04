import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Help,
  ExpandMore,
  LocalHospital,
  Timeline,
  Warning,
  Info,
  CheckCircle,
  BookOutlined
} from '@mui/icons-material';

const ClinicalGuidelines = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const targetParameters = [
    {
      parameter: 'Primary Target',
      value: 'AUC₀₋₂₄: 400-600 mg·h/L',
      description: 'For serious MRSA infections',
      indication: 'Standard care'
    },
    {
      parameter: 'Trough Monitoring',
      value: '10-20 mg/L',
      description: 'For monitoring purposes only, avoid >20 mg/L',
      indication: 'Safety monitoring'
    },
    {
      parameter: 'High-Risk Infections',
      value: 'AUC₀₋₂₄: 450-600 mg·h/L',
      description: 'Endocarditis, osteomyelitis, meningitis',
      indication: 'Serious infections'
    }
  ];

  const dosingRecommendations = [
    {
      population: 'Adults',
      dosing: '15-20 mg/kg IV q8-12h',
      notes: 'Based on actual body weight, not to exceed 2000 mg per dose',
      target: 'AUC 400-600 mg·h/L'
    },
    {
      population: 'Pediatrics',
      dosing: '15-20 mg/kg IV q6-8h',
      notes: 'Higher doses may be needed for CNS infections',
      target: 'AUC 400-600 mg·h/L'
    },
    {
      population: 'Neonates',
      dosing: '10-15 mg/kg IV q8-24h',
      notes: 'Interval based on gestational age and postnatal age',
      target: 'AUC 400-600 mg·h/L'
    }
  ];

  const monitoringGuidelines = [
    {
      parameter: 'Initial Levels',
      timing: 'Before 4th dose',
      rationale: 'Allow time for steady state'
    },
    {
      parameter: 'Trough Timing',
      timing: '30 minutes before dose',
      rationale: 'True pre-dose level'
    },
    {
      parameter: 'Renal Function',
      timing: 'Every 2-3 days',
      rationale: 'Monitor for nephrotoxicity'
    },
    {
      parameter: 'Hearing Assessment',
      timing: 'Baseline and weekly if >7 days',
      rationale: 'Monitor for ototoxicity'
    }
  ];

  const specialPopulations = [
    {
      population: 'Obesity',
      considerations: 'Use actual body weight, consider dose capping at 2000-2500 mg',
      modifications: 'May need extended infusion times'
    },
    {
      population: 'Renal Impairment',
      considerations: 'Extend dosing interval, monitor levels closely',
      modifications: 'Dose based on CrCl, frequent monitoring'
    },
    {
      population: 'Hemodialysis',
      considerations: 'Post-dialysis dosing, supplement based on levels',
      modifications: 'Typically 500-1000mg post-HD'
    },
    {
      population: 'CRRT',
      considerations: 'Continuous dosing may be needed, frequent monitoring',
      modifications: 'Usually requires higher doses'
    }
  ];

  const keyChanges = [
    {
      change: 'Primary Target',
      description: 'AUC₀₋₂₄ replaces trough as primary target'
    },
    {
      change: 'Trough Role',
      description: 'Trough used for monitoring, not targeting'
    },
    {
      change: 'Bayesian Methods',
      description: 'Recommended for AUC estimation'
    },
    {
      change: 'Safety Focus',
      description: 'Emphasis on avoiding excessive exposure'
    }
  ];

  return (
    <div className="fade-in">
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Help sx={{ mr: 1 }} />
        ASHP/IDSA 2020 Clinical Guidelines
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label="Overview" icon={<BookOutlined />} />
          <Tab label="Dosing" icon={<LocalHospital />} />
          <Tab label="Monitoring" icon={<Timeline />} />
          <Tab label="Special Populations" icon={<Warning />} />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      {activeTab === 0 && (
        <Box>
          {/* Header */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Reference:</strong> Rybak MJ, Le J, Lodise TP, et al. Therapeutic monitoring of vancomycin 
              for serious methicillin-resistant Staphylococcus aureus infections: A revised consensus guideline 
              and review. Am J Health Syst Pharm. 2020;77(11):835-864.
            </Typography>
          </Alert>

          {/* Target Parameters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Target Parameters
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Parameter</strong></TableCell>
                      <TableCell><strong>Target Value</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Indication</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {targetParameters.map((param, index) => (
                      <TableRow key={index}>
                        <TableCell>{param.parameter}</TableCell>
                        <TableCell>
                          <Chip label={param.value} color="primary" variant="outlined" />
                        </TableCell>
                        <TableCell>{param.description}</TableCell>
                        <TableCell>{param.indication}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Key Changes */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Key Changes from 2009 Guidelines
              </Typography>
              <List>
                {keyChanges.map((change, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <CheckCircle color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={change.change}
                      secondary={change.description}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Dosing Tab */}
      {activeTab === 1 && (
        <Box>
          {/* Initial Dosing */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Initial Dosing Recommendations
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Population</strong></TableCell>
                      <TableCell><strong>Dosing</strong></TableCell>
                      <TableCell><strong>Notes</strong></TableCell>
                      <TableCell><strong>Target</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dosingRecommendations.map((rec, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Chip 
                            label={rec.population} 
                            color={rec.population === 'Adults' ? 'primary' : rec.population === 'Pediatrics' ? 'secondary' : 'success'} 
                          />
                        </TableCell>
                        <TableCell><strong>{rec.dosing}</strong></TableCell>
                        <TableCell>{rec.notes}</TableCell>
                        <TableCell>{rec.target}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Dosing Principles */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Dosing Principles
              </Typography>
              
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">Weight-Based Dosing</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" paragraph>
                    • Use actual body weight for dosing calculations<br/>
                    • Consider dose capping at 2000-2500 mg for very obese patients<br/>
                    • For pediatrics, always use weight-based dosing
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">Loading Doses</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" paragraph>
                    • Consider loading dose (25-30 mg/kg) for:<br/>
                    &nbsp;&nbsp;- Severe infections (endocarditis, meningitis)<br/>
                    &nbsp;&nbsp;- Critically ill patients<br/>
                    &nbsp;&nbsp;- Obese patients<br/>
                    • Maximum loading dose: 3000 mg
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">Infusion Considerations</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" paragraph>
                    • Standard infusion: 1-2 hours<br/>
                    • Extended infusion (2-4 hours) for:<br/>
                    &nbsp;&nbsp;- High doses (&gt;2000 mg)<br/>
                    &nbsp;&nbsp;- Red man syndrome history<br/>
                    &nbsp;&nbsp;- Potential for improved pharmacodynamics
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Monitoring Tab */}
      {activeTab === 2 && (
        <Box>
          {/* Monitoring Schedule */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monitoring Guidelines
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Parameter</strong></TableCell>
                      <TableCell><strong>Timing</strong></TableCell>
                      <TableCell><strong>Rationale</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monitoringGuidelines.map((guide, index) => (
                      <TableRow key={index}>
                        <TableCell>{guide.parameter}</TableCell>
                        <TableCell>
                          <Chip label={guide.timing} color="secondary" variant="outlined" />
                        </TableCell>
                        <TableCell>{guide.rationale}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Detailed Monitoring */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Comprehensive Monitoring Protocol
              </Typography>

              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">
                    <LocalHospital sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Laboratory Monitoring
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                      <ListItemText
                        primary="Vancomycin Levels"
                        secondary="Trough before 4th dose, then weekly or with dose changes"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                      <ListItemText
                        primary="Serum Creatinine & BUN"
                        secondary="Every 2-3 days, daily if renal impairment"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                      <ListItemText
                        primary="Complete Blood Count"
                        secondary="Weekly for extended therapy"
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">
                    <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Toxicity Monitoring
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><Warning color="warning" /></ListItemIcon>
                      <ListItemText
                        primary="Nephrotoxicity"
                        secondary="Monitor SCr rise ≥0.5 mg/dL or ≥50% increase from baseline"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Warning color="warning" /></ListItemIcon>
                      <ListItemText
                        primary="Ototoxicity"
                        secondary="Baseline and weekly hearing assessment if therapy >7 days"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Warning color="warning" /></ListItemIcon>
                      <ListItemText
                        primary="Red Man Syndrome"
                        secondary="Monitor during infusion, slow rate if reactions occur"
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">
                    <Timeline sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Clinical Response
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><Info color="info" /></ListItemIcon>
                      <ListItemText
                        primary="Daily Clinical Assessment"
                        secondary="Temperature, WBC count, infection markers"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Info color="info" /></ListItemIcon>
                      <ListItemText
                        primary="Culture Results"
                        secondary="Monitor susceptibility, consider de-escalation"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><Info color="info" /></ListItemIcon>
                      <ListItemText
                        primary="Duration Assessment"
                        secondary="Evaluate need for continued therapy daily"
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Special Populations Tab */}
      {activeTab === 3 && (
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Special Population Considerations
              </Typography>
              
              {specialPopulations.map((pop, index) => (
                <Accordion key={index}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">
                      <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
                      {pop.population}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" paragraph>
                      <strong>Considerations:</strong> {pop.considerations}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Modifications:</strong> {pop.modifications}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>

          <Alert severity="warning" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Important:</strong> Special populations require individualized dosing approaches and more 
              frequent monitoring. Always consult with clinical pharmacists and follow institutional protocols.
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Footer Reference */}
      <Paper sx={{ mt: 4, p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Primary Reference:</strong> Rybak MJ, Le J, Lodise TP, et al. Therapeutic monitoring of vancomycin 
          for serious methicillin-resistant Staphylococcus aureus infections: A revised consensus guideline and review 
          by the American Society of Health-System Pharmacists, the Infectious Diseases Society of America, the 
          Pediatric Infectious Diseases Society, and the Society of Infectious Diseases Pharmacists. 
          Am J Health Syst Pharm. 2020;77(11):835-864.
        </Typography>
      </Paper>
    </div>
  );
};

export default ClinicalGuidelines;