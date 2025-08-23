import React from 'react';
import { Paper, Box, Typography, ButtonGroup, Button, Chip } from '@mui/material';
import { calculateLoadingDose } from '../utils/loadingDose';

export default function LoadingDoseCard({ weightKg }: { weightKg: number }) {
  const [perKg, setPerKg] = React.useState<number>(25);
  const res = calculateLoadingDose(Number(weightKg || 0), perKg, 3000, 250);
  const numberFmt = new Intl.NumberFormat(undefined);

  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" color="text.secondary">Loading dose</Typography>
        <ButtonGroup size="small" variant="outlined">
          <Button onClick={() => setPerKg(20)} color={perKg === 20 ? 'primary' : 'inherit'} variant={perKg === 20 ? 'contained' : 'outlined'}>20 mg/kg</Button>
          <Button onClick={() => setPerKg(25)} color={perKg === 25 ? 'primary' : 'inherit'} variant={perKg === 25 ? 'contained' : 'outlined'}>25 mg/kg</Button>
        </ButtonGroup>
      </Box>
      <Box sx={{ mt: 1 }}>
        <Chip className="pill pill-strong" label={`${numberFmt.format(res.ld_mg)} mg`} color="primary" variant="filled" sx={{ fontSize: 16, px: 1.5, py: 0.5 }} />
      </Box>
      <Box sx={{ mt: 1 }}>
        {res.warning && (
          <Typography variant="caption" color="warning.main" className="note note-warning" display="block">
            Capped at {numberFmt.format(res.max_mg)} mg
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" className="note note-muted" display="block">
          Rounded to nearest 250 mg. Based on actual body weight.
        </Typography>
      </Box>
    </Paper>
  );
}
