from pydantic import BaseModel, Field
from datetime import date
from typing import Optional, List


class InvoiceItem(BaseModel):
    description: str = Field(description="Product or service name")
    quantity: float = Field(description="Number of units")
    unit_price: float = Field(description="Price per single unit in ILS, before VAT")
    line_total: float = Field(description="quantity * unit_price for this line item")


class InvoiceExtraction(BaseModel):
    vendor: str = Field(description="Company or person who issued the invoice")
    vendor_id: Optional[str] = Field(description="Israeli business ID (ח.פ. or ע.מ.), null if not found")
    invoice_number: Optional[str] = Field(description="Invoice number or reference ID")
    invoice_date: Optional[date] = Field(description="Date the invoice was issued")
    due_date: Optional[date] = Field(description="Payment due date, null if not specified")
    items: List[InvoiceItem] = Field(description="List of all line items in the invoice")
    subtotal: float = Field(description="Total before VAT in ILS")
    vat_rate: float = Field(description="VAT percentage as decimal: 0.17 for 17%")
    vat_amount: float = Field(description="VAT amount in ILS")
    total: float = Field(description="Final total including VAT in ILS")
    currency: str = Field(description="Currency code: ILS, USD, EUR")
    confidence: float = Field(description="0.0 to 1.0 — extraction confidence score")
