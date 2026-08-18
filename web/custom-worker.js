import handler from "./.open-next/worker.js";
import { getCookieValue, verifySessionCookie, SESSION_COOKIE_NAME } from "./lib/session.ts";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const PROTECTED_API_PATTERN = /^\/api\/documents\/[^/]+\/(pdf-url|edit)$/;

function isProtectedPath(pathname) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized === "/app" ||
    normalized === "/api/upload" ||
    PROTECTED_API_PATTERN.test(normalized)
  );
}

// Builds the "not logged in" response for a gated request: 401 JSON for API
// paths, a redirect to /login for page paths. Used both when the session
// cookie is missing/invalid and when APP_PASSWORD itself isn't configured
// (fail closed in both cases, identically).
function unauthorizedResponse(request, pathname) {
  if (pathname.startsWith("/api/")) {
    return new Response(
      JSON.stringify({ error: "פג תוקף החיבור, יש להתחבר מחדש" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL("/login", request.url).toString(),
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (isProtectedPath(url.pathname)) {
      if (!env.APP_PASSWORD) {
        return unauthorizedResponse(request, url.pathname);
      }

      const cookieHeader = request.headers.get("Cookie");
      const sessionValue = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
      const isLoggedIn = verifySessionCookie(sessionValue, env.APP_PASSWORD, Date.now());

      if (!isLoggedIn) {
        return unauthorizedResponse(request, url.pathname);
      }
    }

    return handler.fetch(request, env, ctx);
  },

  // Cloudflare Cron Trigger (see wrangler.jsonc's "triggers.crons"). Pings
  // Supabase daily so the free-tier project's REST API never sits idle long
  // enough (7 days) to hit Supabase's auto-pause. Runs outside the Next.js
  // request context, so it reads env vars directly rather than through
  // web/lib/supabase.ts (which expects process.env, populated only during
  // fetch requests).
  async scheduled(controller, env, ctx) {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/documents?select=id&limit=1`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    console.log(`Supabase keep-alive ping: HTTP ${res.status}`);
  },
};
