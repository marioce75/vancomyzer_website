import { NextResponse } from "next/server";

export async function GET() {
  let dbStatus = "connected";
  try {
    const db = require("@/lib/db").default;
    db.prepare("SELECT 1").get();
  } catch {
    dbStatus = "error";
  }

  const version = "0.1.0";

  return NextResponse.json({
    status: dbStatus === "connected" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version,
    db: dbStatus,
    uptime_seconds: Math.floor(process.uptime()),
  }, {
    status: dbStatus === "connected" ? 200 : 503,
  });
}
