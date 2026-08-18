import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { validateInvoiceExtraction, ExtractionError } from "@/lib/extractor";
import { calculateInvoiceTotals, type InvoiceItemInput } from "@/lib/invoiceMath";

interface EditPayload {
  vendor: string;
  vendor_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  vat_rate: number;
  items: InvoiceItemInput[];
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

function isValidPayload(body: unknown): body is EditPayload {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.vendor === "string" &&
    b.vendor.trim() !== "" &&
    isNullableString(b.vendor_id) &&
    isNullableString(b.invoice_number) &&
    isNullableString(b.invoice_date) &&
    isNullableString(b.due_date) &&
    typeof b.vat_rate === "number" &&
    Array.isArray(b.items) &&
    b.items.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).description === "string" &&
        typeof (item as Record<string, unknown>).quantity === "number" &&
        typeof (item as Record<string, unknown>).unit_price === "number"
    )
  );
}

// No X-API-Key check here, same reasoning as GET .../pdf-url: called from
// the dashboard's own "Edit" form, not external callers. Still protected —
// see web/custom-worker.js.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Invalid edit payload" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("documents")
    .select("extracted_data")
    .eq("id", id)
    .single();

  if (fetchError || !existing?.extracted_data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Never trust client-sent totals: recompute line_total/subtotal/vat_amount/
  // total from the submitted description/quantity/unit_price/vat_rate only.
  const { items, subtotal, vat_amount, total } = calculateInvoiceTotals(
    body.items,
    body.vat_rate
  );

  const merged = {
    ...existing.extracted_data,
    vendor: body.vendor,
    vendor_id: body.vendor_id,
    invoice_number: body.invoice_number,
    invoice_date: body.invoice_date,
    due_date: body.due_date,
    vat_rate: body.vat_rate,
    items,
    subtotal,
    vat_amount,
    total,
  };

  let validated;
  try {
    validated = validateInvoiceExtraction(merged);
  } catch (err) {
    const message = err instanceof ExtractionError ? err.message : "Invalid data";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const editedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update({ extracted_data: validated, edited_at: editedAt })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to save changes" }, { status: 500 });
  }

  return NextResponse.json(updated);
}
