/**
 * BAA document storage layer — writes/reads signed PDFs on the Render
 * persistent disk at /data/baa/ (falls back to ./data/baa/ for dev).
 *
 * Path convention:
 *   /data/baa/{institutionId}/{role}-{timestampMs}.pdf
 *     role ∈ { 'customer-signed', 'fully-executed' }
 *
 * Why a per-institution subdirectory: keeps blast radius small if a
 * single tenant's files are corrupted/leaked, and makes the eventual
 * S3 mirror trivial (one prefix per tenant).
 *
 * Why timestamps in filenames: BAAs can be re-signed (e.g. when the
 * template version changes). We keep every version; the
 * `baa_document_path` column on institutional_accounts always points
 * at the *current* one, but the old ones remain on disk for audit.
 *
 * No PHI is stored here — only contract documents and signer
 * identifiers (name, title, email of the signing officer). HIPAA does
 * not regulate this content, but we still treat the directory as
 * sensitive (no public route serves it; only signed-in admins via
 * authenticated endpoints).
 */

import fs from "fs";
import path from "path";

const BAA_DIR = (() => {
  const base = fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "data");
  return path.join(base, "baa");
})();

function ensureInstitutionDir(institutionId: number): string {
  const dir = path.join(BAA_DIR, String(institutionId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export type BaaDocumentRole = "customer-signed" | "fully-executed";

/**
 * Persist a BAA document. Returns the absolute path (the value to
 * store in `institutional_accounts.baa_document_path`).
 */
export function saveBaaDocument(
  institutionId: number,
  role: BaaDocumentRole,
  bytes: Buffer,
): string {
  if (institutionId <= 0) throw new Error("Invalid institutionId");
  if (bytes.length === 0) throw new Error("Empty PDF");
  if (bytes.length > 25 * 1024 * 1024) throw new Error("PDF exceeds 25 MB upload cap");
  // Minimal PDF magic-byte sniff — rejects obvious non-PDF uploads.
  // Real validation happens at the e-signature/legal layer.
  if (bytes.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error("Uploaded file is not a PDF (missing %PDF magic bytes)");
  }
  const dir = ensureInstitutionDir(institutionId);
  const filename = `${role}-${Date.now()}.pdf`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, bytes);
  return fullPath;
}

/**
 * Read a previously-saved BAA document. The storedPath must point
 * inside BAA_DIR — defensive guard against path traversal.
 */
export function readBaaDocument(storedPath: string): Buffer {
  const resolved = path.resolve(storedPath);
  const baseResolved = path.resolve(BAA_DIR);
  if (!resolved.startsWith(baseResolved + path.sep)) {
    throw new Error("BAA document path is outside the BAA directory");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`BAA document not found at ${resolved}`);
  }
  return fs.readFileSync(resolved);
}

/**
 * Convert a Buffer or Uint8Array into a fresh ArrayBuffer suitable
 * for passing to the Web Blob constructor.
 *
 * Why: Node's Buffer and pdf-lib's Uint8Array are typed as backed by
 * `ArrayBufferLike` (which includes SharedArrayBuffer), and TS won't
 * narrow that to `ArrayBuffer` even after a fresh copy. Returning a
 * raw `ArrayBuffer` sidesteps the assignability issue entirely —
 * `ArrayBuffer` is a valid BlobPart.
 */
export function toBlobPart(bytes: Uint8Array | Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}

/** True if a BAA document exists at the given path. Defensive — used by status endpoints. */
export function baaDocumentExists(storedPath: string | null | undefined): boolean {
  if (!storedPath) return false;
  try {
    const resolved = path.resolve(storedPath);
    const baseResolved = path.resolve(BAA_DIR);
    return resolved.startsWith(baseResolved + path.sep) && fs.existsSync(resolved);
  } catch {
    return false;
  }
}
