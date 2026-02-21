"""
Scheduler — Idempotent recurring invoice job runner.
Finds due recurring_rules, clones the source document, optionally sends it.
"""
import asyncio
from datetime import datetime, timezone, timedelta
from .supabase_client import supabase
from .activity_routes import _log_activity

# Re-use the next_run calculator
from .automation_routes import _calculate_next_run


async def execute_single_rule(rule: dict) -> dict:
    """
    Execute a single recurring rule:
    1. Claim via INSERT into recurring_runs (unique index = idempotency)
    2. Fetch + clone source document with new number & dates
    3. Generate PDF
    4. Optionally auto-send
    5. Update run record + advance next_run_at
    """
    rule_id = rule["id"]
    user_id = rule["user_id"]
    now = datetime.now(timezone.utc)
    scheduled_at = rule.get("next_run_at") or now.isoformat()

    # 1. Claim the run (idempotency via UNIQUE(rule_id, scheduled_at))
    run_record = {
        "user_id": user_id,
        "rule_id": rule_id,
        "scheduled_at": scheduled_at,
        "status": "running",
        "started_at": now.isoformat(),
    }
    try:
        run = await supabase.insert("recurring_runs", run_record)
    except Exception as e:
        # If unique constraint fails, this run was already claimed
        if "duplicate" in str(e).lower() or "unique" in str(e).lower() or "409" in str(e):
            print(f"[Scheduler] Run already claimed for rule {rule_id} at {scheduled_at}")
            return {"status": "skipped", "reason": "already_claimed"}
        raise

    run_id = run["id"]

    try:
        # 2. Fetch source document
        source_docs = await supabase.select(
            "documents",
            filters={"id": rule["source_document_id"], "user_id": user_id}
        )
        if not source_docs:
            raise Exception("Source document not found")
        source = source_docs[0]

        # 3. Generate new document number
        settings_rows = await supabase.select("company_settings", filters={"user_id": user_id})
        company_settings = settings_rows[0] if settings_rows else {}

        doc_type = source.get("document_type", "invoice")
        if doc_type == "invoice":
            fmt = company_settings.get("invoice_number_format", "F-{YEAR}-{SEQ}")
            prefix = company_settings.get("invoice_number_prefix", "F")
            next_num = company_settings.get("invoice_number_next", 1)
        else:
            fmt = company_settings.get("quote_number_format", "O-{YEAR}-{SEQ}")
            prefix = company_settings.get("quote_number_prefix", "O")
            next_num = company_settings.get("quote_number_next", 1)

        from .settings_routes import format_document_number
        actual_fmt = fmt.replace("{PREFIX}", prefix)
        new_doc_number = format_document_number(actual_fmt, next_num)

        # 4. New dates
        today = now.strftime("%Y-%m-%d")
        payment_days = company_settings.get("default_payment_terms_days", 30)
        due_date = (now + timedelta(days=payment_days)).strftime("%Y-%m-%d")

        # 5. Clone document record
        new_doc = {
            "document_type": doc_type,
            "document_number": new_doc_number,
            "date": today,
            "due_date": due_date,
            "customer_id": source.get("customer_id"),
            "customer_name": source.get("customer_name", ""),
            "template_id": source.get("template_id"),
            "line_items": source.get("line_items", []),
            "subtotal": source.get("subtotal", 0),
            "btw_amount": source.get("btw_amount", 0),
            "total_amount": source.get("total_amount", 0),
            "notes": source.get("notes", ""),
            "status": "concept",
            "user_id": user_id,
            "source_document_id": source["id"],
            "recurring_rule_id": rule_id,
        }

        created_doc = await supabase.insert("documents", new_doc)
        created_doc_id = created_doc["id"]

        # 6. Generate PDF
        pdf_url = None
        try:
            from .pdf_generator import generate_pdf
            from .document_routes import build_input_data, calculate_totals

            template_rows = await supabase.select(
                "templates", filters={"id": source["template_id"], "user_id": user_id}
            )
            if template_rows:
                template_json = template_rows[0]["template_json"]
                line_items = source.get("line_items", [])
                totals = calculate_totals(line_items)

                # Fetch customer for PDF
                customer = None
                if source.get("customer_id"):
                    cust_rows = await supabase.select(
                        "customers", filters={"id": source["customer_id"], "user_id": user_id}
                    )
                    if cust_rows:
                        customer = cust_rows[0]

                # Convert dates for display
                def iso_to_display(iso_date):
                    if not iso_date:
                        return ""
                    parts = str(iso_date).split("-")
                    if len(parts) == 3 and len(parts[0]) == 4:
                        return f"{parts[2]}-{parts[1]}-{parts[0]}"
                    return str(iso_date)

                input_data = build_input_data(
                    template_json, company_settings, customer,
                    line_items, new_doc_number,
                    iso_to_display(today), iso_to_display(due_date),
                    totals, doc_type
                )

                pdf_result = await generate_pdf(
                    template_json, input_data,
                    filename=f"{doc_type}_{new_doc_number}"
                )
                pdf_url = pdf_result["pdf_url"]

                await supabase.update(
                    "documents",
                    {"pdf_url": pdf_url, "storage_path": pdf_result["storage_path"], "status": "sent"},
                    {"id": created_doc_id, "user_id": user_id}
                )
        except Exception as pdf_err:
            print(f"[Scheduler] PDF generation failed for rule {rule_id}: {pdf_err}")

        # 7. Increment document number in settings
        if settings_rows:
            try:
                num_field = "invoice_number_next" if doc_type == "invoice" else "quote_number_next"
                await supabase.update(
                    "company_settings",
                    {num_field: next_num + 1},
                    {"id": company_settings["id"], "user_id": user_id}
                )
            except Exception:
                pass

        # 8. Optionally auto-send
        send_id = None
        if rule.get("auto_send") and pdf_url and source.get("customer_id"):
            try:
                from .email_service import get_email_provider, build_document_email

                # Fetch full customer for email
                cust_rows = await supabase.select(
                    "customers", filters={"id": source["customer_id"], "user_id": user_id}
                )
                if cust_rows:
                    customer = cust_rows[0]
                    email = customer.get("email")
                    if email:
                        provider = get_email_provider()
                        email_data = build_document_email(
                            {**created_doc, "pdf_url": pdf_url},
                            customer, company_settings
                        )
                        send_result = await provider.send(
                            to_email=email,
                            to_name=customer.get("name", ""),
                            subject=email_data["subject"],
                            body_text=email_data["body_text"],
                            body_html=email_data.get("body_html"),
                            from_name=email_data.get("from_name"),
                            from_email=email_data.get("from_email"),
                            reply_to=email_data.get("reply_to"),
                        )

                        # Record send
                        send_record = {
                            "user_id": user_id,
                            "document_id": created_doc_id,
                            "recipient_email": email,
                            "recipient_name": customer.get("name", ""),
                            "subject": email_data["subject"],
                            "body_text": email_data["body_text"],
                            "provider": send_result.get("provider", "resend"),
                            "provider_message_id": send_result.get("message_id", ""),
                            "delivery_status": "sent",
                            "sent_at": now.isoformat(),
                        }
                        send_row = await supabase.insert("document_sends", send_record)
                        send_id = send_row["id"] if send_row else None

                        await supabase.update(
                            "documents",
                            {"sent_at": now.isoformat(), "last_sent_email": email},
                            {"id": created_doc_id, "user_id": user_id}
                        )
            except Exception as send_err:
                print(f"[Scheduler] Auto-send failed for rule {rule_id}: {send_err}")

        # 9. Advance next_run_at
        next_run = _calculate_next_run(
            rule["frequency"],
            rule.get("day_of_month"),
            rule.get("day_of_week"),
            rule.get("interval_days"),
            from_date=now
        )

        new_count = (rule.get("occurrences_count") or 0) + 1
        rule_updates = {
            "next_run_at": next_run.isoformat(),
            "last_run_at": now.isoformat(),
            "occurrences_count": new_count,
            "updated_at": now.isoformat(),
        }

        # Check end conditions
        if rule.get("end_date") and next_run.date() > datetime.fromisoformat(str(rule["end_date"])).date():
            rule_updates["is_active"] = False
        if rule.get("max_occurrences") and new_count >= rule["max_occurrences"]:
            rule_updates["is_active"] = False

        await supabase.update(
            "recurring_rules", rule_updates, {"id": rule_id, "user_id": user_id}
        )

        # 10. Mark run as completed
        await supabase.update(
            "recurring_runs",
            {
                "status": "completed",
                "created_document_id": created_doc_id,
                "send_id": send_id,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
            {"id": run_id}
        )

        # 11. Log activity
        await _log_activity(
            user_id=user_id,
            document_id=created_doc_id,
            entity_type="automation",
            entity_id=rule_id,
            action="automation_ran",
            detail={
                "rule_name": rule.get("name"),
                "document_number": new_doc_number,
                "auto_sent": bool(send_id),
            }
        )

        return {
            "status": "completed",
            "run_id": run_id,
            "created_document_id": created_doc_id,
            "document_number": new_doc_number,
            "auto_sent": bool(send_id),
        }

    except Exception as e:
        # Mark run as failed
        try:
            await supabase.update(
                "recurring_runs",
                {
                    "status": "failed",
                    "error_message": str(e)[:500],
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
                {"id": run_id}
            )
        except Exception:
            pass
        print(f"[Scheduler] Rule {rule_id} failed: {e}")
        raise


async def run_due_automations():
    """Find all active rules where next_run_at <= now() and execute them."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        rules = await supabase.select_lte(
            "recurring_rules",
            lte_column="next_run_at",
            lte_value=now,
            eq_filters={"is_active": True},
            order_by=("next_run_at", False)
        )

        if not rules:
            return

        print(f"[Scheduler] Found {len(rules)} due automation(s)")

        for rule in rules:
            try:
                await execute_single_rule(rule)
            except Exception as e:
                print(f"[Scheduler] Failed to execute rule {rule['id']}: {e}")

    except Exception as e:
        print(f"[Scheduler] Error in run_due_automations: {e}")


async def scheduler_loop(interval_seconds: int = 300):
    """Background loop that checks for due automations every interval."""
    print(f"[Scheduler] Started — checking every {interval_seconds}s")
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await run_due_automations()
        except Exception as e:
            print(f"[Scheduler] Loop error: {e}")
