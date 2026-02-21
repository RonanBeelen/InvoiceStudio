"""
Email Service — Abstract provider with Resend and Manual implementations.
"""
import os
import httpx
from abc import ABC, abstractmethod
from dotenv import load_dotenv

load_dotenv()


class EmailProvider(ABC):
    """Abstract base for email providers."""

    @abstractmethod
    async def send(self, to_email: str, to_name: str, subject: str,
                   body_html: str, body_text: str, from_email: str = None,
                   from_name: str = None, reply_to: str = None,
                   attachments: list = None) -> dict:
        """
        Send an email. Returns dict with:
          - provider_message_id: str or None
          - delivery_status: 'sent' | 'failed'
          - error_message: str or None
        """


class ResendProvider(EmailProvider):
    """Resend.com email provider."""

    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY", "")
        self.default_from = os.getenv("RESEND_FROM_EMAIL", "invoices@yourdomain.com")

    async def send(self, to_email, to_name, subject, body_html, body_text,
                   from_email=None, from_name=None, reply_to=None, attachments=None):
        if not self.api_key:
            return {
                "provider_message_id": None,
                "delivery_status": "failed",
                "error_message": "RESEND_API_KEY not configured"
            }

        from_addr = from_email or self.default_from
        if from_name:
            from_addr = f"{from_name} <{from_addr}>"

        payload = {
            "from": from_addr,
            "to": [f"{to_name} <{to_email}>" if to_name else to_email],
            "subject": subject,
            "html": body_html,
            "text": body_text,
        }
        if reply_to:
            payload["reply_to"] = reply_to
        if attachments:
            payload["attachments"] = attachments

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=15,
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return {
                        "provider_message_id": data.get("id"),
                        "delivery_status": "sent",
                        "error_message": None,
                    }
                else:
                    return {
                        "provider_message_id": None,
                        "delivery_status": "failed",
                        "error_message": f"Resend API {resp.status_code}: {resp.text}",
                    }
        except Exception as e:
            return {
                "provider_message_id": None,
                "delivery_status": "failed",
                "error_message": str(e),
            }


class ManualProvider(EmailProvider):
    """No-op provider for 'mark as sent' without actually sending email."""

    async def send(self, to_email, to_name, subject, body_html, body_text,
                   from_email=None, from_name=None, reply_to=None, attachments=None):
        return {
            "provider_message_id": None,
            "delivery_status": "sent",
            "error_message": None,
        }


def get_email_provider() -> EmailProvider:
    """Factory: returns the configured email provider."""
    provider_name = os.getenv("EMAIL_PROVIDER", "manual").lower()
    if provider_name == "resend":
        return ResendProvider()
    return ManualProvider()


def build_document_email(document: dict, customer: dict, settings: dict) -> dict:
    """
    Build email subject + body from settings templates.
    Replaces placeholders: {NUMBER}, {COMPANY}, {CUSTOMER}, {TOTAL}, {DUE_DATE}, {DATE}
    Returns: { subject, body_text, body_html }
    """
    doc_type = document.get("document_type", "invoice")
    is_invoice = doc_type == "invoice"

    subject_template = settings.get(
        "email_invoice_subject" if is_invoice else "email_quote_subject",
        f"{'Invoice' if is_invoice else 'Quote'} {{NUMBER}} from {{COMPANY}}"
    )
    body_template = settings.get(
        "email_invoice_body" if is_invoice else "email_quote_body",
        "Dear {CUSTOMER},\n\nPlease find attached {TYPE} {NUMBER}.\n\nKind regards,\n{COMPANY}"
    )

    # Format total as currency
    total = document.get("total_amount", 0)
    total_str = f"\u20ac {total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    # Format dates
    def format_date(iso_date):
        if not iso_date:
            return ""
        parts = str(iso_date).split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
        return str(iso_date)

    replacements = {
        "{NUMBER}": document.get("document_number", ""),
        "{COMPANY}": settings.get("company_name", ""),
        "{CUSTOMER}": customer.get("name", "") if customer else "",
        "{TOTAL}": total_str,
        "{DUE_DATE}": format_date(document.get("due_date")),
        "{DATE}": format_date(document.get("date")),
        "{TYPE}": "invoice" if is_invoice else "quote",
    }

    subject = subject_template
    body_text = body_template
    for placeholder, value in replacements.items():
        subject = subject.replace(placeholder, value)
        body_text = body_text.replace(placeholder, value)

    # Simple HTML version: wrap in paragraphs
    body_html = "<br>".join(
        f"<p>{line}</p>" if line.strip() else "<br>"
        for line in body_text.split("\n")
    )

    return {
        "subject": subject,
        "body_text": body_text,
        "body_html": body_html,
    }
