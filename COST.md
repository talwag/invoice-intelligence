# Cost Estimate

## Gemini 2.5 Flash

**Max ~$0.19/month** for 100 documents/month, standard (non-batch) API pricing.
Worst-case token assumptions (longer/multi-page invoices) — a real single-page
test invoice measured much lower, ~$0.08/month at this volume (331 input +
280 output tokens/document). Thinking is disabled
(`thinkingConfig.thinkingBudget: 0` in `web/lib/extractor.ts`), so thinking
tokens are never billed and aren't part of either figure.

**Worst-case breakdown:**
- Input: ~2,000 tokens/document × 100 documents = 200K tokens/month × $0.30/1M tokens = **$0.06/month**
- Output: ~500 tokens/document × 100 documents = 50K tokens/month × $2.50/1M tokens = **$0.125/month**

## Cloudflare Workers

Free (within the free-tier request/CPU limits)

## Supabase

Free (within the free-tier database/storage limits)

## Total

**Max ~$0.19/month**
