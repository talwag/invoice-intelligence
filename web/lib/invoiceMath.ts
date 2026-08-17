export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface InvoiceItemWithTotal extends InvoiceItemInput {
  line_total: number;
}

export interface InvoiceTotals {
  items: InvoiceItemWithTotal[];
  subtotal: number;
  vat_amount: number;
  total: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateInvoiceTotals(items: InvoiceItemInput[], vatRate: number): InvoiceTotals {
  const itemsWithTotal = items.map((item) => ({
    ...item,
    line_total: round2(item.quantity * item.unit_price),
  }));
  const subtotal = round2(itemsWithTotal.reduce((sum, item) => sum + item.line_total, 0));
  const vat_amount = round2(subtotal * vatRate);
  const total = round2(subtotal + vat_amount);
  return { items: itemsWithTotal, subtotal, vat_amount, total };
}
