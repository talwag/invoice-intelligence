"use client";

import { useState } from "react";
import { formatILS, type Document } from "@/lib/dashboardAggregations";
import { calculateInvoiceTotals, type InvoiceItemInput } from "@/lib/invoiceMath";

interface EditableFields {
  vendor: string;
  vendor_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  vat_rate: string;
  items: InvoiceItemInput[];
}

export default function DocumentPanel({
  document,
  onClose,
  onDocumentUpdated,
}: {
  document: Document;
  onClose: () => void;
  onDocumentUpdated: (updated: Document) => void;
}) {
  const data = document.extracted_data;
  const [isEditing, setIsEditing] = useState(false);
  const [fields, setFields] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    if (!data) return;
    setFields({
      vendor: data.vendor,
      vendor_id: data.vendor_id ?? "",
      invoice_number: data.invoice_number ?? "",
      invoice_date: data.invoice_date ?? "",
      due_date: data.due_date ?? "",
      vat_rate: String(data.vat_rate * 100),
      items: data.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    });
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setFields(null);
    setError(null);
  }

  function updateItem(index: number, patch: Partial<InvoiceItemInput>) {
    setFields((f) => f && { ...f, items: f.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function addItem() {
    setFields((f) => f && { ...f, items: [...f.items, { description: "", quantity: 1, unit_price: 0 }] });
  }

  function removeItem(index: number) {
    setFields((f) => f && { ...f, items: f.items.filter((_, i) => i !== index) });
  }

  async function handleSave() {
    if (!fields) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${document.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: fields.vendor,
          vendor_id: fields.vendor_id || null,
          invoice_number: fields.invoice_number || null,
          invoice_date: fields.invoice_date || null,
          due_date: fields.due_date || null,
          vat_rate: Number(fields.vat_rate) / 100 || 0,
          items: fields.items,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error ?? "שמירת השינויים נכשלה");
      }
      onDocumentUpdated(result);
      setIsEditing(false);
      setFields(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת השינויים נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function handleViewPdf() {
    setPdfLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${document.id}/pdf-url`);
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error ?? "טעינת הקובץ נכשלה");
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "טעינת הקובץ נכשלה");
    } finally {
      setPdfLoading(false);
    }
  }

  const livePreview = fields
    ? calculateInvoiceTotals(fields.items, Number(fields.vat_rate) / 100 || 0)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={isEditing ? undefined : onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {document.filename}
          </h2>
          <div className="flex shrink-0 items-center gap-3">
            {!isEditing && (
              <button
                onClick={handleViewPdf}
                disabled={pdfLoading}
                title="פתח את קובץ ה-PDF המקורי בכרטיסייה חדשה"
                className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700 disabled:cursor-default disabled:opacity-50 dark:text-blue-400"
              >
                {pdfLoading ? "טוען..." : "צפה ב-PDF"}
              </button>
            )}
            {!isEditing && data && (
              <button
                onClick={startEditing}
                title="ערוך את פרטי החשבונית"
                className="cursor-pointer text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                עריכה
              </button>
            )}
            <button onClick={onClose} title="סגור" className="cursor-pointer text-zinc-400 hover:text-zinc-600">
              ✕
            </button>
          </div>
        </div>

        {document.edited_at && !isEditing && (
          <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            נערך
          </span>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {!data ? (
          <p className="mt-6 text-sm text-zinc-500">
            {document.status === "processing" ? "המסמך עדיין בעיבוד..." : "לא נמצאו נתונים מחולצים"}
          </p>
        ) : isEditing && fields ? (
          <div className="mt-6 space-y-4 text-sm">
            <dl className="space-y-2">
              <EditableField label="ספק" value={fields.vendor} onChange={(v) => setFields({ ...fields, vendor: v })} />
              <EditableField
                label="מספר עוסק"
                value={fields.vendor_id}
                onChange={(v) => setFields({ ...fields, vendor_id: v })}
              />
              <EditableField
                label="מספר חשבונית"
                value={fields.invoice_number}
                onChange={(v) => setFields({ ...fields, invoice_number: v })}
              />
              <EditableField
                label="תאריך חשבונית"
                value={fields.invoice_date}
                onChange={(v) => setFields({ ...fields, invoice_date: v })}
              />
              <EditableField
                label="תאריך פירעון"
                value={fields.due_date}
                onChange={(v) => setFields({ ...fields, due_date: v })}
              />
            </dl>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-zinc-700 dark:text-zinc-300">פריטים</h3>
                <button
                  onClick={addItem}
                  title="הוסף שורת פריט"
                  className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  + הוסף פריט
                </button>
              </div>
              <div className="space-y-2">
                {fields.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      placeholder="תיאור"
                      title="תיאור הפריט"
                      className="min-w-0 flex-1 rounded border border-zinc-200 px-1.5 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 0 })}
                      title="כמות"
                      className="w-14 rounded border border-zinc-200 px-1.5 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                    />
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) || 0 })}
                      title="מחיר יחידה"
                      className="w-20 rounded border border-zinc-200 px-1.5 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                    />
                    <button
                      onClick={() => removeItem(i)}
                      title="מחק שורה"
                      className="cursor-pointer px-1 text-zinc-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <label className="text-zinc-500">שיעור מע&quot;מ (%)</label>
              <input
                type="number"
                value={fields.vat_rate}
                onChange={(e) => setFields({ ...fields, vat_rate: e.target.value })}
                title="שיעור מע&quot;מ באחוזים"
                className="w-20 rounded border border-zinc-200 px-1.5 py-1 text-end text-xs dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>

            {livePreview && (
              <dl className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <Field label="סכום ביניים" value={formatILS(livePreview.subtotal)} />
                <Field label={'מע"מ'} value={formatILS(livePreview.vat_amount)} />
                <Field label={'סה"כ לתשלום'} value={formatILS(livePreview.total)} bold />
              </dl>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={cancelEditing}
                disabled={saving}
                title="בטל את השינויים"
                className="cursor-pointer rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:cursor-default disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                title="שמור את השינויים"
                className="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-default disabled:opacity-50"
              >
                {saving ? "שומר..." : "שמירה"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4 text-sm">
            {data.confidence < 0.7 && (
              <div className="rounded-lg bg-yellow-50 px-4 py-3 text-yellow-800">
                ⚠ רמת ביטחון נמוכה בחילוץ (
                {(data.confidence * 100).toFixed(0)}%) — מומלצת בדיקה ידנית
              </div>
            )}

            <dl className="space-y-2">
              <Field label="ספק" value={data.vendor} />
              <Field label="מספר עוסק" value={data.vendor_id} />
              <Field label="מספר חשבונית" value={data.invoice_number} />
              <Field label="תאריך חשבונית" value={data.invoice_date} />
              <Field label="תאריך פירעון" value={data.due_date} />
            </dl>

            <div>
              <h3 className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">פריטים</h3>
              <table className="w-full text-xs">
                <thead className="text-start text-zinc-500">
                  <tr>
                    <th className="pb-1">תיאור</th>
                    <th className="pb-1 text-end">כמות</th>
                    <th className="pb-1 text-end">מחיר יחידה</th>
                    <th className="pb-1 text-end">סה&quot;כ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-1.5">{item.description}</td>
                      <td className="py-1.5 text-end">{item.quantity}</td>
                      <td className="py-1.5 text-end">{formatILS(item.unit_price)}</td>
                      <td className="py-1.5 text-end">{formatILS(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <Field label="סכום ביניים" value={formatILS(data.subtotal)} />
              <Field
                label={`מע"מ (${(data.vat_rate * 100).toFixed(0)}%)`}
                value={formatILS(data.vat_amount)}
              />
              <Field label={'סה"כ לתשלום'} value={formatILS(data.total)} bold />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="shrink-0 text-zinc-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={label}
        className="min-w-0 flex-1 rounded border border-zinc-200 px-2 py-1 text-end text-sm dark:border-zinc-800 dark:bg-zinc-900"
      />
    </div>
  );
}

function Field({
  label,
  value,
  bold,
}: {
  label: string;
  value: string | number | null | undefined;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`text-zinc-900 dark:text-zinc-100 ${bold ? "font-semibold" : ""}`}>
        {value ?? "—"}
      </dd>
    </div>
  );
}
