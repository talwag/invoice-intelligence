import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const SIGNED_URL_EXPIRY_SECONDS = 300;

// No X-API-Key check here, unlike GET /api/documents/[id]: this route is
// called from the dashboard's own client-side "View PDF" button, not
// external callers. It's still protected — web/custom-worker.js gates
// this exact path behind the session cookie before Next.js ever sees it.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: document, error: fetchError } = await supabase
    .from("documents")
    .select("r2_key")
    .eq("id", id)
    .single();

  if (fetchError || !document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("invoices")
    .createSignedUrl(document.r2_key, SIGNED_URL_EXPIRY_SECONDS);

  if (signError || !signed) {
    return NextResponse.json(
      { error: "Failed to generate PDF link" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: signed.signedUrl });
}
