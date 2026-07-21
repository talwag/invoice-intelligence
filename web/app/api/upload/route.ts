import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractInvoice, ExtractionError } from "@/lib/extractor";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large: max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` },
      { status: 400 }
    );
  }

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(storagePath, fileBytes, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to store file" },
      { status: 500 }
    );
  }

  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert({
      filename: file.name,
      r2_key: storagePath,
      status: "processing",
    })
    .select()
    .single();

  if (insertError || !document) {
    return NextResponse.json(
      { error: "Failed to create document record" },
      { status: 500 }
    );
  }

  try {
    const extractedData = await extractInvoice(fileBytes, file.type);

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        extracted_data: extractedData,
        confidence: extractedData.confidence,
        status: "done",
      })
      .eq("id", document.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save extracted data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      document_id: document.id,
      data: extractedData,
    });
  } catch (err) {
    await supabase
      .from("documents")
      .update({ status: "failed" })
      .eq("id", document.id);

    const message =
      err instanceof ExtractionError ? err.message : "Extraction failed";
    return NextResponse.json(
      { error: message, document_id: document.id },
      { status: 500 }
    );
  }
}
