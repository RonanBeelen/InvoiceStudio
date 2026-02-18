"""
Main FastAPI application for Invoice/Quote PDF Builder
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import requests

from .routes import router
from .statistics_routes import router as statistics_router
from .settings_routes import router as settings_router
from .customer_routes import router as customer_router
from .document_routes import router as document_router
from .ai_template_routes import router as ai_router
from .models import HealthResponse
from .supabase_client import supabase

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Invoice/Quote PDF Builder API",
    description="API for creating and managing invoice/quote templates and generating PDFs",
    version="1.0.0"
)

# CORS middleware - allow frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)
app.include_router(statistics_router)
app.include_router(settings_router)
app.include_router(customer_router)
app.include_router(document_router)
app.include_router(ai_router)

# Get environment variables
NODE_SERVICE_HOST = os.getenv("NODE_SERVICE_HOST", "localhost")
NODE_SERVICE_PORT = os.getenv("NODE_SERVICE_PORT", "3001")
NODE_SERVICE_URL = f"http://{NODE_SERVICE_HOST}:{NODE_SERVICE_PORT}"

@app.get("/")
async def root():
    """Root endpoint - redirect to frontend"""
    return FileResponse("frontend/index.html")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    supabase_connected = False
    node_service_connected = False

    # Check Supabase connection
    try:
        await supabase.select("templates", columns="id")
        supabase_connected = True
    except Exception as e:
        print(f"Supabase connection failed: {e}")

    # Check Node.js service connection
    try:
        response = requests.get(f"{NODE_SERVICE_URL}/health", timeout=2)
        node_service_connected = response.status_code == 200
    except Exception as e:
        print(f"Node.js service connection failed: {e}")

    overall_status = "healthy" if (supabase_connected and node_service_connected) else "degraded"

    return HealthResponse(
        status=overall_status,
        message="Service is running",
        supabase_connected=supabase_connected,
        node_service_connected=node_service_connected
    )

# Get frontend path
frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend")

# Mount JS and CSS directories
if os.path.exists(frontend_path):
    js_path = os.path.join(frontend_path, "js")
    css_path = os.path.join(frontend_path, "css")

    if os.path.exists(js_path):
        app.mount("/js", StaticFiles(directory=js_path), name="js")
    if os.path.exists(css_path):
        app.mount("/css", StaticFiles(directory=css_path), name="css")

    png_path = os.path.join(frontend_path, "PNG")
    if os.path.exists(png_path):
        app.mount("/PNG", StaticFiles(directory=png_path), name="png")

    templates_path = os.path.join(frontend_path, "templates")
    if os.path.exists(templates_path):
        app.mount("/templates", StaticFiles(directory=templates_path), name="templates")

# Serve frontend HTML pages
@app.get("/designer")
async def serve_designer():
    """Serve the template designer page"""
    file_path = os.path.join(frontend_path, "designer.html")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Designer page not found")

@app.get("/generator")
async def serve_generator():
    """Serve the PDF generator page"""
    file_path = os.path.join(frontend_path, "generator.html")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Generator page not found")

@app.get("/library")
async def serve_library():
    """Serve the template library page"""
    file_path = os.path.join(frontend_path, "library.html")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Library page not found")

@app.get("/login")
async def serve_login():
    """Serve the login page"""
    file_path = os.path.join(frontend_path, "login.html")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Login page not found")

@app.get("/dashboard")
async def serve_dashboard():
    """Serve the dashboard SPA"""
    file_path = os.path.join(frontend_path, "dashboard.html")
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Dashboard page not found")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
