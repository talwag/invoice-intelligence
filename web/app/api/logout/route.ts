import { NextResponse } from "next/server";
import { buildClearSessionCookieHeader } from "@/lib/session";

export async function POST() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": buildClearSessionCookieHeader() } }
  );
}
