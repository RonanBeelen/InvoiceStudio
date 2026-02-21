"""
Document Send Routes — email sending, send history, reminders, manual mark-as-sent.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from .supabase_client import supabase
from .auth_middleware import get_current_user
from .email_service import get_email_provider, build_document_email
from .activity_routes import _log_activity
from .settings_routes import get_default_settings

router = APIRouter()


async def _get_document_with_customer(document_id: str, user_id: str):
    """Fetch document and its customer in one helper."""
    rows = await supabase.select("documents", filters={"id": document_id, "user_id": user_id})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    doc = rows[0]

    customer = None
    if doc.get("customer_id"):
        cust_rows = await supabase.select("customers", filters={"id": doc["customer_id"], "user_id": user_id})
        if cust_rows:
            customer = cust_rows[0]

    return doc, customer


@router.post("/api/documents/{document_id}/send")
async def send_document(document_id: str, send_data: dict, user: dict = Depends(get_current_user)):
    """
    Send a document via email.
    Body: { recipient_email, recipient_name?, subject?, body_text? }
    """
    try:
        user_id = user["sub"]
        doc, customer = await _get_document_with_customer(document_id, user_id)

        # Validate: must have a PDF
        if not doc.get("pdf_url"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Document has no PDF. Generate one first.")

        # Resolve recipient
        recipient_email = send_data.get("recipient_email", "").strip()
        if not recipient_email:
            if customer and customer.get("email"):
                recipient_email = customer["email"]
            else:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Recipient email is required")

        recipient_name = send_data.get("recipient_name", "").strip()
        if not recipient_name and customer:
            recipient_name = customer.get("name", "")

        # Build email content from templates (or use overrides from request)
        settings_rows = await supabase.select("company_settings", filters={"user_id": user_id})
        settings = settings_rows[0] if settings_rows else get_default_settings()

        email_content = build_document_email(doc, customer, settings)

        subject = send_data.get("subject", "").strip() or email_content["subject"]
        body_text = send_data.get("body_text", "").strip() or email_content["body_text"]
        body_html = send_data.get("body_html", "").strip() or email_content["body_html"]

        # Send via provider
        provider = get_email_provider()
        result = await provider.send(
            to_email=recipient_email,
            to_name=recipient_name,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            from_email=settings.get("email_from_address"),
            from_name=settings.get("email_from_name") or settings.get("company_name"),
            reply_to=settings.get("email_reply_to") or settings.get("email"),
        )

        now = datetime.now(timezone.utc).isoformat()

        # Record the send
        send_record = {
            "user_id": user_id,
            "document_id": document_id,
            "recipient_email": recipient_email,
            "recipient_name": recipient_name,
            "subject": subject,
            "body_text": body_text,
            "body_html": body_html,
            "provider": type(provider).__name__.replace("Provider", "").lower(),
            "provider_message_id": result.get("provider_message_id"),
            "delivery_status": result["delivery_status"],
            "sent_at": now if result["delivery_status"] == "sent" else None,
            "error_message": result.get("error_message"),
        }

        saved_send = await supabase.insert("document_sends", send_record)

        # Update document status + sent_at if successful
        if result["delivery_status"] == "sent":
            await supabase.update("documents", {
                "status": "sent",
                "sent_at": now,
                "last_sent_email": recipient_email,
            }, {"id": document_id, "user_id": user_id})

            await _log_activity(
                user_id=user_id,
                document_id=document_id,
                entity_type="document",
                entity_id=document_id,
                action="sent",
                detail={"recipient": recipient_email, "subject": subject}
            )

        if result["delivery_status"] == "failed":
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                f"Email delivery failed: {result.get('error_message', 'Unknown error')}"
            )

        return saved_send

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Send] Error sending document: {e}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to send: {str(e)}")


@router.get("/api/documents/{document_id}/sends")
async def get_send_history(document_id: str, user: dict = Depends(get_current_user)):
    """Get the send history for a document."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "document_sends",
            filters={"document_id": document_id, "user_id": user_id},
            order_by=("created_at", True)
        )
        return rows
    except Exception as e:
        print(f"[Send] Error fetching send history: {e}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch sends: {str(e)}")


@router.post("/api/documents/{document_id}/send/reminder")
async def send_reminder(document_id: str, send_data: dict, user: dict = Depends(get_current_user)):
    """
    Re-send/remind on an existing document. Uses the same flow as initial send
    but logs as a reminder action.
    """
    try:
        user_id = user["sub"]
        doc, customer = await _get_document_with_customer(document_id, user_id)

        if not doc.get("pdf_url"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Document has no PDF.")

        recipient_email = send_data.get("recipient_email", "").strip()
        if not recipient_email:
            recipient_email = doc.get("last_sent_email", "")
        if not recipient_email and customer:
            recipient_email = customer.get("email", "")
        if not recipient_email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Recipient email is required")

        recipient_name = send_data.get("recipient_name", "").strip()
        if not recipient_name and customer:
            recipient_name = customer.get("name", "")

        settings_rows = await supabase.select("company_settings", filters={"user_id": user_id})
        settings = settings_rows[0] if settings_rows else get_default_settings()

        email_content = build_document_email(doc, customer, settings)
        subject = send_data.get("subject", "").strip() or f"Reminder: {email_content['subject']}"
        body_text = send_data.get("body_text", "").strip() or email_content["body_text"]
        body_html = send_data.get("body_html", "").strip() or email_content["body_html"]

        provider = get_email_provider()
        result = await provider.send(
            to_email=recipient_email,
            to_name=recipient_name,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            from_email=settings.get("email_from_address"),
            from_name=settings.get("email_from_name") or settings.get("company_name"),
            reply_to=settings.get("email_reply_to") or settings.get("email"),
        )

        now = datetime.now(timezone.utc).isoformat()
        send_record = {
            "user_id": user_id,
            "document_id": document_id,
            "recipient_email": recipient_email,
            "recipient_name": recipient_name,
            "subject": subject,
            "body_text": body_text,
            "body_html": body_html,
            "provider": type(provider).__name__.replace("Provider", "").lower(),
            "provider_message_id": result.get("provider_message_id"),
            "delivery_status": result["delivery_status"],
            "sent_at": now if result["delivery_status"] == "sent" else None,
            "error_message": result.get("error_message"),
        }

        saved_send = await supabase.insert("document_sends", send_record)

        if result["delivery_status"] == "sent":
            await _log_activity(
                user_id=user_id,
                document_id=document_id,
                entity_type="document",
                entity_id=document_id,
                action="reminder_sent",
                detail={"recipient": recipient_email, "subject": subject}
            )

        if result["delivery_status"] == "failed":
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                f"Email delivery failed: {result.get('error_message', 'Unknown error')}"
            )

        return saved_send

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Send] Error sending reminder: {e}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to send reminder: {str(e)}")


@router.post("/api/documents/{document_id}/mark-sent")
async def mark_as_sent(document_id: str, send_data: dict = None, user: dict = Depends(get_current_user)):
    """
    Manually mark a document as sent without actually sending email.
    Optionally accepts { recipient_email } to record who it was sent to.
    """
    try:
        user_id = user["sub"]
        send_data = send_data or {}

        rows = await supabase.select("documents", filters={"id": document_id, "user_id": user_id})
        if not rows:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

        now = datetime.now(timezone.utc).isoformat()
        recipient_email = send_data.get("recipient_email", "manual")

        # Record a manual send entry
        await supabase.insert("document_sends", {
            "user_id": user_id,
            "document_id": document_id,
            "recipient_email": recipient_email,
            "recipient_name": send_data.get("recipient_name", ""),
            "subject": "",
            "body_text": "",
            "provider": "manual",
            "delivery_status": "sent",
            "sent_at": now,
        })

        # Update document
        update_data = {"status": "sent", "sent_at": now}
        if recipient_email != "manual":
            update_data["last_sent_email"] = recipient_email

        result = await supabase.update("documents", update_data, {"id": document_id, "user_id": user_id})

        await _log_activity(
            user_id=user_id,
            document_id=document_id,
            entity_type="document",
            entity_id=document_id,
            action="marked_sent",
            detail={"method": "manual", "recipient": recipient_email}
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Send] Error marking as sent: {e}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to mark as sent: {str(e)}")
