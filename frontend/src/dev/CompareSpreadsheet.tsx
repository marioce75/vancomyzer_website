import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Box, Button, Typography, Alert } from '@mui/material';

// Quick column mapping (adjust as needed)
// Sheet columns expected: Age, Sex, TBW_kg, Height_cm, SCr_mg_dL, Dose_mg, Tau_h, Tinf_min, AUC24, Trough, Peak

type Props = {
  computeAll: (patient: any, regimen: { dose_mg: number; interval_hours: number; infusion_minutes: number }) => any;
};

export default function CompareSpreadsheet({ computeAll }: Props) {
  const [summary, setSummary] = useState<any>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    if (!rows.length) return;
    const r = rows[0] as any;

    const patient = {
      age_years: Number(r.Age),
      gender: String(r.Sex)?.toLowerCase() === 'm' ? 'male' : 'female',
      weight_kg: Number(r.TBW_kg),
      height_cm: Number(r.Height_cm),
      serum_creatinine: Number(r.SCr_mg_dL),
    };
    const regimen = {
      dose_mg: Number(r.Dose_mg),
      interval_hours: Number(r.Tau_h),
      infusion_minutes: Number(r.Tinf_min),
    };

    const ours = computeAll(patient, regimen);
    const out = {
      ours_auc24: Number(ours.summary.auc_24?.toFixed(1)),
      sheet_auc24: Number((r.AUC24 ?? 0).toFixed?.(1) ?? r.AUC24),
      ours_trough: Number(ours.summary.predicted_trough?.toFixed(2)),
      sheet_trough: Number((r.Trough ?? 0).toFixed?.(2) ?? r.Trough),
      ours_peak: Number(ours.summary.predicted_peak?.toFixed(2)),
      sheet_peak: Number((r.Peak ?? 0).toFixed?.(2) ?? r.Peak),
    };

    const pct = (a: number, b: number) => (b ? Math.abs(a - b) / b * 100 : 0);
    const diffs = {
      auc24_err_pct: pct(out.ours_auc24, out.sheet_auc24),
      trough_err_pct: pct(out.ours_trough, out.sheet_trough),
      peak_err_pct: pct(out.ours_peak, out.sheet_peak),
    };

    setSummary({ patient, regimen, out, diffs });
    const anyWarn = diffs.auc24_err_pct > 10 || diffs.trough_err_pct > 10 || diffs.peak_err_pct > 10;
    setWarning(anyWarn ? 'Discrepancies > 10% detected. See console for full details.' : null);
    if (anyWarn) {
      // eslint-disable-next-line no-console
      console.warn('[SpreadsheetCompare] diff', { patient, regimen, ours, sheet: r, diffs });
    }
  };

  return (
    <Box>
      <Button variant="outlined" component="label" size="small">
        Upload VancoDosingCalculator.xlsx
        <input type="file" hidden onChange={onFile} />
      </Button>
      {warning && <Alert severity="warning" sx={{ mt: 1 }}>{warning}</Alert>}
      {summary && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption">AUC24 ours/sheet: {summary.out.ours_auc24} / {summary.out.sheet_auc24} (err {summary.diffs.auc24_err_pct.toFixed(1)}%)</Typography><br />
          <Typography variant="caption">Trough ours/sheet: {summary.out.ours_trough} / {summary.out.sheet_trough} (err {summary.diffs.trough_err_pct.toFixed(1)}%)</Typography><br />
          <Typography variant="caption">Peak ours/sheet: {summary.out.ours_peak} / {summary.out.sheet_peak} (err {summary.diffs.peak_err_pct.toFixed(1)}%)</Typography>
        </Box>
      )}
    </Box>
  );
}
