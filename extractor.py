import httpx
from google import genai
from google.genai import types
from google.genai import errors as genai_errors
import json
import logging
import os
from dotenv import load_dotenv
from pydantic import ValidationError
from schemas import InvoiceExtraction

load_dotenv()

logger = logging.getLogger(__name__)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
# creates the Gemini client — like new Anthropic(api_key=...) in lesson 2.2

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
PDF_MAGIC_BYTES = b"%PDF-"


class ExtractionError(Exception):
    # sanitized, user-facing error — callers (e.g. the API route) can
    # show str(e) to clients without leaking internal details
    pass


def extract_invoice(file_bytes: bytes, mime_type: str) -> dict:
    # file_bytes — raw binary content of the PDF file
    # mime_type — "application/pdf"
    # returns a plain dict with the extracted invoice data

    if mime_type != "application/pdf":
        raise ExtractionError("Only application/pdf is supported")

    if not file_bytes:
        raise ExtractionError("Empty file")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ExtractionError(
            f"File too large: max {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB"
        )

    if not file_bytes.startswith(PDF_MAGIC_BYTES):
        raise ExtractionError("File is not a valid PDF")

    schema_json = json.dumps(
        InvoiceExtraction.model_json_schema(),
        ensure_ascii=False
        # ensure_ascii=False — keeps Hebrew text readable (lesson 2.4)
    )

    prompt = f"""You are an invoice data extraction system.
    Extract all data from this invoice document.

    Return a JSON object matching this schema exactly:
    {schema_json}

    Rules:
    - All monetary values must be in ILS (convert if needed)
    - vat_rate should be 0.17 for Israeli 17% VAT
    - If a field is missing from the invoice, use null
    - confidence: your certainty that all extracted data is correct (0.0 to 1.0)
    - Return ONLY valid JSON, no explanation text"""

    file_part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
    # wraps the file bytes correctly for the new google-genai SDK

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[file_part, prompt],
            # sends BOTH the file and the prompt together
            config={"response_mime_type": "application/json"}
            # forces JSON output — no extra text around it
        )
    except (genai_errors.APIError, httpx.HTTPError) as e:
        logger.exception("Gemini API call failed")
        raise ExtractionError("Extraction service is unavailable") from e

    response_text = response.text
    if not response_text:
        logger.error("Gemini returned an empty response")
        raise ExtractionError("Extraction produced no data")

    try:
        raw_data = json.loads(response_text)
        # json.loads() — parses JSON string → dict, like JSON.parse() in JS
    except json.JSONDecodeError as e:
        logger.exception("Gemini response was not valid JSON: %r", response_text)
        raise ExtractionError("Extraction returned malformed data") from e

    try:
        validated = InvoiceExtraction(**raw_data)
        # creates Pydantic instance and validates all fields
        # ** unpacks dict as arguments: func(**{"a": 1}) = func(a=1)
        # throws an error if any field is missing or wrong type
    except ValidationError as e:
        logger.exception("Gemini response failed schema validation: %r", raw_data)
        raise ExtractionError("Extraction result did not match expected format") from e

    return validated.model_dump(mode="json")
    # converts Pydantic instance back to plain dict
    # mode="json" — converts date objects to strings like "2026-06-01"
