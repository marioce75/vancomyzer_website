import React, { useRef } from 'react';
import { Grid, Paper, Slider, TextField, InputAdornment } from '@mui/material';

export interface DoseInputProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number | null;
  marks?: number[]; // if provided, slider is discrete with these values
  onChange: (value: number) => void;
}

export default function DoseInput({ label, value, unit, min, max, step, marks, onChange }: DoseInputProps) {
  const raf = useRef<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const snapToMarks = (v: number) => {
    if (!marks || marks.length === 0) return v;
    let best = marks[0];
    let bestErr = Math.abs(v - best);
    for (const m of marks) {
      const err = Math.abs(v - m);
      if (err < bestErr) { best = m; bestErr = err; }
    }
    return best;
  };

  const schedule = (val: number) => {
    const raw = clamp(val);
    const v = snapToMarks(raw);
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => onChange(v), 180);
    });
  };

  const sliderMarks = marks?.map((m) => ({ value: m, label: String(m) }));
  const sliderStep = marks && marks.length ? null : step ?? 1;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={8} md={9}>
          <Slider
            value={value}
            min={min}
            max={max}
            step={sliderStep as any}
            marks={sliderMarks as any}
            onChange={(_, v) => schedule(Number(Array.isArray(v) ? v[0] : v))}
            aria-label={label}
          />
        </Grid>
        <Grid item xs="auto" md="auto">
          <TextField
            size="small"
            type="number"
            value={value}
            onChange={(e) => schedule(Number(e.target.value || 0))}
            InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment>, inputProps: { min, max, step: step ?? 1 } }}
            label={label}
          />
        </Grid>
      </Grid>
    </Paper>
  );
}
