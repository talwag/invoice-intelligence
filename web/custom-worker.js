import handler from "./.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

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
