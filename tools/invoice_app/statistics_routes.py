"""
Statistics API routes for dashboard
"""
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta
from .models import DashboardStatistics, TemplateStatistics, TemplateResponse
from .supabase_client import supabase
from .auth_middleware import get_current_user

router = APIRouter(prefix="/api/statistics")

@router.get("/overview", response_model=DashboardStatistics)
async def get_dashboard_overview(user: dict = Depends(get_current_user)):
    """
    Get comprehensive dashboard statistics for the current user
    """
    try:
        user_id = user["sub"]
        templates = await supabase.select("templates", filters={"user_id": user_id})
        usage_logs = await supabase.select("usage_logs", filters={"user_id": user_id})

        total_templates = len(templates)
        total_generations = len(usage_logs)

        month_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
        recent = [t for t in templates if t.get("created_at", "") >= month_ago]
        templates_created_this_month = len(recent)

        free_count = sum(1 for t in templates if t.get("payment_status", "free") == "free")
        paid_count = total_templates - free_count

        sorted_templates = sorted(
            templates, key=lambda x: x.get("created_at", ""), reverse=True
        )
        recent_5 = sorted_templates[:5]

        usage_by_template = {}
        for log in usage_logs:
            tid = log.get("template_id")
            if tid:
                usage_by_template[tid] = usage_by_template.get(tid, 0) + 1

        top_5 = sorted(
            usage_by_template.items(), key=lambda x: x[1], reverse=True
        )[:5]

        most_used = []
        for template_id, count in top_5:
            t = next((t for t in templates if t["id"] == template_id), None)
            if t:
                most_used.append({
                    "id": t["id"],
                    "name": t["name"],
                    "payment_status": t.get("payment_status", "free"),
                    "created_at": t["created_at"],
                    "usage_count": count,
                    "last_used": None,
                    "total_size_bytes": 0,
                })

        return DashboardStatistics(
            total_templates=total_templates,
            total_generations=total_generations,
            templates_created_this_month=templates_created_this_month,
            free_templates=free_count,
            paid_templates=paid_count,
            recent_templates=recent_5,
            most_used_templates=most_used,
        )

    except Exception as e:
        print(f"[Statistics] Error fetching dashboard overview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statistics: {str(e)}"
        )


@router.get("/dashboard")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    """
    Enhanced dashboard stats with document and revenue data for the current user.
    """
    try:
        user_id = user["sub"]
        # Fetch all data for the current user
        templates = await supabase.select("templates", filters={"user_id": user_id})
        usage_logs = await supabase.select("usage_logs", filters={"user_id": user_id})

        # Try fetching documents and customers (tables may not exist yet)
        try:
            documents = await supabase.select("documents", filters={"user_id": user_id})
        except Exception:
            documents = []

        try:
            customers = await supabase.select("customers", filters={"user_id": user_id})
        except Exception:
            customers = []

        # -- Template stats --
        total_templates = len(templates)
        total_generations = len(usage_logs)

        # -- Document stats --
        invoices = [d for d in documents if d.get("document_type") == "invoice"]
        quotes = [d for d in documents if d.get("document_type") == "quote"]

        total_invoices = len(invoices)
        total_quotes = len(quotes)
        total_customers = len(customers)

        # Revenue this month (paid invoices in current calendar month)
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        revenue_this_month = sum(
            float(d.get("total_amount", 0))
            for d in invoices
            if d.get("status") == "paid" and d.get("date", "") >= month_start
        )

        # Outstanding amount (sent + overdue invoices)
        outstanding_amount = sum(
            float(d.get("total_amount", 0))
            for d in invoices
            if d.get("status") in ("sent", "overdue")
        )

        # Recent 5 documents (sorted by date/created_at descending)
        sorted_docs = sorted(
            documents,
            key=lambda x: x.get("date", x.get("created_at", "")),
            reverse=True,
        )
        recent_documents = sorted_docs[:5]

        # Most used templates
        usage_by_template = {}
        for log in usage_logs:
            tid = log.get("template_id")
            if tid:
                usage_by_template[tid] = usage_by_template.get(tid, 0) + 1

        top_5 = sorted(
            usage_by_template.items(), key=lambda x: x[1], reverse=True
        )[:5]

        most_used_templates = []
        for template_id, count in top_5:
            t = next((t for t in templates if t["id"] == template_id), None)
            if t:
                most_used_templates.append({
                    "id": t["id"],
                    "name": t["name"],
                    "usage_count": count,
                })

        return {
            "total_templates": total_templates,
            "total_generations": total_generations,
            "total_invoices": total_invoices,
            "total_quotes": total_quotes,
            "total_customers": total_customers,
            "revenue_this_month": round(revenue_this_month, 2),
            "outstanding_amount": round(outstanding_amount, 2),
            "recent_documents": recent_documents,
            "most_used_templates": most_used_templates,
        }

    except Exception as e:
        print(f"[Statistics] Error fetching dashboard stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dashboard stats: {str(e)}"
        )

@router.get("/usage/{template_id}")
async def get_template_usage(template_id: str, user: dict = Depends(get_current_user)):
    """
    Get usage history for a specific template for the current user
    """
    try:
        user_id = user["sub"]
        logs = await supabase.select(
            "usage_logs",
            filters={"template_id": template_id, "user_id": user_id},
            order_by=("generated_at", False)  # Descending
        )

        return {
            "template_id": template_id,
            "usage_count": len(logs),
            "usage_logs": logs
        }
    except Exception as e:
        print(f"[Statistics] Error fetching template usage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch usage logs: {str(e)}"
        )
