"""
Customer API routes for address book management
"""
from fastapi import APIRouter, HTTPException, status, Query, Depends
from typing import Optional
from .supabase_client import supabase
from .auth_middleware import get_current_user

router = APIRouter(prefix="/api/customers")


@router.get("")
async def list_customers(q: Optional[str] = Query(None, description="Search query"), user: dict = Depends(get_current_user)):
    """
    List all customers for the current user, optionally filtered by search query.
    Search matches against name and company_name.
    """
    try:
        user_id = user["sub"]
        if q and q.strip():
            results = await supabase.select_or(
                "customers",
                f"(name.ilike.*{q.strip()}*,company_name.ilike.*{q.strip()}*)",
                order_by=("name", False),
                filters={"user_id": user_id}
            )
            return results
        else:
            return await supabase.select(
                "customers",
                filters={"user_id": user_id},
                order_by=("name", False)
            )
    except Exception as e:
        print(f"[Customers] Error listing customers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list customers: {str(e)}"
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
    """Delete a customer for the current user."""
    try:
        user_id = user["sub"]
        rows = await supabase.select("customers", columns="id", filters={"id": customer_id, "user_id": user_id})
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        await supabase.delete("customers", {"id": customer_id, "user_id": user_id})
        return {"message": "Customer deleted", "id": customer_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Customers] Error deleting customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete customer: {str(e)}"
        )
