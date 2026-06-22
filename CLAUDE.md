# Invoice Intelligence Service

## What This Does
Accepts invoice PDFs, extracts structured data using Google Gemini (gemini-2.5-flash),
stores results in Supabase, displays them in a Next.js dashboard.

## Tech Stack
- Frontend/API: Next.js 14 (App Router) + Tailwind CSS
- File Storage: Cloudflare R2
- Database: Supabase (PostgreSQL)
- AI Extraction: Python + google-genai + Pydantic (extractor.py, schemas.py)
- Deploy: Cloudflare Pages

## Project Structure
- /extractor.py — extract_invoice(file_bytes, mime_type) -> dict
- /schemas.py — InvoiceItem and InvoiceExtraction Pydantic models
- /app/api/upload/route.ts — POST endpoint: receives PDF, runs extractor, saves to Supabase
- /app/api/documents/route.ts — GET endpoint: list all documents (requires X-API-Key header)
- /app/api/documents/[id]/route.ts — GET endpoint: single document by ID
- /app/dashboard/page.tsx — main dashboard view

## API Authentication
All /api/documents routes require header: X-API-Key: {API_KEY from .env}

## Dashboard Requirements
1. Upload section at top: drag & drop or file picker (PDF only), shows spinner during processing
2. Documents table columns: vendor name, invoice date, total amount (formatted as ₪74.20), confidence badge
   - Confidence badge: green if >= 0.8, yellow if 0.6-0.79, red if < 0.6
3. Click any row: side panel showing all invoice fields with Hebrew labels + items table
4. Warning banner in side panel if confidence < 0.7

## Conventions
- All Vertex/Gemini calls go through extractor.py only
- All database access via Supabase JS client
- Monetary values formatted with ₪ symbol
- Hebrew text supported throughout (ensure_ascii=False)
- confidence < 0.7 triggers warning in UI
