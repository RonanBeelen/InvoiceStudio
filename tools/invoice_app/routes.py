"""
API routes for template management and PDF generation
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from uuid import UUID
from datetime import datetime

from .models import (
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
    PDFGenerateRequest,
    PDFGenerateResponse
)
from .supabase_client import supabase, SUPABASE_STORAGE_BUCKET
from .auth_middleware import get_current_user

router = APIRouter(prefix="/api")

@router.get("/templates", response_model=List[TemplateResponse])
async def list_templates(user: dict = Depends(get_current_user)):
    """List all templates for the current user"""
    try:
        user_id = user["sub"]
        templates = await supabase.select("templates", filters={"user_id": user_id}, order_by=("created_at", True))
        return templates
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch templates: {str(e)}"
        )

@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: UUID, user: dict = Depends(get_current_user)):
    """Get a specific template by ID for the current user"""
    try:
        user_id = user["sub"]
        templates = await supabase.select("templates", filters={"id": str(template_id), "user_id": user_id})

        if not templates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )

        return templates[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch template: {str(e)}"
        )

@router.post("/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(template: TemplateCreate, user: dict = Depends(get_current_user)):
    """Create a new template for the current user"""
    try:
        user_id = user["sub"]

        # Validate that template_json has required structure
        if "schemas" not in template.template_json:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="template_json must contain 'schemas' field"
            )

        # Insert into Supabase
        result = await supabase.insert("templates", {
            "name": template.name,
            "description": template.description,
            "template_json": template.template_json,
            "user_id": user_id
        })

        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create template"
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create template: {str(e)}"
        )

@router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: UUID, template: TemplateUpdate, user: dict = Depends(get_current_user)):
    """Update an existing template for the current user"""
    try:
        user_id = user["sub"]

        # Build update dict with only provided fields
        update_data = {k: v for k, v in template.dict(exclude_unset=True).items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        # Add updated_at timestamp
        update_data["updated_at"] = datetime.utcnow().isoformat()

        # Clear cached thumbnail when template content changes
        if "template_json" in update_data:
            update_data["thumbnail_base64"] = None

        result = await supabase.update("templates", update_data, filters={"id": str(template_id), "user_id": user_id})

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update template: {str(e)}"
        )

@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: UUID, user: dict = Depends(get_current_user)):
    """Delete a template for the current user"""
    try:
        user_id = user["sub"]
        result = await supabase.delete("templates", filters={"id": str(template_id), "user_id": user_id})

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )

        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete template: {str(e)}"
        )

@router.get("/templates/{template_id}/preview")
async def preview_template(template_id: UUID, user: dict = Depends(get_current_user)):
    """Generate a PDF preview for a template using placeholder data"""
    import httpx
    from .pdf_generator import NODE_SERVICE_URL

    try:
        user_id = user["sub"]
        # Fetch template from database
        templates = await supabase.select("templates", filters={"id": str(template_id), "user_id": user_id})

        if not templates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )

        template = templates[0]
        template_json = template["template_json"]

        # Deep copy template and set all fields to readOnly for preview
        # pdfme only renders content for readOnly fields; editable fields show as empty
        import copy
        preview_template = copy.deepcopy(template_json)
        placeholder_inputs = {}
        schemas = preview_template.get("schemas", [])
        if schemas and len(schemas) > 0:
            page_schema = schemas[0]
            if isinstance(page_schema, dict):
                for field_name, field_def in page_schema.items():
                    if isinstance(field_def, dict):
                        field_type = field_def.get("type", "text")
                        content = (field_def.get("content", "") or "").strip()
                        field_def["readOnly"] = True
                        if field_type in ("text", "multiVariableText"):
                            if not content:
                                field_def["content"] = field_name
                            placeholder_inputs[field_name] = field_def["content"]
                        else:
                            if not content:
                                field_def["content"] = field_name
                            placeholder_inputs[field_name] = field_def["content"]
                    else:
                        placeholder_inputs[field_name] = field_name

        # Use the existing /generate endpoint which already works
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{NODE_SERVICE_URL}/generate",
                json={
                    "template": preview_template,
                    "inputs": [placeholder_inputs]
                },
                headers={"Content-Type": "application/json"}
            )

        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Preview generation failed: {error_data.get('message', 'Unknown error')}"
            )

        return response.json()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate preview: {str(e)}"
        )

@router.post("/preview")
async def preview_template_json(body: dict, user: dict = Depends(get_current_user)):
    """Generate a PDF preview from raw template JSON (no database lookup)"""
    import httpx
    from .pdf_generator import NODE_SERVICE_URL

    template_json = body.get("template")
    if not template_json:
        raise HTTPException(status_code=400, detail="Missing 'template' in request body")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{NODE_SERVICE_URL}/preview",
                json={"template": template_json},
                headers={"Content-Type": "application/json"}
            )

        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(
                status_code=500,
                detail=f"Preview generation failed: {error_data.get('message', 'Unknown error')}"
            )

        return response.json()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")

@router.post("/generate-pdf", response_model=PDFGenerateResponse)
async def generate_pdf_endpoint(request: PDFGenerateRequest, user: dict = Depends(get_current_user)):
    """
    Generate a PDF from a template and input data

    Request body:
    {
        "template_id": "uuid-string",
        "input_data": {
            "field1": "value1",
            "field2": "value2",
            ...
        },
        "filename": "optional-custom-name"  // Optional
    }

    Returns:
    {
        "pdf_url": "https://...",
        "storage_path": "generated/...",
        "template_id": "uuid",
        "timestamp": "2025-01-15T10:30:00"
    }
    """
    from .pdf_generator import generate_pdf, PDFGenerationError

    try:
        user_id = user["sub"]
        # 1. Fetch template from database
        templates = await supabase.select("templates", filters={"id": str(request.template_id), "user_id": user_id})

        if not templates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {request.template_id} not found"
            )

        template = templates[0]
        template_json = template["template_json"]

        print(f"[API] Generating PDF from template: {template['name']}")

        # 2. Generate PDF using bridge
        result = await generate_pdf(
            template_json=template_json,
            input_data=request.input_data,
            filename=request.filename
        )

        # 3. Log usage to database
        try:
            await supabase.insert("usage_logs", {
                "template_id": str(request.template_id),
                "pdf_filename": result["storage_path"],
                "generation_time_ms": 0,  # Could track timing if needed
                "file_size_bytes": result.get("size", 0),
                "user_id": user_id
            })
            print(f"[API] Usage logged for template {request.template_id}")
        except Exception as log_error:
            # Don't fail PDF generation if logging fails
            print(f"[API] Warning: Failed to log usage: {log_error}")

        # 4. Return response
        return PDFGenerateResponse(
            pdf_url=result["pdf_url"],
            storage_path=result["storage_path"],
            template_id=request.template_id,
            timestamp=result["timestamp"]
        )

    except PDFGenerationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during PDF generation: {str(e)}"
        )
