import handler from "./.open-next/worker.js";
import { getCookieValue, verifySessionCookie, SESSION_COOKIE_NAME } from "./lib/session.ts";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const PROTECTED_API_PATTERN = /^\/api\/documents\/[^/]+\/(pdf-url|edit)$/;

function isProtectedPath(pathname) {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return (
    normalized === "/app" ||
    normalized === "/api/upload" ||
    PROTECTED_API_PATTERN.test(normalized)
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (isProtectedPath(url.pathname)) {
      const cookieHeader = request.headers.get("Cookie");
      const sessionValue = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
      const isLoggedIn = verifySessionCookie(sessionValue, env.APP_PASSWORD, Date.now());

      if (!isLoggedIn) {
        if (url.pathname.startsWith("/api/")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return Response.redirect(new URL("/login", request.url).toString(), 302);
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
