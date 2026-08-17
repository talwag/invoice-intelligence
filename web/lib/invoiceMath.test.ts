import { describe, it, expect } from "vitest";
import { calculateInvoiceTotals } from "./invoiceMath";

describe("calculateInvoiceTotals", () => {
  it("computes line_total per item as quantity * unit_price", () => {
    const result = calculateInvoiceTotals(
      [
        { description: "Widget", quantity: 2, unit_price: 10 },
        { description: "Gadget", quantity: 3, unit_price: 5 },
      ],
      0.17
    );
    expect(result.items[0].line_total).toBe(20);
    expect(result.items[1].line_total).toBe(15);
  });

  it("sums line totals into subtotal", () => {
    const result = calculateInvoiceTotals(
      [
        { description: "Widget", quantity: 2, unit_price: 10 },
        { description: "Gadget", quantity: 3, unit_price: 5 },
      ],
      0.17
    );
    expect(result.subtotal).toBe(35);
  });

  it("computes vat_amount as subtotal * vat_rate", () => {
    const result = calculateInvoiceTotals([{ description: "Widget", quantity: 1, unit_price: 100 }], 0.17);
    expect(result.vat_amount).toBe(17);
  });

  it("computes total as subtotal + vat_amount", () => {
    const result = calculateInvoiceTotals([{ description: "Widget", quantity: 1, unit_price: 100 }], 0.17);
    expect(result.total).toBe(117);
  });

  it("returns zeros for an empty items list", () => {
    const result = calculateInvoiceTotals([], 0.17);
    expect(result.items).toEqual([]);
    expect(result.subtotal).toBe(0);
    expect(result.vat_amount).toBe(0);
    expect(result.total).toBe(0);
  });

  it("rounds to 2 decimal places to avoid floating point artifacts", () => {
    const result = calculateInvoiceTotals([{ description: "Widget", quantity: 3, unit_price: 0.1 }], 0.17);
    expect(result.items[0].line_total).toBe(0.3);
    expect(result.subtotal).toBe(0.3);
  });

  it("handles a zero VAT rate", () => {
    const result = calculateInvoiceTotals([{ description: "Widget", quantity: 1, unit_price: 100 }], 0);
    expect(result.vat_amount).toBe(0);
    expect(result.total).toBe(100);
  });
});
