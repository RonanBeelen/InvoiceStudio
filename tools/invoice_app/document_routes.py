"""
Document API routes for invoice/quote creation and management
"""
import re
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
from .supabase_client import supabase
from .auth_middleware import get_current_user
from .pdf_generator import generate_pdf, delete_from_storage
from .settings_routes import format_document_number, get_default_settings
from .activity_routes import _log_activity

router = APIRouter(prefix="/api/documents")


def format_currency(amount):
    """Format a number as currency string"""
    return f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def build_input_data(template_json, company_settings, customer, line_items,
                     document_number, date_str, due_date_str, totals, document_type):
    """
    Map structured data to flat pdfme field name dict.
    Inspects the template schemas to discover field names and fills them.
    """
    schemas = template_json.get("schemas", [{}])
    page_schema = schemas[0] if schemas else {}
    input_data = {}

    # Build company address block
    company_parts = []
    if company_settings.get("address"):
        company_parts.append(company_settings["address"])
    city_line = " ".join(filter(None, [company_settings.get("postal_code"), company_settings.get("city")]))
    if city_line:
        company_parts.append(city_line)
    company_address = "\n".join(company_parts)

    # Build customer address block
    customer_parts = []
    if customer:
        if customer.get("address"):
            customer_parts.append(customer["address"])
        cust_city = " ".join(filter(None, [customer.get("postal_code"), customer.get("city")]))
        if cust_city:
            customer_parts.append(cust_city)
    customer_address = "\n".join(customer_parts)

    # Build footer
    footer_parts = []
    if company_settings.get("company_name"):
        footer_parts.append(company_settings["company_name"])
    if company_settings.get("kvk_number"):
        footer_parts.append(f"KvK: {company_settings['kvk_number']}")
    if company_settings.get("btw_number"):
        footer_parts.append(f"BTW: {company_settings['btw_number']}")
    if company_settings.get("iban"):
        footer_parts.append(f"IBAN: {company_settings['iban']}")
    footer_text = company_settings.get("footer_text") or " | ".join(footer_parts)

    # Title based on document type
    title = "FACTUUR" if document_type == "invoice" else "OFFERTE"

    for field_name in page_schema:
        field_def = page_schema[field_name]
        field_type = field_def.get("type", "text")
        name_lower = field_name.lower()

        # Skip non-text types (shapes, lines, images keep their template content)
        if field_type in ("line", "rectangle", "ellipse", "svg"):
            continue

        # Logo image - skip (keep template content)
        if field_type == "image" and "logo" not in name_lower:
            continue

        # Company fields
        if name_lower == "bedrijfsnaam":
            input_data[field_name] = company_settings.get("company_name", "")
        elif name_lower == "bedrijfsadres":
            input_data[field_name] = company_address
        elif name_lower == "footer":
            input_data[field_name] = footer_text

        # Customer fields
        elif name_lower == "klant_naam":
            input_data[field_name] = customer.get("name", "") if customer else ""
        elif name_lower == "klant_adres":
            input_data[field_name] = customer_address

        # Invoice meta
        elif name_lower in ("factuurnummer", "offerte_nummer", "documentnummer"):
            input_data[field_name] = document_number
        elif name_lower == "datum":
            input_data[field_name] = date_str
        elif name_lower == "vervaldatum":
            input_data[field_name] = due_date_str
        elif name_lower in ("factuur_titel", "offerte_titel", "document_titel", "titel"):
            input_data[field_name] = title

        # Line items (regex: regel{N}_{column})
        elif re.match(r"regel(\d+)_(.+)", name_lower):
            match = re.match(r"regel(\d+)_(.+)", name_lower)
            idx = int(match.group(1)) - 1
            col = match.group(2)
            if idx < len(line_items):
                item = line_items[idx]
                if col == "omschrijving":
                    input_data[field_name] = item.get("description", "")
                elif col == "aantal":
                    input_data[field_name] = str(item.get("quantity", ""))
                elif col == "prijs":
                    input_data[field_name] = format_currency(item.get("unit_price", 0))
                elif col == "totaal":
                    line_total = item.get("quantity", 0) * item.get("unit_price", 0)
                    input_data[field_name] = format_currency(line_total)
                elif col == "btw":
                    input_data[field_name] = f"{item.get('btw_percentage', 21)}%"
            else:
                input_data[field_name] = ""

        # Totals
        elif name_lower == "subtotaal":
            input_data[field_name] = format_currency(totals["subtotal"])
        elif name_lower == "btw":
            input_data[field_name] = format_currency(totals["btw_amount"])
        elif name_lower == "totaal":
            input_data[field_name] = format_currency(totals["total"])

        # Payment info
        elif name_lower == "betaalinfo" or name_lower == "betaalgegevens":
            parts = []
            if company_settings.get("iban"):
                parts.append(f"IBAN: {company_settings['iban']}")
            if document_number:
                parts.append(f"Ref: {document_number}")
            input_data[field_name] = "\n".join(parts)

        # Labels and other static text - don't override template content

    return input_data


def calculate_totals(line_items):
    """Calculate subtotal, BTW, and total from line items."""
    subtotal = 0
    btw_by_rate = {}

    for item in line_items:
        qty = item.get("quantity", 0)
        price = item.get("unit_price", 0)
        btw_pct = item.get("btw_percentage", 21)
        line_total = qty * price
        subtotal += line_total

        btw_amount = line_total * (btw_pct / 100)
        btw_by_rate[btw_pct] = btw_by_rate.get(btw_pct, 0) + btw_amount

    total_btw = sum(btw_by_rate.values())

    return {
        "subtotal": round(subtotal, 2),
        "btw_amount": round(total_btw, 2),
        "btw_by_rate": {k: round(v, 2) for k, v in btw_by_rate.items()},
        "total": round(subtotal + total_btw, 2),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_document(doc_data: dict, user: dict = Depends(get_current_user)):
    """
    Create a new document (invoice or quote).
    Generates PDF and stores the document record.
    """
    try:
        user_id = user["sub"]
        document_type = doc_data.get("document_type")
        if document_type not in ("invoice", "quote"):
            raise HTTPException(400, "document_type must be 'invoice' or 'quote'")

        template_id = doc_data.get("template_id")
        if not template_id:
            raise HTTPException(400, "template_id is required")

        line_items = doc_data.get("line_items", [])
        if not line_items:
            raise HTTPException(400, "At least one line item is required")

        # 1. Fetch template
        templates = await supabase.select("templates", filters={"id": template_id, "user_id": user_id})
        if not templates:
            raise HTTPException(404, "Template not found")
        template = templates[0]
        template_json = template["template_json"]

        # 2. Fetch company settings
        settings_rows = await supabase.select("company_settings", filters={"user_id": user_id})
        company_settings = settings_rows[0] if settings_rows else get_default_settings()

        # 3. Fetch customer (optional)
        customer = None
        customer_id = doc_data.get("customer_id")
        if customer_id:
            customers = await supabase.select("customers", filters={"id": customer_id, "user_id": user_id})
            if customers:
                customer = customers[0]

        # 4. Generate document number
        if document_type == "invoice":
            fmt = company_settings.get("invoice_number_format", "F-{YEAR}-{SEQ}")
            prefix = company_settings.get("invoice_number_prefix", "F")
            next_num = company_settings.get("invoice_number_next", 1)
        else:
            fmt = company_settings.get("quote_number_format", "O-{YEAR}-{SEQ}")
            prefix = company_settings.get("quote_number_prefix", "O")
            next_num = company_settings.get("quote_number_next", 1)

        # Replace {PREFIX} in format
        actual_fmt = fmt.replace("{PREFIX}", prefix)
        document_number = format_document_number(actual_fmt, next_num)

        # 5. Dates
        date_str = doc_data.get("date") or datetime.utcnow().strftime("%d-%m-%Y")
        payment_days = company_settings.get("default_payment_terms_days", 30)
        if doc_data.get("due_date"):
            due_date_str = doc_data["due_date"]
        else:
            due_date = datetime.utcnow() + timedelta(days=payment_days)
            due_date_str = due_date.strftime("%d-%m-%Y")

        # 6. Calculate totals
        totals = calculate_totals(line_items)

        # 7. Build input_data for pdfme
        input_data = build_input_data(
            template_json, company_settings, customer,
            line_items, document_number, date_str, due_date_str,
            totals, document_type
        )

        # 8. Determine if we should generate PDF or save as concept
        generate = doc_data.get("generate_pdf", True)
        pdf_url = None
        storage_path = None

        if generate:
            # Generate PDF
            pdf_result = await generate_pdf(
                template_json, input_data,
                filename=f"{document_type}_{document_number}"
            )
            pdf_url = pdf_result["pdf_url"]
            storage_path = pdf_result["storage_path"]

        # 9. Increment document number in settings
        if settings_rows:
            if document_type == "invoice":
                await supabase.update(
                    "company_settings",
                    {"invoice_number_next": next_num + 1},
                    {"id": company_settings["id"], "user_id": user_id}
                )
            else:
                await supabase.update(
                    "company_settings",
                    {"quote_number_next": next_num + 1},
                    {"id": company_settings["id"], "user_id": user_id}
                )

        # 10. Store document record
        # Convert display date (DD-MM-YYYY) to ISO (YYYY-MM-DD) for database DATE column
        def display_to_iso(dd_mm_yyyy):
            """Convert DD-MM-YYYY to YYYY-MM-DD for PostgreSQL DATE column."""
            if not dd_mm_yyyy:
                return None
            parts = dd_mm_yyyy.split("-")
            if len(parts) == 3 and len(parts[0]) == 2:
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
            return dd_mm_yyyy  # Already ISO or unknown format

        date_iso = display_to_iso(doc_data.get("date")) or datetime.utcnow().strftime("%Y-%m-%d")
        due_date_iso = doc_data.get("due_date_iso") or (datetime.utcnow() + timedelta(days=payment_days)).strftime("%Y-%m-%d")

        doc_record = {
            "document_type": document_type,
            "document_number": document_number,
            "date": date_iso,
            "due_date": due_date_iso,
            "customer_id": customer_id or None,
            "customer_name": customer.get("name", "") if customer else "",
            "template_id": template_id,
            "line_items": line_items,
            "subtotal": totals["subtotal"],
            "btw_amount": totals["btw_amount"],
            "total_amount": totals["total"],
            "status": "sent" if generate else "concept",
            "pdf_url": pdf_url,
            "storage_path": storage_path,
            "notes": doc_data.get("notes", ""),
            "user_id": user_id,
        }

        import json as _json
        print(f"[Documents] Inserting doc_record: {_json.dumps(doc_record, default=str, indent=2)}")
        result = await supabase.insert("documents", doc_record)

        # 11. Also log to usage_logs for statistics
        if generate:
            try:
                await supabase.insert("usage_logs", {
                    "template_id": template_id,
                    "pdf_filename": f"{document_type}_{document_number}.pdf",
                    "file_size_bytes": pdf_result.get("size", 0),
                    "user_id": user_id,
                })
            except Exception:
                pass  # Non-blocking

        # Log activity
        await _log_activity(
            user_id=user_id,
            document_id=result.get("id"),
            entity_type="document",
            entity_id=result.get("id"),
            action="created",
            detail={"document_number": document_number, "type": document_type, "generated_pdf": generate}
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Documents] Error creating document: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create document: {str(e)}"
        )


@router.get("")
async def list_documents(
    type: Optional[str] = Query(None),
    doc_status: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """List all documents with optional filters for the current user."""
    try:
        user_id = user["sub"]
        filters = {"user_id": user_id}
        if type:
            filters["document_type"] = type
        if doc_status:
            filters["status"] = doc_status
        if customer_id:
            filters["customer_id"] = customer_id

        documents = await supabase.select(
            "documents",
            filters=filters,
            order_by=("created_at", True)  # Descending
        )
        if documents:
            d = documents[0]
            print(f"[Documents] GET list: {len(documents)} docs, first={d.get('document_number')}, total={d.get('total_amount')}, notes='{d.get('notes', '')}'")
        return documents
    except Exception as e:
        print(f"[Documents] Error listing documents: {str(e)}")
        raise HTTPException(500, f"Failed to list documents: {str(e)}")


@router.get("/{document_id}")
async def get_document(document_id: str, user: dict = Depends(get_current_user)):
    """Get a single document by ID for the current user."""
    try:
        user_id = user["sub"]
        rows = await supabase.select("documents", filters={"id": document_id, "user_id": user_id})
        if not rows:
            raise HTTPException(404, "Document not found")
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to get document: {str(e)}")


@router.put("/{document_id}")
async def update_document(document_id: str, update_data: dict, user: dict = Depends(get_current_user)):
    """Update a document for the current user. Supports full editing or simple status changes."""
    try:
        user_id = user["sub"]
        rows = await supabase.select("documents", filters={"id": document_id, "user_id": user_id})
        if not rows:
            raise HTTPException(404, "Document not found")

        existing_doc = rows[0]

        # Full edit mode: line_items present means the user is editing the full document
        if "line_items" in update_data:
            line_items = update_data["line_items"]
            if not line_items:
                raise HTTPException(400, "At least one line item is required")

            template_id = update_data.get("template_id", existing_doc.get("template_id"))
            customer_id = update_data.get("customer_id") or existing_doc.get("customer_id")

            # Fetch template
            templates = await supabase.select("templates", filters={"id": template_id, "user_id": user_id})
            if not templates:
                raise HTTPException(404, "Template not found")
            template = templates[0]
            template_json = template["template_json"]

            # Fetch company settings
            settings_rows = await supabase.select("company_settings", filters={"user_id": user_id})
            company_settings = settings_rows[0] if settings_rows else get_default_settings()

            # Fetch customer
            customer = None
            if customer_id:
                customers = await supabase.select("customers", filters={"id": customer_id, "user_id": user_id})
                if customers:
                    customer = customers[0]

            # Dates
            date_str = update_data.get("date") or existing_doc.get("date", "")
            due_date_str = update_data.get("due_date") or existing_doc.get("due_date", "")

            # Calculate totals
            totals = calculate_totals(line_items)

            # Build input_data for pdfme
            document_number = existing_doc["document_number"]
            document_type = update_data.get("document_type", existing_doc["document_type"])
            input_data = build_input_data(
                template_json, company_settings, customer,
                line_items, document_number, date_str, due_date_str,
                totals, document_type
            )

            # Generate PDF if requested
            generate = update_data.get("generate_pdf", False)
            pdf_url = existing_doc.get("pdf_url")
            storage_path = existing_doc.get("storage_path")

            if generate:
                # Delete old PDF if it exists
                if storage_path:
                    try:
                        await delete_from_storage(storage_path)
                    except Exception:
                        pass
                pdf_result = await generate_pdf(
                    template_json, input_data,
                    filename=f"{document_type}_{document_number}"
                )
                pdf_url = pdf_result["pdf_url"]
                storage_path = pdf_result["storage_path"]

            # Convert display dates to ISO for DB
            def display_to_iso(dd_mm_yyyy):
                if not dd_mm_yyyy:
                    return None
                parts = dd_mm_yyyy.split("-")
                if len(parts) == 3 and len(parts[0]) == 2:
                    return f"{parts[2]}-{parts[1]}-{parts[0]}"
                return dd_mm_yyyy

            date_iso = display_to_iso(date_str) or existing_doc.get("date")
            due_date_iso = update_data.get("due_date_iso") or existing_doc.get("due_date")

            clean_data = {
                "document_type": document_type,
                "template_id": template_id,
                "customer_id": customer_id or None,
                "customer_name": customer.get("name", "") if customer else "",
                "line_items": line_items,
                "date": date_iso,
                "due_date": due_date_iso,
                "subtotal": totals["subtotal"],
                "btw_amount": totals["btw_amount"],
                "total_amount": totals["total"],
                "notes": update_data.get("notes", existing_doc.get("notes", "")),
                "status": "sent" if generate else existing_doc.get("status", "concept"),
                "pdf_url": pdf_url,
                "storage_path": storage_path,
            }
        else:
            # Simple update (status/notes only)
            allowed = ["status", "notes"]
            clean_data = {k: v for k, v in update_data.items() if k in allowed}
            if not clean_data:
                raise HTTPException(400, "No valid fields to update")

        import json as _json
        print(f"[Documents] === UPDATE START for {document_id} ===")
        print(f"[Documents] clean_data keys: {list(clean_data.keys())}")
        if 'line_items' in clean_data:
            print(f"[Documents] NEW line_items: {_json.dumps(clean_data['line_items'], default=str)}")
        print(f"[Documents] NEW totals: subtotal={clean_data.get('subtotal')}, btw={clean_data.get('btw_amount')}, total={clean_data.get('total_amount')}")
        print(f"[Documents] NEW notes='{clean_data.get('notes', '')}'")

        result = await supabase.update("documents", clean_data, {"id": document_id, "user_id": user_id})

        if not result:
            print(f"[Documents] WARNING: update returned empty result for document {document_id}")
            rows = await supabase.select("documents", filters={"id": document_id, "user_id": user_id})
            if rows:
                print(f"[Documents] Re-fetched after fail: total={rows[0].get('total_amount')}")
                raise HTTPException(500, "Document update failed — no rows affected")
            raise HTTPException(500, "Document update failed and document not found")

        print(f"[Documents] Supabase returned: total={result.get('total_amount')}, notes='{result.get('notes', '')}'")

        # VERIFY: immediate read-back to confirm persistence
        verify = await supabase.select("documents", filters={"id": document_id, "user_id": user_id})
        if verify:
            v = verify[0]
            match = v.get('total_amount') == clean_data.get('total_amount')
            print(f"[Documents] VERIFY read-back: total={v.get('total_amount')}, match={match}")
            if not match:
                print(f"[Documents] !!! DATA MISMATCH - update did NOT persist!")
        print(f"[Documents] === UPDATE END ===")

        # Log activity
        action = "status_changed" if "status" in clean_data and "line_items" not in clean_data else "updated"
        await _log_activity(
            user_id=user_id,
            document_id=document_id,
            entity_type="document",
            entity_id=document_id,
            action=action,
            detail={"fields": list(clean_data.keys())}
        )

        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Documents] Error updating document: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Failed to update document: {str(e)}")


@router.post("/{document_id}/generate-pdf")
async def generate_document_pdf(document_id: str, user: dict = Depends(get_current_user)):
    """Generate (or re-generate) PDF for an existing document."""
    try:
        user_id = user["sub"]
        rows = await supabase.select("documents", filters={"id": document_id, "user_id": user_id})
        if not rows:
            raise HTTPException(404, "Document not found")

        doc = rows[0]

        # Fetch template
        template_id = doc.get("template_id")
        if not template_id:
            raise HTTPException(400, "Document has no template assigned")
        templates_rows = await supabase.select("templates", filters={"id": template_id, "user_id": user_id})
        if not templates_rows:
            raise HTTPException(404, "Template not found")
        template_json = templates_rows[0]["template_json"]

        # Fetch company settings
        settings_rows = await supabase.select("company_settings", filters={"user_id": user_id})
        company_settings = settings_rows[0] if settings_rows else get_default_settings()

        # Fetch customer
        customer = None
        if doc.get("customer_id"):
            customers = await supabase.select("customers", filters={"id": doc["customer_id"], "user_id": user_id})
            if customers:
                customer = customers[0]

        # Build dates (stored as ISO in DB, convert to DD-MM-YYYY for display in template)
        def iso_to_display(iso_date):
            if not iso_date:
                return ""
            parts = str(iso_date).split("-")
            if len(parts) == 3 and len(parts[0]) == 4:
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
            return str(iso_date)

        date_str = iso_to_display(doc.get("date"))
        due_date_str = iso_to_display(doc.get("due_date"))

        line_items = doc.get("line_items", [])
        totals = calculate_totals(line_items)

        input_data = build_input_data(
            template_json, company_settings, customer,
            line_items, doc["document_number"], date_str, due_date_str,
            totals, doc["document_type"]
        )

        # Delete old PDF if exists
        if doc.get("storage_path"):
            try:
                await delete_from_storage(doc["storage_path"])
            except Exception:
                pass

        # Generate new PDF
        pdf_result = await generate_pdf(
            template_json, input_data,
            filename=f"{doc['document_type']}_{doc['document_number']}"
        )

        # Update document record with new PDF URL
        await supabase.update(
            "documents",
            {"pdf_url": pdf_result["pdf_url"], "storage_path": pdf_result["storage_path"]},
            {"id": document_id, "user_id": user_id}
        )

        return {
            "pdf_url": pdf_result["pdf_url"],
            "document_number": doc["document_number"],
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Documents] Error generating PDF for document: {str(e)}")
        raise HTTPException(500, f"Failed to generate PDF: {str(e)}")


@router.delete("/{document_id}")
async def delete_document(document_id: str, user: dict = Depends(get_current_user)):
    """Delete a document and its stored PDF for the current user."""
    try:
        user_id = user["sub"]
        rows = await supabase.select("documents", filters={"id": document_id, "user_id": user_id})
        if not rows:
            raise HTTPException(404, "Document not found")

        doc = rows[0]

        # Try to delete stored PDF
        if doc.get("storage_path"):
            try:
                await delete_from_storage(doc["storage_path"])
            except Exception:
                pass  # Non-blocking

        await supabase.delete("documents", {"id": document_id, "user_id": user_id})

        await _log_activity(
            user_id=user_id,
            document_id=None,
            entity_type="document",
            entity_id=document_id,
            action="deleted",
            detail={"document_number": doc.get("document_number")}
        )

        return {"message": "Document deleted", "id": document_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to delete document: {str(e)}")
