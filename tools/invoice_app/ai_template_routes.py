"""
AI Template Generation routes - Claude Vision API
Analyzes uploaded PDFs/images and generates pdfme templates
"""
import os
import re
import json
import base64
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import Optional
from .auth_middleware import get_current_user
from .supabase_client import supabase as sb

router = APIRouter(prefix="/api/ai")

AI_GENERATION_LIMIT = 3  # Max generations per calendar month

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

TEMPLATE_ANALYSIS_PROMPT = """You are an expert at analyzing invoice/quote documents and converting them into pdfme v4.5.2 JSON templates.

Analyze the uploaded document image carefully. Identify all visual elements: text blocks, lines, rectangles, colors, font sizes, and their positions. Create a pdfme template that replicates the layout as closely as possible.

OUTPUT: Return ONLY a valid JSON object (no markdown, no explanation) with this structure:

{
  "template_json": {
    "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
    "schemas": [{ ...field definitions... }]
  },
  "variable_fields": ["field1", "field2"]
}

FIELD NAMING CONVENTION (use these exact Dutch names when applicable):
- bedrijfsnaam: Company name of the sender
- bedrijfsadres: Company address block (multi-line)
- klant_naam: Customer/recipient name
- klant_adres: Customer address block
- factuurnummer: Invoice number
- datum: Invoice/quote date
- vervaldatum: Due date
- factuur_titel: Title text (FACTUUR or OFFERTE)
- kolom_omschrijving, kolom_aantal, kolom_prijs, kolom_totaal: Column headers for line items
- regel1_omschrijving, regel1_aantal, regel1_prijs, regel1_totaal: Line item row 1
- regel2_omschrijving, regel2_aantal, regel2_prijs, regel2_totaal: Line item row 2 (continue pattern for more rows)
- subtotaal: Subtotal
- btw: Tax amount
- totaal: Grand total
- footer: Footer text
- betaalinfo: Payment information
- Labels (static text like "Factuurnummer:", "Datum:") should end in _label suffix

For decorative elements:
- lijn_header, lijn_footer, etc. for lines
- achtergrond_header, etc. for rectangles/backgrounds

FIELD DEFINITION FORMAT (each field in schemas[0]):
{
  "fieldName": {
    "type": "text",
    "content": "Default or placeholder text",
    "position": { "x": <mm from left>, "y": <mm from top> },
    "width": <mm>,
    "height": <mm>,
    "fontSize": <number>,
    "fontColor": "#hex",
    "alignment": "left|center|right",
    "fontWeight": "bold" (only if bold),
    "lineHeight": 1.4 (for multi-line text)
  }
}

For shapes/lines:
{
  "type": "line|rectangle",
  "position": { "x": <mm>, "y": <mm> },
  "width": <mm>,
  "height": <mm for rectangles, 0.5 for lines>,
  "color": "#hex"
}

RULES:
- Page is A4: 210mm x 297mm. padding MUST be [0,0,0,0]
- All positions in millimeters from top-left corner
- Estimate font sizes from the image (typical: 8-12 for body, 14-24 for headers, 28-40 for title)
- Match colors as closely as possible from the image
- Create 5 line item rows minimum
- variable_fields: list fields that change per document (NOT labels, NOT decorative elements)
- Include all visible text elements, lines, and colored backgrounds"""


async def _get_monthly_usage(user_id: str):
    """Get AI generation count for the current calendar month."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    logs = await sb.select_filtered(
        "ai_generation_logs",
        eq_filters={"user_id": user_id, "status": "success"},
        gte_filters={"created_at": month_start}
    )
    return len(logs)


async def _get_reset_date():
    """Get the first day of next month as the reset date."""
    now = datetime.now(timezone.utc)
    if now.month == 12:
        return now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)


@router.get("/rate-limit")
async def get_ai_rate_limit(user: dict = Depends(get_current_user)):
    """Check remaining AI generations for this month."""
    user_id = user["sub"]
    used = await _get_monthly_usage(user_id)
    reset_date = await _get_reset_date()

    return {
        "used": used,
        "limit": AI_GENERATION_LIMIT,
        "remaining": max(0, AI_GENERATION_LIMIT - used),
        "resets_at": reset_date.isoformat()
    }


@router.post("/generate-template")
async def generate_template_from_image(
    file: UploadFile = File(...),
    document_type: Optional[str] = Form("invoice"),
    user: dict = Depends(get_current_user),
):
    """
    Generate a pdfme template from an uploaded PDF or image.
    Uses Claude Vision API to analyze the document layout.
    """
    if not OPENROUTER_API_KEY and not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="No AI API key configured. Add OPENROUTER_API_KEY or ANTHROPIC_API_KEY to your .env file."
        )

    # Rate limit check: max AI_GENERATION_LIMIT per calendar month
    user_id = user["sub"]
    used_count = await _get_monthly_usage(user_id)
    if used_count >= AI_GENERATION_LIMIT:
        reset_date = await _get_reset_date()
        raise HTTPException(
            status_code=429,
            detail={
                "message": f"AI generation limit reached ({AI_GENERATION_LIMIT} per month)",
                "used": used_count,
                "limit": AI_GENERATION_LIMIT,
                "remaining": 0,
                "resets_at": reset_date.isoformat()
            }
        )

    try:
        # Read uploaded file
        file_bytes = await file.read()
        content_type = file.content_type or ""

        # Convert PDF to image if needed
        if "pdf" in content_type:
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                page = doc[0]
                pix = page.get_pixmap(dpi=200)
                image_bytes = pix.tobytes("png")
                media_type = "image/png"
                doc.close()
            except ImportError:
                raise HTTPException(
                    500,
                    "PyMuPDF not installed. Run: pip install PyMuPDF"
                )
        else:
            image_bytes = file_bytes
            # Normalize media type
            if "jpeg" in content_type or "jpg" in content_type:
                media_type = "image/jpeg"
            elif "png" in content_type:
                media_type = "image/png"
            elif "svg" in content_type:
                raise HTTPException(400, "SVG files are not supported for AI analysis. Please upload PNG, JPG, or PDF.")
            elif "webp" in content_type:
                media_type = "image/webp"
            else:
                media_type = "image/png"

        # Encode to base64
        image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

        print(f"[AI Template] Analyzing {content_type} ({len(file_bytes)} bytes) with Claude Vision...")

        import httpx
        use_openrouter = bool(OPENROUTER_API_KEY)

        if use_openrouter:
            # OpenRouter API (OpenAI-compatible format)
            api_url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "content-type": "application/json",
            }
            payload = {
                "model": "anthropic/claude-sonnet-4.5",
                "max_tokens": 8000,
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_b64}",
                            }
                        },
                        {
                            "type": "text",
                            "text": TEMPLATE_ANALYSIS_PROMPT,
                        }
                    ]
                }]
            }
            print("[AI Template] Using OpenRouter API")
        else:
            # Direct Anthropic API
            api_url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            payload = {
                "model": "claude-sonnet-4-5-20250929",
                "max_tokens": 8000,
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            }
                        },
                        {
                            "type": "text",
                            "text": TEMPLATE_ANALYSIS_PROMPT,
                        }
                    ]
                }]
            }
            print("[AI Template] Using Anthropic API")

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(api_url, headers=headers, json=payload)

            if response.status_code != 200:
                error_body = response.text
                print(f"[AI Template] API error: {response.status_code} - {error_body}")
                raise HTTPException(500, f"AI API error: {response.status_code}")

            result = response.json()

        # Extract text - different response format per provider
        if use_openrouter:
            response_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        else:
            response_text = result.get("content", [{}])[0].get("text", "")

        print(f"[AI Template] Got response ({len(response_text)} chars)")

        # Parse JSON from response (handle possible markdown wrapping)
        json_str = response_text.strip()
        if json_str.startswith("```"):
            # Remove markdown code blocks
            json_str = re.sub(r"^```(?:json)?\s*", "", json_str)
            json_str = re.sub(r"\s*```$", "", json_str)

        parsed = json.loads(json_str)
        template_json = parsed.get("template_json", parsed)
        variable_fields = parsed.get("variable_fields", [])

        # Validate basic structure
        if "schemas" not in template_json:
            raise HTTPException(500, "AI generated invalid template: missing 'schemas' field")

        if "basePdf" not in template_json:
            template_json["basePdf"] = {"width": 210, "height": 297, "padding": [0, 0, 0, 0]}

        # Ensure padding is zero (pdfme v4.5.2 bug workaround)
        template_json["basePdf"]["padding"] = [0, 0, 0, 0]

        print(f"[AI Template] Generated template with {len(template_json.get('schemas', [{}])[0])} fields")

        # Log successful generation for rate limiting
        try:
            await sb.insert("ai_generation_logs", {
                "user_id": user_id,
                "status": "success",
                "file_type": content_type,
                "file_size_bytes": len(file_bytes),
            })
        except Exception as log_err:
            print(f"[AI Template] Warning: Failed to log generation: {log_err}")

        return {
            "template_json": template_json,
            "suggested_variable_fields": variable_fields,
        }

    except json.JSONDecodeError as e:
        print(f"[AI Template] JSON parse error: {e}")
        raise HTTPException(500, f"Failed to parse AI response as JSON: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AI Template] Error: {str(e)}")
        raise HTTPException(500, f"AI template generation failed: {str(e)}")
