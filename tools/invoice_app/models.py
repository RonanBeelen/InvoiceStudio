"""
Pydantic models for request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID

class TemplateCreate(BaseModel):
    """Model for creating a new template"""
    name: str = Field(..., min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, max_length=1000, description="Template description")
    template_json: Dict[str, Any] = Field(..., description="pdfme template JSON with basePdf and schemas")

class TemplateUpdate(BaseModel):
    """Model for updating an existing template"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    template_json: Optional[Dict[str, Any]] = None

class TemplateResponse(BaseModel):
    """Model for template responses"""
    id: UUID
    name: str
    description: Optional[str]
    template_json: Dict[str, Any]
    thumbnail_base64: Optional[str] = None  # NEW: Template preview thumbnail
    payment_status: str = "free"             # NEW: Payment status (free, paid, premium)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PDFGenerateRequest(BaseModel):
    """Model for PDF generation request"""
    template_id: UUID = Field(..., description="Template ID to use for generation")
    input_data: Dict[str, Any] = Field(..., description="Input data to fill template fields")
    filename: Optional[str] = Field(None, description="Optional custom filename (without extension)")

class PDFGenerateResponse(BaseModel):
    """Model for PDF generation response"""
    pdf_url: str = Field(..., description="Public URL to download the generated PDF")
    storage_path: str = Field(..., description="Storage path in Supabase")
    template_id: UUID
    timestamp: str = Field(..., description="Generation timestamp in ISO format")

class HealthResponse(BaseModel):
    """Model for health check response"""
    status: str
    message: str
    supabase_connected: bool
    node_service_connected: bool

class TemplateStatistics(BaseModel):
    """Template with usage statistics"""
    id: UUID
    name: str
    payment_status: str
    created_at: datetime
    usage_count: int
    last_used: Optional[datetime]
    total_size_bytes: int

class DashboardStatistics(BaseModel):
    """Dashboard overview statistics"""
    total_templates: int
    total_generations: int
    templates_created_this_month: int
    free_templates: int
    paid_templates: int
    recent_templates: List[TemplateResponse]
    most_used_templates: List[TemplateStatistics]


# ==================== Price Items ====================

class PriceItemCreate(BaseModel):
    """Model for creating a price item"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    category: str = Field("general", description="product, service, hourly_rate, travel, subscription, general")
    unit_price: float = Field(..., ge=0)
    unit: str = Field("stuk", description="stuk, uur, km, maand, dag")
    btw_percentage: float = Field(21.0, ge=0, le=100)
    default_quantity: float = Field(1.0, ge=0)
    sku: Optional[str] = Field(None, max_length=100)

class PriceItemUpdate(BaseModel):
    """Model for updating a price item"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    unit_price: Optional[float] = None
    unit: Optional[str] = None
    btw_percentage: Optional[float] = None
    default_quantity: Optional[float] = None
    sku: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None

class PriceItemResponse(BaseModel):
    """Model for price item responses"""
    id: UUID
    name: str
    description: Optional[str]
    category: str
    unit_price: float
    unit: str
    btw_percentage: float
    default_quantity: float
    sku: Optional[str]
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== Activity Log ====================

class ActivityLogEntry(BaseModel):
    """Model for activity log entries"""
    id: UUID
    user_id: UUID
    document_id: Optional[UUID]
    entity_type: str
    entity_id: Optional[UUID]
    action: str
    detail: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True
