import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifyPassword, buildSessionCookieHeader } from "@/lib/session";

export async function POST(request: Request) {
  const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await getCloudflareContext().env.LOGIN_RATE_LIMITER.limit({
    key: clientIp,
  });
  if (!success) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות התחברות, נסה שוב בעוד דקה" },
      { status: 429 }
    );
  }

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
