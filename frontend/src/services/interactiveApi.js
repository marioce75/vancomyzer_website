import { normalizePatientFields } from './normalizePatient';

async function fetchJson(path, init = {}) {
  const res = await fetch(path, {
    method: init.method || 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: init.body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function calculateInteractive(patient, regimen) {
  const normalized = normalizePatientFields(patient);
  const body = {
    ...normalized,
    levels: normalized.levels || normalized.vancomycin_levels || [],
    regimen,
  };
  return fetchJson('/api/dose/interactive', { method: 'POST', body: JSON.stringify(body) });
}
