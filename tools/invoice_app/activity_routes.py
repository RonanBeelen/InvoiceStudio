"""
Activity Log API routes — central audit trail for all actions.
Provides the _log_activity helper used by all other modules.
"""
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
from .supabase_client import supabase
from .auth_middleware import get_current_user

router = APIRouter()


async def _log_activity(
    user_id: str,
    document_id: Optional[str],
    entity_type: str,
    entity_id: Optional[str],
    action: str,
    detail: dict = None
):
    """
    Internal helper to insert an activity log entry.
    Called by other modules (send_routes, document_routes, etc.).
    Fails silently to avoid breaking the main operation.
    """
    try:
        await supabase.insert("activity_log", {
            "user_id": user_id,
            "document_id": document_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "detail": detail or {},
        })
    except Exception as e:
        print(f"[Activity] Failed to log activity: {e}")


@router.get("/api/documents/{document_id}/activity")
async def get_document_activity(
    document_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user)
):
    """Get the activity timeline for a specific document."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "activity_log",
            filters={"document_id": document_id, "user_id": user_id},
            order_by=("created_at", True)
        )
        return rows[offset:offset + limit]
    except Exception as e:
        print(f"[Activity] Error fetching document activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch activity: {str(e)}"
        )


@router.get("/api/activity/feed")
async def get_activity_feed(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    """Get the user's recent activity feed across all entities."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "activity_log",
            filters={"user_id": user_id},
            order_by=("created_at", True)
        )
        return rows[:limit]
    except Exception as e:
        print(f"[Activity] Error fetching activity feed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch activity feed: {str(e)}"
        )
