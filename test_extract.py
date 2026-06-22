from extractor import extract_invoice
import json

with open("Tax_Invoice_Receipt_3606951.pdf", "rb") as f:
    file_bytes = f.read()
# opens the PDF and reads it as raw bytes — like fs.readFileSync() in Node.js

result = extract_invoice(file_bytes, mime_type="application/pdf")
# sends to Gemini and returns validated JSON

print(json.dumps(result, indent=2, ensure_ascii=False))
# prints the result in readable format
# ensure_ascii=False — keeps Hebrew readable
