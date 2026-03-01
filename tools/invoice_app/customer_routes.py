"""
Customer API routes for address book management
"""
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
from datetime import datetime, timezone
from .supabase_client import supabase
from .auth_middleware import get_current_user
from .models import CustomerBulkCreate

router = APIRouter(prefix="/api/customers")


@router.get("")
async def list_customers(
    q: Optional[str] = Query(None, description="Search query"),
    active: Optional[bool] = Query(True, description="Filter by active status"),
    user: dict = Depends(get_current_user)
):
    """
    List all customers for the current user, optionally filtered by search query.
    Search matches against name and company_name.
    """
    try:
        user_id = user["sub"]
        if q and q.strip():
            search_filters = {"user_id": user_id}
            if active is not None:
                search_filters["is_active"] = active
            results = await supabase.select_or(
                "customers",
                f"(name.ilike.*{q.strip()}*,company_name.ilike.*{q.strip()}*)",
                order_by=("name", False),
                filters=search_filters
            )
            return results
        else:
            filters = {"user_id": user_id}
            if active is not None:
                filters["is_active"] = active
            return await supabase.select(
                "customers",
                filters=filters,
                order_by=("name", False)
            )
    except Exception as e:
        print(f"[Customers] Error listing customers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list customers: {str(e)}"
        )


@router.post("/bulk-delete")
async def bulk_delete_customers(payload: dict, user: dict = Depends(get_current_user)):
    """Permanently delete multiple customers at once."""
    ids = payload.get("ids", [])
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ids list is required")
    if len(ids) > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 500 items per request")

    user_id = user["sub"]
    deleted = 0
    for customer_id in ids:
        try:
            rows = await supabase.select("customers", columns="id", filters={"id": customer_id, "user_id": user_id})
            if rows:
                await supabase.delete("customers", {"id": customer_id, "user_id": user_id})
                deleted += 1
        except Exception:
            pass

    return {"deleted": deleted}


@router.post("/bulk-archive")
async def bulk_archive_customers(payload: dict, user: dict = Depends(get_current_user)):
    """Archive multiple customers at once (set is_active=false)."""
    ids = payload.get("ids", [])
    if not ids or not isinstance(ids, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ids list is required")
    if len(ids) > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 500 items per request")

    user_id = user["sub"]
    archived = 0
    for customer_id in ids:
        try:
            rows = await supabase.select("customers", columns="id", filters={"id": customer_id, "user_id": user_id})
            if rows:
                await supabase.update(
                    "customers",
                    {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()},
                    {"id": customer_id, "user_id": user_id}
                )
                archived += 1
        except Exception:
            pass

    return {"archived": archived}


@router.post("/bulk-create", status_code=status.HTTP_201_CREATED)
async def bulk_create_customers(payload: CustomerBulkCreate, user: dict = Depends(get_current_user)):
    """Bulk create customers from spreadsheet or vCard import."""
    user_id = user["sub"]
    allowed_fields = [
        "name", "company_name", "address", "postal_code",
        "city", "country", "email", "phone", "tax_id", "notes"
    ]
    results = {"created": 0, "errors": []}
    valid_rows = []

    for idx, customer in enumerate(payload.customers):
        clean = {k: v for k, v in customer.model_dump().items()
                 if k in allowed_fields and v is not None and str(v).strip() != ""}
        clean["user_id"] = user_id
        if not clean.get("name", "").strip():
            results["errors"].append({"row": idx + 1, "error": "Name is required"})
        else:
            valid_rows.append((idx, clean))

    if valid_rows:
        try:
            rows_to_insert = [row for _, row in valid_rows]
            inserted = await supabase.insert_many("customers", rows_to_insert)
            results["created"] = len(inserted)
        except Exception:
            for idx, row_data in valid_rows:
                try:
                    await supabase.insert("customers", row_data)
                    results["created"] += 1
                except Exception as e:
                    results["errors"].append({
                        "row": idx + 1,
                        "name": row_data.get("name", ""),
                        "error": str(e)
                    })

    return results


@router.post("/archive/{customer_id}")
async def archive_customer(customer_id: str, user: dict = Depends(get_current_user)):
    """Archive a customer (set is_active=false)."""
    try:
        user_id = user["sub"]
        rows = await supabase.select("customers", columns="id", filters={"id": customer_id, "user_id": user_id})
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        await supabase.update(
            "customers",
            {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()},
            {"id": customer_id, "user_id": user_id}
        )
        return {"message": "Customer archived", "id": customer_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Customers] Error archiving customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to archive customer: {str(e)}"
        )


@router.get("/{customer_id}")
async def get_customer(customer_id: str, user: dict = Depends(get_current_user)):
    """Get a single customer by ID for the current user."""
    try:
        user_id = user["sub"]
        rows = await supabase.select(
            "customers",
            filters={"id": customer_id, "user_id": user_id}
        )
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )
        return rows[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Customers] Error getting customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get customer: {str(e)}"
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(customer_data: dict, user: dict = Depends(get_current_user)):
    """Create a new customer for the current user."""
    try:
        user_id = user["sub"]
        name = customer_data.get("name", "").strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer name is required"
            )

        # Only keep valid fields
        allowed_fields = [
            "name", "company_name", "address", "postal_code",
            "city", "country", "email", "phone", "tax_id", "notes"
        ]
        clean_data = {k: v for k, v in customer_data.items() if k in allowed_fields}
        clean_data["user_id"] = user_id

        result = await supabase.insert("customers", clean_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Customers] Error creating customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create customer: {str(e)}"
        )


@router.put("/{customer_id}")
async def update_customer(customer_id: str, customer_data: dict, user: dict = Depends(get_current_user)):
    """Update an existing customer for the current user."""
    try:
        user_id = user["sub"]
        # Verify customer exists and belongs to user
        rows = await supabase.select("customers", columns="id", filters={"id": customer_id, "user_id": user_id})
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        # Only keep valid fields
        allowed_fields = [
            "name", "company_name", "address", "postal_code",
            "city", "country", "email", "phone", "tax_id", "notes"
        ]
        clean_data = {k: v for k, v in customer_data.items() if k in allowed_fields}

        result = await supabase.update("customers", clean_data, {"id": customer_id, "user_id": user_id})
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Customers] Error updating customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update customer: {str(e)}"
        )


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(get_current_user)):
    """Permanently delete a customer from the database."""
    try:
        user_id = user["sub"]
        rows = await supabase.select("customers", columns="id", filters={"id": customer_id, "user_id": user_id})
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        await supabase.delete("customers", {"id": customer_id, "user_id": user_id})
        return {"message": "Customer permanently deleted", "id": customer_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Customers] Error deleting customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete customer: {str(e)}"
        )
