import React from 'react';
import { Box, Grid, Paper, Typography, Slider, TextField, Chip, InputAdornment } from '@mui/material';

// Lightweight one-compartment PK visualization without API
function simulate({ dose_mg, tau_h, infusion_min }, hours = 48) {
  const V = 45; // L
  const CL = 3.8; // L/h
  const k = CL / V; // 1/h
  const tinf = infusion_min / 60; // h
  const dt = 0.1; const t = []; const c = [];
  for (let x = 0; x <= hours + 1e-9; x += dt) {
    t.push(Number(x.toFixed(2)));
    // sum contribution of each dose up to time x
    let cx = 0;
    for (let td = 0; td <= x + 1e-9; td += tau_h) {
      const rel = x - td;
      if (rel < 0) break;
      const R0 = dose_mg / tinf; // mg/h during infusion
      if (rel <= tinf) {
        cx += (R0 / CL) * (1 - Math.exp(-k * rel));
      } else {
        const c_end = (R0 / CL) * (1 - Math.exp(-k * tinf));
        cx += c_end * Math.exp(-k * (rel - tinf));
      }
    }
    c.push(cx / 1000); // mg/L, since V in L and dose in mg handled via R0/CL term
  }
  const auc24 = trapezoid(t.filter(x=>x<=24), c.slice(0, t.findIndex(x=>x>24)+1));
  const peak = Math.max(...c);
  const trough = c[t.findIndex(x=>x>=tau_h)];
  return { t, c, auc24, peak, trough };
}

function trapezoid(ts, ys){
  let area = 0; for (let i=1; i<ts.length; i++){ area += 0.5*(ys[i-1]+ys[i])*(ts[i]-ts[i-1]); } return area;
}

export default function TutorialAUC(){
  const [dose, setDose] = React.useState(1000);
  const [tau, setTau] = React.useState(12);
  const [inf, setInf] = React.useState(60);
  const sim = React.useMemo(()=> simulate({ dose_mg: dose, tau_h: tau, infusion_min: inf }), [dose, tau, inf]);

  const Control = ({ label, value, min, max, step, onChange, unit }) => (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
        <Grid item xs={8} md={9}>
          <Slider value={value} min={min} max={max} step={step} onChange={(_, v) => onChange(Number(v))} aria-label={label} />
        </Grid>
        <Grid item xs={4} md={3}>
          <TextField
            className="numericInputDense"
            size="small"
            fullWidth
            type="number"
            inputProps={{ min, max, step }}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            label={unit}
            InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
            sx={{ width: `${Math.max(4, String(max ?? 4000).length) + 3}ch`, '& input': { fontVariantNumeric: 'tabular-nums', textAlign: 'right' } }}
          />
        </Grid>
      </Grid>
    </Paper>
  );

  return (
    <Box id="tutorial-auc">
      <Typography variant="h6" sx={{ mb: 1 }}>PK/AUC Concepts</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}><Control label="Dose (mg)" value={dose} min={250} max={3000} step={50} onChange={setDose} unit="mg" /></Grid>
        <Grid item xs={12} md={4}><Control label="Interval (hours)" value={tau} min={6} max={48} step={1} onChange={setTau} unit="h" /></Grid>
        <Grid item xs={12} md={4}><Control label="Infusion (minutes)" value={inf} min={15} max={240} step={5} onChange={setInf} unit="min" /></Grid>
      </Grid>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <MiniChart t={sim.t} c={sim.c} tau={tau} />
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
          <Chip label={`AUC24 ≈ ${sim.auc24.toFixed(0)} mg·h/L`} color={sim.auc24>=400 && sim.auc24<=600 ? 'success':'warning'} />
          <Chip label={`Peak ≈ ${sim.peak.toFixed(1)} mg/L`} />
          <Chip label={`Trough ≈ ${sim.trough.toFixed(1)} mg/L`} />
        </Box>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">AUC24/MIC target 400–600 when MIC=1 (2020 ASHP/IDSA). One-level Bayesian uses a single post-distribution sample (1–2 h after infusion end). Two-level first-order PK uses a post-distribution peak + trough ≤1 h pre-dose.</Typography>
        </Box>
      </Paper>
    </Box>
  );
}

function MiniChart({ t, c, tau }){
  const ref = React.useRef(null);
  React.useEffect(()=>{
    const canvas = ref.current; if (!canvas) return;
    const dpi = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const W = canvas.clientWidth * dpi; const H = 240 * dpi; canvas.width = W; canvas.height = H;
    ctx.clearRect(0,0,W,H);
    const pad = 40 * dpi; const w = W - pad*2; const h = H - pad*2;
    // axes
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.moveTo(pad, H-pad); ctx.lineTo(pad, pad); ctx.stroke();
    // scale
    const maxX = 48; const maxY = Math.max(30, Math.max(...c)*1.2);
    const x2p = (x)=> pad + (x/maxX)*w; const y2p = (y)=> H - pad - (y/maxY)*h;
    // tau markers
    ctx.setLineDash([6,6]); ctx.strokeStyle = 'rgba(25,118,210,0.6)';
    for(let x=0; x<=maxX+1e-6; x+=tau){ const X = x2p(x); ctx.beginPath(); ctx.moveTo(X, pad); ctx.lineTo(X, H-pad); ctx.stroke(); }
    ctx.setLineDash([]);
    // curve
    ctx.strokeStyle = '#1976d2'; ctx.lineWidth = 2; ctx.beginPath();
    t.forEach((x,i)=>{ const X = x2p(x); const Y = y2p(c[i]); if(i===0) ctx.moveTo(X,Y); else ctx.lineTo(X,Y); });
    ctx.stroke();
  }, [t,c,tau]);
  return <canvas ref={ref} style={{ width: '100%', height: 240 }} aria-label="Educational concentration-time curve" role="img" />
}
