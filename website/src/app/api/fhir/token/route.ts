import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/fhir/token — Server-side token exchange for SMART on FHIR.
 *
 * Exchanges the authorization code for an access token.
 * This runs server-side to keep any client_secret secure.
 */
export async function POST(request: NextRequest) {
  let body: {
    code: string;
    tokenEndpoint: string;
    clientId: string;
    redirectUri: string;
    iss: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { code, tokenEndpoint, clientId, redirectUri } = body;

  if (!code || !tokenEndpoint || !clientId || !redirectUri) {
    return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
  }

  try {
    // Exchange authorization code for access token
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    });

    // Add client_secret if configured (some EHRs require it for confidential clients)
    const clientSecret = process.env.SMART_CLIENT_SECRET;
    if (clientSecret) {
      params.set("client_secret", clientSecret);
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text().catch(() => "");
      console.error(`[SMART] Token exchange failed: ${tokenRes.status} — ${errorBody}`);
      return NextResponse.json(
        { error: `Token exchange failed (${tokenRes.status}).` },
        { status: tokenRes.status },
      );
    }

    const tokenData = await tokenRes.json();

    // Log SMART context (no PHI — just patient ID and scopes)
    console.log(`[SMART] Token acquired — patient: ${tokenData.patient ?? "?"}, scope: ${tokenData.scope ?? "?"}`);

    // Return token data to client
    // The client stores this in sessionStorage (not localStorage — session-scoped)
    return NextResponse.json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type ?? "Bearer",
      expires_in: tokenData.expires_in,
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope,
      patient: tokenData.patient,
      encounter: tokenData.encounter,
      fhirUser: tokenData.fhirUser,
      user: tokenData.user,
    });

  } catch (err) {
    console.error("[SMART] Token exchange error:", err);
    return NextResponse.json(
      { error: "Failed to exchange token with authorization server." },
      { status: 502 },
    );
  }
}
