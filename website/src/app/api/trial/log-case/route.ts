import { NextResponse } from "next/server";

/** Disable case logging for existing pilot clients without reading their payload. */
export async function POST() {
  return NextResponse.json(
    { ok: false, message: "Saving calculation cases is disabled." },
    { status: 403, headers: { "Cache-Control": "private, no-store" } },
  );
}
