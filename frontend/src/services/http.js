export async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `${res.status}`);
  try { return JSON.parse(text); } catch { return text; }
}
