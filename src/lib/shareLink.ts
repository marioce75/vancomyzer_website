export type ShareStateV1 = {
  v: 1;
  // Keep this intentionally minimal. Do not include PHI. No names/MRN/DOB.
  inputs?: {
    age?: number;
    sex?: "male" | "female";
    heightCm?: number;
    weightKg?: number;
    scrMgDl?: number;
    icu?: boolean;
    infectionSeverity?: "standard" | "serious";
    mic?: number;
    aucTargetLow?: number;
    aucTargetHigh?: number;
  };
  // Optionally: share the *recommended* regimen only (still not PHI).
  result?: {
    loadingDoseMg?: number | null;
    maintenanceDoseMg?: number;
    intervalHr?: number;
    auc24?: number;
  };
};

function base64UrlEncodeUtf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeUtf8(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeShareState(state: ShareStateV1): string {
  const json = JSON.stringify(state);
  return base64UrlEncodeUtf8(json);
}

export function decodeShareState(encoded: string): ShareStateV1 | null {
  try {
    const json = base64UrlDecodeUtf8(encoded);
    const parsed = JSON.parse(json);
    if (!parsed || parsed.v !== 1) return null;
    return parsed as ShareStateV1;
  } catch {
    return null;
  }
}

export function buildShareUrl(encodedState: string): string {
  const url = new URL(window.location.href);
  url.hash = `#s=${encodedState}`;
  return url.toString();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "true");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
