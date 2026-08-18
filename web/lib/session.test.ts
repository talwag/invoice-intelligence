import { describe, it, expect } from "vitest";
import {
  SESSION_COOKIE_NAME,
  getCookieValue,
  verifyPassword,
  createSessionCookie,
  verifySessionCookie,
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
} from "./session";

describe("getCookieValue", () => {
  it("extracts the named cookie among several", () => {
    expect(getCookieValue("a=1; session=abc123; b=2", "session")).toBe("abc123");
  });

  it("returns null when the cookie is missing", () => {
    expect(getCookieValue("a=1; b=2", "session")).toBeNull();
  });

  it("returns null when the header itself is null", () => {
    expect(getCookieValue(null, "session")).toBeNull();
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", () => {
    expect(verifyPassword("correct-horse", "correct-horse")).toBe(true);
  });

  it("rejects an incorrect password", () => {
    expect(verifyPassword("wrong", "correct-horse")).toBe(false);
  });

  it("rejects an empty submitted password", () => {
    expect(verifyPassword("", "correct-horse")).toBe(false);
  });
});

describe("createSessionCookie / verifySessionCookie", () => {
  it("round-trips: a freshly created cookie verifies as valid", () => {
    const cookie = createSessionCookie("my-secret");
    expect(verifySessionCookie(cookie, "my-secret")).toBe(true);
  });

  it("rejects a cookie checked against the wrong secret", () => {
    const cookie = createSessionCookie("my-secret");
    expect(verifySessionCookie(cookie, "wrong-secret")).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const cookie = createSessionCookie("my-secret");
    const [expiry] = cookie.split(".");
    const tampered = `${expiry}.${"0".repeat(64)}`;
    expect(verifySessionCookie(tampered, "my-secret")).toBe(false);
  });

  it("rejects an expired cookie", () => {
    const alreadyExpired = createSessionCookie("my-secret", Date.now(), -1000);
    expect(verifySessionCookie(alreadyExpired, "my-secret")).toBe(false);
  });

  it("rejects a cookie with no separator", () => {
    expect(verifySessionCookie("not-a-valid-cookie", "my-secret")).toBe(false);
  });

  it("rejects a cookie with too many separators", () => {
    expect(verifySessionCookie("a.b.c", "my-secret")).toBe(false);
  });

  it("rejects a cookie with a non-numeric expiry", () => {
    expect(verifySessionCookie("not-a-number.abc123", "my-secret")).toBe(false);
  });

  it("rejects a missing cookie value", () => {
    expect(verifySessionCookie(null, "my-secret")).toBe(false);
    expect(verifySessionCookie(undefined, "my-secret")).toBe(false);
  });
});

describe("buildSessionCookieHeader", () => {
  it("produces a Set-Cookie header whose value verifies as valid", () => {
    const header = buildSessionCookieHeader("my-secret");
    const value = header.split(";")[0].split("=").slice(1).join("=");
    expect(verifySessionCookie(value, "my-secret")).toBe(true);
  });

  it("includes the security attributes", () => {
    const header = buildSessionCookieHeader("my-secret");
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
  });
});

describe("buildClearSessionCookieHeader", () => {
  it("clears the cookie via Max-Age=0", () => {
    const header = buildClearSessionCookieHeader();
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(header).toContain("Max-Age=0");
  });
});
