"""
Automation Routes — CRUD for recurring invoice rules + run history.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
from .supabase_client import supabase
from .auth_middleware import get_current_user
from .activity_routes import _log_activity

router = APIRouter(prefix="/api/automations")


def _calculate_next_run(frequency: str, day_of_month: int = None,
                        day_of_week: int = None, interval_days: int = None,
                        from_date: datetime = None) -> datetime:
    """Calculate the next run datetime based on frequency settings."""
    from dateutil.relativedelta import relativedelta

    base = from_date or datetime.now(timezone.utc)

    if frequency == "weekly":
        delta = relativedelta(weeks=1)
    elif frequency == "monthly":
        delta = relativedelta(months=1)
        if day_of_month:
            # Jump to the specified day of next month
            try:
                next_dt = base + delta
                next_dt = next_dt.replace(day=min(day_of_month, 28))
                return next_dt
            except ValueError:
                pass
    elif frequency == "quarterly":
        delta = relativedelta(months=3)
    elif frequency == "yearly":
        delta = relativedelta(years=1)
    elif frequency == "custom" and interval_days:
        delta = relativedelta(days=interval_days)
    else:
        delta = relativedelta(months=1)

    return base + delta


@router.get("")
async def list_automations(user: dict = Depends(get_current_user)):
    """List all recurring rules for the current user."""
    try:
        user_id = user["sub"]
        rules = await supabase.select(
            "recurring_rules",
            filters={"user_id": user_id},
            order_by=("created_at", True)
        )
        return rules
    except Exception as e:
        print(f"[Automations] Error listing rules: {e}")
        raise HTTPException(500, f"Failed to list automations: {str(e)}")


@router.get("/{rule_id}")
async def get_automation(rule_id: str, user: dict = Depends(get_current_user)):
    """Get a single automation rule with recent runs."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "recurring_rules",
            filters={"id": rule_id, "user_id": user_id}
        )
        if not rows:
            raise HTTPException(404, "Automation not found")

        rule = rows[0]

        # Fetch recent runs
        runs = await supabase.select(
            "recurring_runs",
            filters={"rule_id": rule_id, "user_id": user_id},
            order_by=("scheduled_at", True)
        )
        rule["runs"] = runs[:20]

        return rule
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to get automation: {str(e)}")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_automation(data: dict, user: dict = Depends(get_current_user)):
    """Create a new recurring rule from a source document."""
    try:
        user_id = user["sub"]

        source_document_id = data.get("source_document_id")
        if not source_document_id:
            raise HTTPException(400, "source_document_id is required")

        # Verify source document exists and belongs to user
        docs = await supabase.select(
            "documents",
            filters={"id": source_document_id, "user_id": user_id}
        )
        if not docs:
            raise HTTPException(404, "Source document not found")

        frequency = data.get("frequency", "monthly")
        if frequency not in ("weekly", "monthly", "quarterly", "yearly", "custom"):
            raise HTTPException(400, "Invalid frequency")

        day_of_month = data.get("day_of_month")
        day_of_week = data.get("day_of_week")
        interval_days = data.get("interval_days")

        # Calculate first run
        next_run = _calculate_next_run(
            frequency, day_of_month, day_of_week, interval_days
        )

        rule_record = {
            "user_id": user_id,
            "name": data.get("name", f"Recurring {docs[0].get('document_number', 'document')}"),
            "source_document_id": source_document_id,
            "customer_id": data.get("customer_id") or docs[0].get("customer_id"),
            "frequency": frequency,
            "interval_days": interval_days,
            "day_of_month": day_of_month,
            "day_of_week": day_of_week,
            "auto_send": data.get("auto_send", False),
            "is_active": True,
            "next_run_at": next_run.isoformat(),
            "end_date": data.get("end_date"),
            "max_occurrences": data.get("max_occurrences"),
            "occurrences_count": 0,
        }

        result = await supabase.insert("recurring_rules", rule_record)

        # Mark source document
        try:
            await supabase.update(
                "documents",
                {"recurring_rule_id": result["id"]},
                {"id": source_document_id, "user_id": user_id}
            )
        except Exception:
            pass

        await _log_activity(
            user_id=user_id,
            document_id=source_document_id,
            entity_type="automation",
            entity_id=result["id"],
            action="created",
            detail={"name": rule_record["name"], "frequency": frequency}
        )

        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Automations] Error creating rule: {e}")
        raise HTTPException(500, f"Failed to create automation: {str(e)}")


@router.put("/{rule_id}")
async def update_automation(rule_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update a recurring rule."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "recurring_rules",
            filters={"id": rule_id, "user_id": user_id}
        )
        if not rows:
            raise HTTPException(404, "Automation not found")

        allowed = [
            "name", "frequency", "interval_days", "day_of_month",
            "day_of_week", "auto_send", "end_date", "max_occurrences"
        ]
        clean = {k: v for k, v in data.items() if k in allowed}

        # Recalculate next_run if frequency changed
        if "frequency" in clean:
            next_run = _calculate_next_run(
                clean.get("frequency", rows[0]["frequency"]),
                clean.get("day_of_month", rows[0].get("day_of_month")),
                clean.get("day_of_week", rows[0].get("day_of_week")),
                clean.get("interval_days", rows[0].get("interval_days"))
            )
            clean["next_run_at"] = next_run.isoformat()

        clean["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = await supabase.update(
            "recurring_rules", clean, {"id": rule_id, "user_id": user_id}
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to update automation: {str(e)}")


@router.delete("/{rule_id}")
async def delete_automation(rule_id: str, user: dict = Depends(get_current_user)):
    """Delete a recurring rule."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "recurring_rules",
            filters={"id": rule_id, "user_id": user_id}
        )
        if not rows:
            raise HTTPException(404, "Automation not found")

        await supabase.delete("recurring_rules", {"id": rule_id, "user_id": user_id})

        await _log_activity(
            user_id=user_id,
            entity_type="automation",
            entity_id=rule_id,
            action="deleted",
            detail={"name": rows[0].get("name")}
        )

        return {"message": "Automation deleted", "id": rule_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to delete automation: {str(e)}")


@router.post("/{rule_id}/pause")
async def pause_automation(rule_id: str, user: dict = Depends(get_current_user)):
    """Pause a recurring rule."""
    try:
        user_id = user["sub"]
        result = await supabase.update(
            "recurring_rules",
            {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()},
            {"id": rule_id, "user_id": user_id}
        )
        if not result:
            raise HTTPException(404, "Automation not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to pause automation: {str(e)}")


@router.post("/{rule_id}/resume")
async def resume_automation(rule_id: str, user: dict = Depends(get_current_user)):
    """Resume a paused recurring rule. Recalculates next_run from now."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "recurring_rules",
            filters={"id": rule_id, "user_id": user_id}
        )
        if not rows:
            raise HTTPException(404, "Automation not found")

        rule = rows[0]
        next_run = _calculate_next_run(
            rule["frequency"],
            rule.get("day_of_month"),
            rule.get("day_of_week"),
            rule.get("interval_days")
        )

        result = await supabase.update(
            "recurring_rules",
            {
                "is_active": True,
                "next_run_at": next_run.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            {"id": rule_id, "user_id": user_id}
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to resume automation: {str(e)}")


@router.post("/{rule_id}/trigger")
async def trigger_automation(rule_id: str, user: dict = Depends(get_current_user)):
    """Manually trigger a single run of a recurring rule."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "recurring_rules",
            filters={"id": rule_id, "user_id": user_id}
        )
        if not rows:
            raise HTTPException(404, "Automation not found")

        from .scheduler import execute_single_rule
        rule = rows[0]
        result = await execute_single_rule(rule)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Automations] Error triggering rule: {e}")
        raise HTTPException(500, f"Failed to trigger automation: {str(e)}")


@router.get("/{rule_id}/runs")
async def get_automation_runs(
    rule_id: str,
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    """Get run history for a recurring rule."""
    try:
        user_id = user["sub"]
        # Verify rule belongs to user
        rules = await supabase.select(
            "recurring_rules",
            columns="id",
            filters={"id": rule_id, "user_id": user_id}
        )
        if not rules:
            raise HTTPException(404, "Automation not found")

        runs = await supabase.select(
            "recurring_runs",
            filters={"rule_id": rule_id, "user_id": user_id},
            order_by=("scheduled_at", True)
        )
        return runs[:limit]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to get runs: {str(e)}")
