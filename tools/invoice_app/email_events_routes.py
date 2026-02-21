"""
Email Events API — List, dismiss, and count unread email events.
"""
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
from .supabase_client import supabase
from .auth_middleware import get_current_user

router = APIRouter()


@router.get("/api/email-events")
async def get_email_events(
    document_id: Optional[str] = Query(None),
    processed: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user)
):
    """
    Get email events for the current user.
    Optional filters: document_id, processed (true/false).
    """
    try:
        user_id = user["sub"]
        filters = {"user_id": user_id}
        if document_id:
            filters["document_id"] = document_id
        if processed is not None:
            filters["processed"] = processed

        rows = await supabase.select(
            "email_events",
            filters=filters,
            order_by=("created_at", True)
        )
        return rows[:limit]
    except Exception as e:
        print(f"[EmailEvents] Error fetching events: {e}")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Failed to fetch email events: {str(e)}"
        )


@router.get("/api/email-events/unread-count")
async def get_unread_count(user: dict = Depends(get_current_user)):
    """Get the count of unprocessed email events."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "email_events",
            columns="id",
            filters={"user_id": user_id, "processed": False}
        )
        return {"count": len(rows)}
    except Exception as e:
        print(f"[EmailEvents] Error fetching unread count: {e}")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Failed to fetch unread count: {str(e)}"
        )


@router.post("/api/email-events/{event_id}/dismiss")
async def dismiss_event(event_id: str, user: dict = Depends(get_current_user)):
    """Mark an email event as processed/dismissed."""
    try:
        user_id = user["sub"]
        result = await supabase.update(
            "email_events",
            {"processed": True},
            {"id": event_id, "user_id": user_id}
        )
        if not result:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[EmailEvents] Error dismissing event: {e}")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Failed to dismiss event: {str(e)}"
        )


@router.post("/api/email-events/dismiss-all")
async def dismiss_all_events(user: dict = Depends(get_current_user)):
    """Mark all email events as processed for the current user."""
    try:
        user_id = user["sub"]
        # Get all unprocessed events
        rows = await supabase.select(
            "email_events",
            columns="id",
            filters={"user_id": user_id, "processed": False}
        )
        # Update each one (Supabase REST doesn't support bulk update easily)
        for row in rows:
            await supabase.update(
                "email_events",
                {"processed": True},
                {"id": row["id"], "user_id": user_id}
            )
        return {"dismissed": len(rows)}
    except Exception as e:
        print(f"[EmailEvents] Error dismissing all events: {e}")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Failed to dismiss events: {str(e)}"
        )
