import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { findUserById, getSessionToken } from '@/lib/db';
import { pediatricAdminAllowed } from './access';

export interface PediatricAdmin { id: number; sessionToken: string }

/**
 * Resolves the current request to a verified system administrator (signed JWT,
 * fresh DB role/status, current session token, expiry, inactivity, MFA), or
 * null. Every pediatric handler calls this before reading a body.
 */
export async function getPediatricAdmin(): Promise<PediatricAdmin | null> {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const token = await getToken({ req: new NextRequest('http://localhost', { headers: headers() }), secret });
    if (!token || typeof token.id !== 'string' || !/^[1-9]\d*$/.test(token.id)) return null;
    const id = Number(token.id);
    if (!Number.isSafeInteger(id)) return null;
    const sessionToken = getSessionToken(id);
    if (!pediatricAdminAllowed(token, findUserById(id), sessionToken)) return null;
    return { id, sessionToken: sessionToken as string };
  } catch { return null; }
}

export async function requirePediatricAdmin(): Promise<boolean> {
  return (await getPediatricAdmin()) !== null;
}
