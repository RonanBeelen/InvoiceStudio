"""
Price Item API routes — Service/product catalog CRUD
"""
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
from datetime import datetime, timezone
from .supabase_client import supabase
from .auth_middleware import get_current_user
from .models import PriceItemBulkCreate

router = APIRouter(prefix="/api/price-items")

ALLOWED_FIELDS = [
    "name", "description", "category", "unit_price", "unit",
    "btw_percentage", "default_quantity", "sku", "is_active", "sort_order"
]

ALLOWED_CATEGORIES = ["general", "product", "service", "hourly_rate", "travel", "subscription"]


@router.get("")
async def list_price_items(
    category: Optional[str] = Query(None, description="Filter by category"),
    q: Optional[str] = Query(None, description="Search query"),
    active: Optional[bool] = Query(True, description="Filter by active status"),
    user: dict = Depends(get_current_user)
):
    """List all price items for the current user, with optional filters."""
    try:
        user_id = user["sub"]

        if q and q.strip():
            # Search by name or description
            search_filters = {"user_id": user_id}
            if active is not None:
                search_filters["is_active"] = active
            rows = await supabase.select_or(
                "price_items",
                f"(name.ilike.*{q.strip()}*,description.ilike.*{q.strip()}*)",
                order_by=("sort_order", False),
                filters=search_filters
            )
        else:
            filters = {"user_id": user_id}
            if active is not None:
                filters["is_active"] = active
            if category:
                filters["category"] = category

            rows = await supabase.select(
                "price_items",
                filters=filters,
                order_by=("sort_order", False)
            )

        return rows
    except Exception as e:
        print(f"[PriceItems] Error listing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list price items: {str(e)}"
        )


@router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    """List distinct categories used by the current user's price items."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "price_items",
            columns="category",
            filters={"user_id": user_id, "is_active": True}
        )
        categories = sorted(set(r["category"] for r in rows if r.get("category")))
        return categories
    except Exception as e:
        print(f"[PriceItems] Error listing categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list categories: {str(e)}"
        )


@router.post("/bulk-delete")
async def bulk_delete_price_items(payload: dict, user: dict = Depends(get_current_user)):
    """Hard-delete multiple price items at once (permanently removes from database)."""
    ids = payload.get("ids", [])
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ids list is required")
    if len(ids) > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 500 items per request")

    user_id = user["sub"]
    deleted = 0
    for item_id in ids:
        try:
            rows = await supabase.select("price_items", columns="id", filters={"id": item_id, "user_id": user_id})
            if rows:
                await supabase.delete("price_items", {"id": item_id, "user_id": user_id})
                deleted += 1
        except Exception:
            pass

    return {"deleted": deleted}


@router.post("/bulk-archive")
async def bulk_archive_price_items(payload: dict, user: dict = Depends(get_current_user)):
    """Archive multiple price items at once (set is_active=false)."""
    ids = payload.get("ids", [])
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ids list is required")
    if len(ids) > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 500 items per request")

    user_id = user["sub"]
    archived = 0
    for item_id in ids:
        try:
            rows = await supabase.select("price_items", columns="id", filters={"id": item_id, "user_id": user_id})
            if rows:
                await supabase.update(
                    "price_items",
                    {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()},
                    {"id": item_id, "user_id": user_id}
                )
                archived += 1
        except Exception:
            pass

    return {"archived": archived}


@router.post("/archive/{item_id}")
async def archive_price_item(item_id: str, user: dict = Depends(get_current_user)):
    """Archive a price item (set is_active=false)."""
    try:
        user_id = user["sub"]

        rows = await supabase.select("price_items", columns="id", filters={"id": item_id, "user_id": user_id})
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Price item not found"
            )

        await supabase.update(
            "price_items",
            {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()},
            {"id": item_id, "user_id": user_id}
        )
        return {"message": "Price item archived", "id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PriceItems] Error archiving item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to archive price item: {str(e)}"
        )


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_price_items(
    payload: PriceItemBulkCreate,
    user: dict = Depends(get_current_user)
):
    """Bulk create price items from spreadsheet import."""
    user_id = user["sub"]
    results = {"created": 0, "errors": []}

    valid_items = []
    for idx, item in enumerate(payload.items):
        try:
            category = item.category if item.category in ALLOWED_CATEGORIES else "general"
            clean = {
                "name": item.name.strip(),
                "description": (item.description or "").strip() or None,
                "category": category,
                "unit_price": item.unit_price,
                "unit": item.unit or "stuk",
                "btw_percentage": item.btw_percentage if item.btw_percentage is not None else 21.0,
                "default_quantity": item.default_quantity if item.default_quantity is not None else 1.0,
                "sku": (item.sku or "").strip() or None,
                "user_id": user_id,
            }
            valid_items.append((idx, clean))
        except Exception as e:
            results["errors"].append({"row": idx + 1, "error": str(e)})

    if valid_items:
        try:
            rows_to_insert = [item for _, item in valid_items]
            inserted = await supabase.insert_many("price_items", rows_to_insert)
            results["created"] = len(inserted)
        except Exception:
            # Fallback: insert one-by-one to identify problematic rows
            for idx, item_data in valid_items:
                try:
                    await supabase.insert("price_items", item_data)
                    results["created"] += 1
                except Exception as row_error:
                    results["errors"].append({
                        "row": idx + 1,
                        "name": item_data.get("name", ""),
                        "error": str(row_error)
                    })

    return results


@router.get("/{item_id}")
async def get_price_item(item_id: str, user: dict = Depends(get_current_user)):
    """Get a single price item by ID."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "price_items",
            filters={"id": item_id, "user_id": user_id}
        )
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Price item not found"
            )
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PriceItems] Error getting item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get price item: {str(e)}"
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_price_item(item_data: dict, user: dict = Depends(get_current_user)):
    """Create a new price item."""
    try:
        user_id = user["sub"]

        name = item_data.get("name", "").strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item name is required"
            )

        unit_price = item_data.get("unit_price")
        if unit_price is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unit price is required"
            )

        # Validate category
        category = item_data.get("category", "general")
        if category not in ALLOWED_CATEGORIES:
            category = "general"

        clean_data = {k: v for k, v in item_data.items() if k in ALLOWED_FIELDS}
        clean_data["category"] = category
        clean_data["user_id"] = user_id

        result = await supabase.insert("price_items", clean_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PriceItems] Error creating item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create price item: {str(e)}"
        )


@router.put("/{item_id}")
async def update_price_item(item_id: str, item_data: dict, user: dict = Depends(get_current_user)):
    """Update an existing price item."""
    try:
        user_id = user["sub"]

        # Verify ownership
        rows = await supabase.select("price_items", columns="id", filters={"id": item_id, "user_id": user_id})
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Price item not found"
            )

        # Validate category if provided
        if "category" in item_data and item_data["category"] not in ALLOWED_CATEGORIES:
            item_data["category"] = "general"

        clean_data = {k: v for k, v in item_data.items() if k in ALLOWED_FIELDS}
        clean_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = await supabase.update("price_items", clean_data, {"id": item_id, "user_id": user_id})
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PriceItems] Error updating item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update price item: {str(e)}"
        )


@router.delete("/{item_id}")
async def delete_price_item(item_id: str, user: dict = Depends(get_current_user)):
    """Permanently delete a price item from the database."""
    try:
        user_id = user["sub"]

        rows = await supabase.select("price_items", columns="id", filters={"id": item_id, "user_id": user_id})
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Price item not found"
            )

        await supabase.delete("price_items", {"id": item_id, "user_id": user_id})
        return {"message": "Price item permanently deleted", "id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PriceItems] Error deleting item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete price item: {str(e)}"
        )
