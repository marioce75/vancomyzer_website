// Educational reference for core pharmacokinetic (PK) terms, therapeutic targets, renal considerations, and
// when/why certain strategies (e.g., loading dose, AUC monitoring) are applied in IV vancomycin therapy.

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import References from './References';

export default function ClinicalInfo() {
  return (
    <Box component="main" sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
        Vancomycin Vocabulary & Concepts
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Quick reference for core pharmacokinetic (PK) terms, therapeutic targets, renal considerations, and
        when/why certain strategies (e.g., loading dose, AUC monitoring) are applied in IV vancomycin therapy.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>1) Core PK Terms</Typography>
        <Divider sx={{ mb: 2 }} />
        <ul style={{ marginTop: 0, paddingLeft: '1.25rem' }}>
          <li><b>AUC24 (mg·h/L):</b> Area under the concentration–time curve over 24 h (total exposure).</li>
          <li><b>Trough (mg/L):</b> Concentration immediately prior to next dose at steady state.</li>
          <li><b>Peak (mg/L):</b> Concentration near end of infusion (less emphasized clinically vs AUC).</li>
          <li><b>Clearance (CL, L/h):</b> Volume of plasma cleared of drug per unit time; key driver of AUC.</li>
          <li><b>Volume of distribution (Vd, L):</b> Apparent volume into which drug distributes.</li>
          <li><b>Half-life (t½, h):</b> Time for concentration to decline by 50% (≈0.693/k).</li>
          <li><b>Elimination rate constant (k, 1/h):</b> First-order elimination constant (CL/Vd).</li>
        </ul>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>2) Targets</Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2" sx={{ mb: 1 }}>
          Typical pharmacodynamic goal for serious MRSA infections: <b>AUC24 400–600 mg·h/L</b> (2020 consensus guideline).
          Individual institutions may refine based on infection site, organism MIC, and patient factors.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>3) Renal Considerations</Typography>
        <Divider sx={{ mb: 2 }} />
        <ul style={{ marginTop: 0, paddingLeft: '1.25rem' }}>
          <li><b>Creatinine clearance estimation:</b> Cockcroft–Gault (CG), MDRD, CKD-EPI; CG often used for dosing.</li>
          <li><b>Unstable renal function:</b> Rising SCr or rapidly changing clinical status may require earlier level(s) and re-estimation.</li>
          <li><b>CRRT:</b> Can increase apparent clearance; closer monitoring and individualized adjustments needed.</li>
          <li><b>Intermittent hemodialysis:</b> Significant removal during sessions; specialized post-HD strategies apply.</li>
        </ul>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>4) Vancomycin IV vs PO</Typography>
        <Divider sx={{ mb: 2 }} />
        <ul style={{ marginTop: 0, paddingLeft: '1.25rem' }}>
          <li><b>IV vancomycin:</b> Systemic therapy achieving therapeutic serum concentrations; requires therapeutic drug monitoring to optimize AUC and minimize nephrotoxicity.</li>
          <li><b>PO (oral) vancomycin:</b> <b>Poorly absorbed</b>; used for <i>Clostridioides difficile</i> infection to deliver high intraluminal concentrations; <b>does not achieve systemic levels</b>.</li>
          <li><b>Therefore:</b> Oral vancomycin <b>does NOT require serum level monitoring</b>; IV therapy does.</li>
        </ul>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>5) When to Consider a Loading Dose</Typography>
        <Divider sx={{ mb: 2 }} />
        <ul style={{ marginTop: 0, paddingLeft: '1.25rem' }}>
          <li>Severe sepsis or septic shock.</li>
          <li>Endocarditis, meningitis, osteomyelitis, or other high-inoculum infections.</li>
          <li>Need for rapid attainment of target exposure (e.g., critical illness).</li>
        </ul>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>6) Monitoring</Typography>
        <Divider sx={{ mb: 2 }} />
        <ul style={{ marginTop: 0, paddingLeft: '1.25rem' }}>
          <li>AUC-guided monitoring preferred over trough-only where feasible.</li>
          <li>Frequency based on renal function stability, infection severity, and duration of therapy.</li>
          <li>Reassess after any significant change in renal function or hemodynamic status.</li>
        </ul>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>References</Typography>
        <Divider sx={{ mb: 2 }} />
        <References />
      </Paper>
    </Box>
  );
}
