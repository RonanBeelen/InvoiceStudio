"""
Settings API routes for company details and preferences
"""
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from .supabase_client import supabase
from .auth_middleware import get_current_user

router = APIRouter(prefix="/api/settings")


def get_default_settings():
    """Return default settings when none exist"""
    return {
        "company_name": "",
        "address": "",
        "postal_code": "",
        "city": "",
        "country": "Nederland",
        "kvk_number": "",
        "btw_number": "",
        "iban": "",
        "phone": "",
        "email": "",
        "logo_base64": None,
        "brand_color_primary": "#000000",
        "brand_color_secondary": "#008F7A",
        "brand_color_tertiary": "#4DDFB5",
        "brand_color_4": "#1AB291",
        "brand_color_5": "#003D33",
        "default_payment_terms_days": 30,
        "default_btw_percentage": 21.0,
        "invoice_number_format": "F-{YEAR}-{SEQ}",
        "invoice_number_next": 1,
        "invoice_number_prefix": "F",
        "quote_number_format": "O-{YEAR}-{SEQ}",
        "quote_number_next": 1,
        "quote_number_prefix": "O",
        "footer_text": "",
        "additional_bank_accounts": [],
        "email_from_name": "",
        "email_from_address": "",
        "email_reply_to": "",
        "email_invoice_subject": "Invoice {NUMBER} from {COMPANY}",
        "email_invoice_body": "Dear {CUSTOMER},\n\nPlease find attached invoice {NUMBER} for the amount of {TOTAL}.\n\nPayment is due by {DUE_DATE}.\n\nKind regards,\n{COMPANY}",
        "email_quote_subject": "Quote {NUMBER} from {COMPANY}",
        "email_quote_body": "Dear {CUSTOMER},\n\nPlease find attached our quote {NUMBER} for the amount of {TOTAL}.\n\nThis quote is valid for 30 days.\n\nKind regards,\n{COMPANY}",
    }


def format_document_number(fmt: str, next_num: int) -> str:
    """
    Format a document number from a format string.
    Supported placeholders:
        {YEAR} - Current 4-digit year
        {SEQ} - Sequence number (no padding)
        {SEQ:N} - Sequence number padded to N digits
    """
    year = str(datetime.utcnow().year)
    result = fmt.replace("{YEAR}", year)

    # Handle {SEQ:N} padded format
    import re
    seq_match = re.search(r'\{SEQ:(\d+)\}', result)
    if seq_match:
        pad = int(seq_match.group(1))
        result = result.replace(seq_match.group(0), str(next_num).zfill(pad))
    else:
        result = result.replace("{SEQ}", str(next_num))

    return result


@router.get("")
async def get_settings(user: dict = Depends(get_current_user)):
    """
    Get company settings for the current user. Returns defaults if none exist yet.
    """
    try:
        user_id = user["sub"]
        rows = await supabase.select("company_settings", filters={"user_id": user_id})
        if rows and len(rows) > 0:
            return rows[0]
        return get_default_settings()
    except Exception as e:
        print(f"[Settings] Error fetching settings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch settings: {str(e)}"
        )


@router.put("")
async def update_settings(settings_data: dict, user: dict = Depends(get_current_user)):
    """
    Create or update company settings for the current user (upsert pattern).
    """
    try:
        user_id = user["sub"]

        # Remove read-only fields
        settings_data.pop("id", None)
        settings_data.pop("created_at", None)
        settings_data.pop("updated_at", None)
        settings_data.pop("user_id", None)

        # Check if settings exist for this user
        rows = await supabase.select("company_settings", columns="id", filters={"user_id": user_id})

        if rows and len(rows) > 0:
            # Update existing
            result = await supabase.update(
                "company_settings",
                settings_data,
                {"id": rows[0]["id"], "user_id": user_id}
            )
        else:
            # Insert new with user_id
            settings_data["user_id"] = user_id
            result = await supabase.insert("company_settings", settings_data)

        return result
    except Exception as e:
        print(f"[Settings] Error updating settings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update settings: {str(e)}"
        )


@router.get("/next-number/{document_type}")
async def get_next_number(document_type: str, user: dict = Depends(get_current_user)):
    """
    Peek at the next document number without incrementing.
    """
    if document_type not in ("invoice", "quote"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_type must be 'invoice' or 'quote'"
        )

    try:
        user_id = user["sub"]
        rows = await supabase.select("company_settings", filters={"user_id": user_id})
        settings = rows[0] if rows else get_default_settings()

        if document_type == "invoice":
            fmt = settings.get("invoice_number_format", "F-{YEAR}-{SEQ}")
            next_num = settings.get("invoice_number_next", 1)
        else:
            fmt = settings.get("quote_number_format", "O-{YEAR}-{SEQ}")
            next_num = settings.get("quote_number_next", 1)

        formatted = format_document_number(fmt, next_num)

        return {
            "document_type": document_type,
            "next_number": next_num,
            "formatted": formatted,
            "format": fmt,
        }
    except Exception as e:
        print(f"[Settings] Error getting next number: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get next number: {str(e)}"
        )


@router.post("/increment-number/{document_type}")
async def increment_number(document_type: str, user: dict = Depends(get_current_user)):
    """
    Atomically increment and return the next document number.
    Called when a document is finalized.
    """
    if document_type not in ("invoice", "quote"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_type must be 'invoice' or 'quote'"
        )

    try:
        user_id = user["sub"]
        rows = await supabase.select("company_settings", filters={"user_id": user_id})

        if not rows:
            # Create default settings first
            default = get_default_settings()
            default["user_id"] = user_id
            await supabase.insert("company_settings", default)
            rows = await supabase.select("company_settings", filters={"user_id": user_id})

        settings = rows[0]

        if document_type == "invoice":
            fmt = settings.get("invoice_number_format", "F-{YEAR}-{SEQ}")
            current = settings.get("invoice_number_next", 1)
            formatted = format_document_number(fmt, current)
            await supabase.update(
                "company_settings",
                {"invoice_number_next": current + 1},
                {"id": settings["id"], "user_id": user_id}
            )
        else:
            fmt = settings.get("quote_number_format", "O-{YEAR}-{SEQ}")
            current = settings.get("quote_number_next", 1)
            formatted = format_document_number(fmt, current)
            await supabase.update(
                "company_settings",
                {"quote_number_next": current + 1},
                {"id": settings["id"], "user_id": user_id}
            )

        return {
            "document_type": document_type,
            "number": current,
            "formatted": formatted,
            "next_number": current + 1,
        }
    except Exception as e:
        print(f"[Settings] Error incrementing number: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to increment number: {str(e)}"
        )
