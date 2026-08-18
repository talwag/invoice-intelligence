import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function hmac(message: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(message).digest();
}

function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length || expected.length === 0) return false;
  return timingSafeEqual(expected, actual);
}

export function getCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

export function verifyPassword(submitted: string, secret: string): boolean {
  const submittedHash = hmac(submitted, secret);
  const actualHash = hmac(secret, secret);
  return timingSafeEqual(submittedHash, actualHash);
}

export function createSessionCookie(
  secret: string,
  now: number = Date.now(),
  maxAgeMs: number = SESSION_MAX_AGE_MS
): string {
  const expiry = now + maxAgeMs;
  const signature = hmac(String(expiry), secret).toString("hex");
  return `${expiry}.${signature}`;
}

export function verifySessionCookie(
  cookieValue: string | null | undefined,
  secret: string,
  now: number = Date.now()
): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;

  const [expiryStr, signature] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry)) return false;
  if (String(expiry) !== expiryStr) return false;
  if (expiry < now) return false;

  const expectedSignature = hmac(String(expiry), secret).toString("hex");
  return timingSafeEqualHex(expectedSignature, signature);
}

export function buildSessionCookieHeader(
  secret: string,
  now: number = Date.now()
): string {
  const value = createSessionCookie(secret, now);
  const maxAgeSeconds = Math.floor(SESSION_MAX_AGE_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function buildClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
