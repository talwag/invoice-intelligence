import { supabase } from "@/lib/supabase";
import DashboardClient from "./DashboardClient";
import type { Document } from "@/lib/dashboardAggregations";

// This page reads Supabase directly on the server, so the dashboard never
// needs the REST API's X-API-Key — that stays private, for external callers
// hitting /api/documents directly (see CLAUDE.md).
export const dynamic = "force-dynamic";

export default async function Home() {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch documents:", error);
  }

  return (
    <DashboardClient
      initialDocuments={(data as Document[] | null) ?? []}
      loadError={
        error ? "Couldn't load documents — the database may be unreachable. Try refreshing in a moment." : null
      }
    />
  );
}
