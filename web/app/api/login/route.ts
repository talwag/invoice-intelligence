import { NextResponse } from "next/server";
import { verifyPassword, buildSessionCookieHeader } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password =
    typeof body === "object" && body !== null && typeof (body as Record<string, unknown>).password === "string"
      ? (body as Record<string, string>).password
      : "";

  const secret = process.env.APP_PASSWORD;

  if (!secret || !verifyPassword(password, secret)) {
    return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": buildSessionCookieHeader(secret) } }
  );
}
