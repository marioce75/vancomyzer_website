import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "New Department subscriptions are no longer offered. Review the available plans at /pricing. Existing subscribers can still use Team billing." }, { status: 410 });
}
