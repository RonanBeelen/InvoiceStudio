"""
Webhook Routes — Inbound email webhooks (Resend, etc.).
NO JWT auth — authenticated via webhook secret header.
"""
import os
import re
import hmac
import hashlib
from fastapi import APIRouter, HTTPException, Request, status
from .supabase_client import supabase
from .activity_routes import _log_activity

router = APIRouter()

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")


def _verify_webhook(request: Request, body: bytes):
    """Verify webhook signature if a secret is configured."""
    if not WEBHOOK_SECRET:
        return  # No secret configured — allow (dev mode)

    signature = request.headers.get("x-webhook-signature", "")
    if not signature:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing webhook signature")

    expected = hmac.new(
        WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid webhook signature")


def _detect_intent(body_text: str, subject: str = "") -> str | None:
    """
    Keyword-based intent detection in Dutch + English.
    Returns: 'payment_confirmation', 'accepted', 'rejected', 'question', or None.
    """
    if not body_text and not subject:
        return None

    text = f"{subject} {body_text}".lower()

    # Payment confirmation (Dutch + English)
    payment_keywords = [
        r"\bbetaald\b", r"\bovergemaakt\b", r"\boverschreven\b",
        r"\bbetaling\s+gedaan\b", r"\bbetaling\s+voldaan\b",
        r"\bpaid\b", r"\bpayment\s+made\b", r"\btransferred\b",
        r"\bpayment\s+sent\b", r"\bpayment\s+completed\b",
    ]
    for kw in payment_keywords:
        if re.search(kw, text):
            return "payment_confirmation"

    # Acceptance (Dutch + English)
    accept_keywords = [
        r"\bakkoord\b", r"\bgoedgekeurd\b", r"\bgoedkeuring\b",
        r"\bgeaccepteerd\b", r"\bga\s+akkoord\b", r"\bgroen\s+licht\b",
        r"\bapproved\b", r"\baccepted\b", r"\bagree\b", r"\bgo\s+ahead\b",
        r"\blooks\s+good\b", r"\bconfirm\b",
    ]
    for kw in accept_keywords:
        if re.search(kw, text):
            return "accepted"

    # Rejection (Dutch + English)
    reject_keywords = [
        r"\bafwijzen\b", r"\bafgewezen\b", r"\bgeweigerd\b",
        r"\bniet\s+akkoord\b", r"\bannuleren\b",
        r"\brejected?\b", r"\bdeclined?\b", r"\brefused?\b",
        r"\bcancel\b", r"\bnot\s+accepted\b",
    ]
    for kw in reject_keywords:
        if re.search(kw, text):
            return "rejected"

    # Question (Dutch + English)
    question_indicators = [
        r"\?",
        r"\bvraag\b", r"\bvragen\b", r"\bkunnen\s+we\b",
        r"\bquestion\b", r"\bcould\s+you\b", r"\bcan\s+you\b",
        r"\bclarif", r"\buitleg\b",
    ]
    for kw in question_indicators:
        if re.search(kw, text):
            return "question"

    return None


# Intent → document status mapping
INTENT_STATUS_MAP = {
    "payment_confirmation": "paid",
    "accepted": "accepted",
    "rejected": "rejected",
}


@router.post("/api/webhooks/email/resend")
async def resend_webhook(request: Request):
    """
    Handle inbound webhook events from Resend.
    Events: email.delivered, email.opened, email.bounced, email.replied, etc.
    """
    body = await request.body()
    _verify_webhook(request, body)

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid JSON payload")

    event_type_raw = payload.get("type", "")
    data = payload.get("data", {})

    # Map Resend event types to our internal types
    event_type_map = {
        "email.delivered": "delivered",
        "email.opened": "opened",
        "email.bounced": "bounce",
        "email.complained": "bounce",
        "email.delivery_delayed": "delivered",
    }

    # Check if this is an inbound reply (Resend inbound webhook)
    is_reply = event_type_raw in ("email.received", "inbound")

    event_type = "reply" if is_reply else event_type_map.get(event_type_raw)
    if not event_type:
        # Unknown event type — acknowledge but don't process
        return {"status": "ignored", "reason": f"Unknown event type: {event_type_raw}"}

    # Try to match to a document_send via provider_message_id
    provider_message_id = data.get("email_id") or data.get("message_id", "")
    in_reply_to = data.get("in_reply_to", "")
    headers = data.get("headers", {})
    references = headers.get("references", "") or data.get("references", "")

    send_record = None
    document_id = None
    user_id = None

    # Try matching by provider_message_id or in_reply_to
    match_ids = [mid for mid in [provider_message_id, in_reply_to] if mid]

    # Also check references header for thread matching
    if references:
        ref_ids = [r.strip().strip("<>") for r in references.split()]
        match_ids.extend(ref_ids)

    for mid in match_ids:
        if not mid:
            continue
        try:
            rows = await supabase.select(
                "document_sends",
                filters={"provider_message_id": mid}
            )
            if rows:
                send_record = rows[0]
                document_id = send_record.get("document_id")
                user_id = send_record.get("user_id")
                break
        except Exception:
            pass

    # Extract reply content
    from_email = data.get("from", "") or data.get("sender", "")
    if isinstance(from_email, list) and from_email:
        from_email = from_email[0]
    if isinstance(from_email, dict):
        from_email = from_email.get("email", "")

    subject = data.get("subject", "")
    body_text = data.get("text", "") or data.get("body", "") or ""
    body_snippet = body_text[:500] if body_text else ""

    # Detect intent for replies
    detected_intent = None
    if is_reply and body_text:
        detected_intent = _detect_intent(body_text, subject)

    # Store event
    event_record = {
        "user_id": user_id,
        "document_send_id": send_record["id"] if send_record else None,
        "document_id": document_id,
        "event_type": event_type,
        "from_email": str(from_email)[:255] if from_email else None,
        "subject": subject[:500] if subject else None,
        "body_snippet": body_snippet or None,
        "raw_payload": payload,
        "detected_intent": detected_intent,
        "processed": False,
    }

    saved_event = await supabase.insert("email_events", event_record)

    # Update document_sends tracking fields
    if send_record:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()

        update_fields = {}
        if event_type == "delivered" and not send_record.get("delivered_at"):
            update_fields["delivered_at"] = now
            update_fields["delivery_status"] = "delivered"
        elif event_type == "opened" and not send_record.get("opened_at"):
            update_fields["opened_at"] = now
        elif event_type == "bounce":
            update_fields["delivery_status"] = "bounced"
            update_fields["error_message"] = data.get("bounce", {}).get("description", "Bounced")

        if update_fields:
            try:
                await supabase.update("document_sends", update_fields, {"id": send_record["id"]})
            except Exception as e:
                print(f"[Webhook] Failed to update send record: {e}")

    # Auto-update document status based on intent
    if detected_intent and document_id and user_id:
        new_status = INTENT_STATUS_MAP.get(detected_intent)
        if new_status:
            try:
                await supabase.update(
                    "documents",
                    {"status": new_status},
                    {"id": document_id, "user_id": user_id}
                )
            except Exception as e:
                print(f"[Webhook] Failed to update document status: {e}")

        # Log activity
        action = "email_replied" if is_reply else event_type
        await _log_activity(
            user_id=user_id,
            document_id=document_id,
            entity_type="document",
            entity_id=document_id,
            action=action,
            detail={
                "from": str(from_email) if from_email else None,
                "intent": detected_intent,
                "subject": subject[:100] if subject else None,
                "event_type": event_type,
            }
        )
    elif user_id and document_id:
        # Log non-reply events too (delivered, opened, bounced)
        await _log_activity(
            user_id=user_id,
            document_id=document_id,
            entity_type="document",
            entity_id=document_id,
            action=event_type,
            detail={"event_type": event_type}
        )

    return {
        "status": "processed",
        "event_type": event_type,
        "matched_send": send_record["id"] if send_record else None,
        "detected_intent": detected_intent,
    }
