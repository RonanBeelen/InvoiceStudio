"""
PDF Generator Bridge
Calls Node.js service to generate PDFs and handles Supabase Storage uploads
"""
import os
import httpx
import base64
from datetime import datetime
from typing import Dict, Any, Optional
from uuid import uuid4

# Get Node.js service configuration
NODE_SERVICE_HOST = os.getenv("NODE_SERVICE_HOST", "localhost")
NODE_SERVICE_PORT = os.getenv("NODE_SERVICE_PORT", "3001")
NODE_SERVICE_URL = f"http://{NODE_SERVICE_HOST}:{NODE_SERVICE_PORT}"

# Import Supabase client
from .supabase_client import supabase, SUPABASE_STORAGE_BUCKET


class PDFGenerationError(Exception):
    """Custom exception for PDF generation failures"""
    pass


async def generate_pdf(
    template_json: Dict[str, Any],
    input_data: Dict[str, Any],
    filename: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate a PDF from a template and input data

    Args:
        template_json: The pdfme template JSON (basePdf, schemas, etc.)
        input_data: Dictionary of field values to fill in the template
        filename: Optional custom filename (without extension)

    Returns:
        Dict with:
            - pdf_url: Public URL to download the PDF
            - storage_path: Path in Supabase Storage
            - size: PDF size in bytes
            - timestamp: Generation timestamp

    Raises:
        PDFGenerationError: If PDF generation or upload fails
    """
    try:
        # 1. Prepare request for Node.js service
        payload = {
            "template": template_json,
            "inputs": [input_data]  # pdfme expects array of inputs
        }

        print(f"[PDF Generator] Calling Node.js service at {NODE_SERVICE_URL}/generate")

        # 2. Call Node.js service to generate PDF
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{NODE_SERVICE_URL}/generate",
                json=payload,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code != 200:
                error_data = response.json()
                raise PDFGenerationError(
                    f"Node.js service error: {error_data.get('message', 'Unknown error')}"
                )

            result = response.json()

        # 3. Extract base64 PDF
        if not result.get("success") or not result.get("pdf"):
            raise PDFGenerationError("Invalid response from Node.js service")

        base64_pdf = result["pdf"]
        pdf_size = result.get("size", 0)

        print(f"[PDF Generator] PDF generated successfully ({pdf_size} bytes)")

        # 4. Decode base64 to binary
        pdf_bytes = base64.b64decode(base64_pdf)

        # 5. Generate storage path
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        random_id = str(uuid4())[:8]

        if filename:
            # Use custom filename
            storage_filename = f"{filename}_{timestamp}_{random_id}.pdf"
        else:
            # Default filename
            storage_filename = f"invoice_{timestamp}_{random_id}.pdf"

        storage_path = f"generated/{storage_filename}"

        print(f"[PDF Generator] Uploading to Supabase Storage: {storage_path}")

        # 6. Upload to Supabase Storage
        pdf_url = await upload_to_storage(pdf_bytes, storage_path)

        print(f"[PDF Generator] Upload successful: {pdf_url}")

        # 7. Return result
        return {
            "pdf_url": pdf_url,
            "storage_path": storage_path,
            "size": pdf_size,
            "timestamp": datetime.utcnow().isoformat()
        }

    except httpx.TimeoutException:
        raise PDFGenerationError("Timeout while calling Node.js service")
    except httpx.RequestError as e:
        raise PDFGenerationError(f"Network error: {str(e)}")
    except Exception as e:
        raise PDFGenerationError(f"PDF generation failed: {str(e)}")


async def upload_to_storage(pdf_bytes: bytes, storage_path: str) -> str:
    """
    Upload PDF to Supabase Storage

    Args:
        pdf_bytes: PDF file as bytes
        storage_path: Path in storage bucket (e.g., "generated/invoice_123.pdf")

    Returns:
        Public URL to access the PDF

    Raises:
        PDFGenerationError: If upload fails
    """
    try:
        # Use Supabase REST API to upload file
        async with httpx.AsyncClient() as client:
            upload_url = f"{supabase.url}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{storage_path}"

            response = await client.post(
                upload_url,
                headers={
                    "apikey": supabase.key,
                    "Authorization": f"Bearer {supabase.key}",
                    "Content-Type": "application/pdf"
                },
                content=pdf_bytes
            )

            if response.status_code not in (200, 201):
                error_msg = response.text
                raise PDFGenerationError(f"Storage upload failed: {error_msg}")

        # Construct public URL
        public_url = f"{supabase.url}/storage/v1/object/public/{SUPABASE_STORAGE_BUCKET}/{storage_path}"

        return public_url

    except httpx.RequestError as e:
        raise PDFGenerationError(f"Storage upload network error: {str(e)}")


async def delete_from_storage(storage_path: str) -> bool:
    """
    Delete a PDF from Supabase Storage

    Args:
        storage_path: Path in storage bucket

    Returns:
        True if deleted successfully

    Raises:
        PDFGenerationError: If deletion fails
    """
    try:
        async with httpx.AsyncClient() as client:
            delete_url = f"{supabase.url}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{storage_path}"

            response = await client.delete(
                delete_url,
                headers={
                    "apikey": supabase.key,
                    "Authorization": f"Bearer {supabase.key}"
                }
            )

            if response.status_code not in (200, 204):
                error_msg = response.text
                raise PDFGenerationError(f"Storage deletion failed: {error_msg}")

        return True

    except httpx.RequestError as e:
        raise PDFGenerationError(f"Storage deletion network error: {str(e)}")
