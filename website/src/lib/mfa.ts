/**
 * TOTP-based MFA utilities for admin accounts (SOC 2 A1).
 */

import { generateSecret as otpGenerateSecret, verifySync } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Vancomyzer";

export function generateMfaSecret(username: string): { secret: string; otpauthUrl: string } {
  const secret = otpGenerateSecret();
  const otpauthUrl = `otpauth://totp/${ISSUER}:${encodeURIComponent(username)}?secret=${secret}&issuer=${ISSUER}`;
  return { secret, otpauthUrl };
}

export async function generateQrCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { width: 256, margin: 2 });
}

export function verifyMfaToken(secret: string, token: string): boolean {
  try {
    const result = verifySync({ secret, token });
    return typeof result === "boolean" ? result : !!(result as { valid?: boolean })?.valid;
  } catch {
    return false;
  }
}
