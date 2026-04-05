import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { setFirstLoginAcknowledged } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id;
  if (userId) {
    setFirstLoginAcknowledged(Number(userId));
  }

  return NextResponse.json({ ok: true });
}
