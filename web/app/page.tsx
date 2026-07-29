import { supabase } from "@/lib/supabase";
import DashboardClient, { type Document } from "./DashboardClient";

// This page reads Supabase directly on the server, so the dashboard never
// needs the REST API's X-API-Key — that stays private, for external callers
// hitting /api/documents directly (see CLAUDE.md).
export const dynamic = "force-dynamic";

export default async function Home() {
  const { data } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  return <DashboardClient initialDocuments={(data as Document[] | null) ?? []} />;
}
