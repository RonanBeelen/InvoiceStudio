"""
Price Item API routes — Service/product catalog CRUD
"""
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
from datetime import datetime, timezone
from .supabase_client import supabase
from .auth_middleware import get_current_user

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
            rows = await supabase.select_or(
                "price_items",
                f"(name.ilike.*{q.strip()}*,description.ilike.*{q.strip()}*)",
                order_by=("sort_order", False),
                filters={"user_id": user_id}
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
    """Soft-delete a price item (set is_active=false)."""
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
        return {"message": "Price item deleted", "id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PriceItems] Error deleting item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete price item: {str(e)}"
        )
