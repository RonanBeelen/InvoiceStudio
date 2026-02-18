#!/usr/bin/env python3
"""
Launch script for Invoice/Quote PDF Builder application
Starts both the FastAPI backend and Node.js PDF service
"""

import os
import sys
import subprocess
import time
import signal
import requests
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path to import invoice_app
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
load_dotenv()

# Configuration
BACKEND_HOST = os.getenv("BACKEND_HOST", "0.0.0.0")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", 8000))
NODE_SERVICE_HOST = os.getenv("NODE_SERVICE_HOST", "localhost")
NODE_SERVICE_PORT = int(os.getenv("NODE_SERVICE_PORT", 3001))

# Process references
node_process = None
fastapi_process = None

def check_service_health(url, service_name, max_retries=10, retry_delay=1):
    """Check if a service is healthy"""
    print(f"[Launcher] Waiting for {service_name} to be ready...")

    for i in range(max_retries):
        try:
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                print(f"[Launcher] OK: {service_name} is ready!")
                return True
        except requests.exceptions.RequestException:
            pass

        if i < max_retries - 1:
            print(f"[Launcher] Waiting... ({i+1}/{max_retries})")
            time.sleep(retry_delay)

    print(f"[Launcher] ERROR: {service_name} failed to start")
    return False

def start_node_service():
    """Start the Node.js PDF generation service"""
    global node_process

    print(f"\n{'='*60}")
    print("Starting Node.js PDF Generation Service")
    print(f"{'='*60}")

    # Check if node is installed
    try:
        subprocess.run(["node", "--version"], check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("[Launcher] ERROR: Node.js is not installed!")
        print("[Launcher] Please install Node.js from https://nodejs.org/")
        sys.exit(1)

    # Check if node_modules exist
    node_modules_path = Path(__file__).parent.parent / "node_modules"
    if not node_modules_path.exists():
        print("[Launcher] Node modules not found. Installing dependencies...")
        try:
            subprocess.run(
                ["npm", "install"],
                cwd=str(Path(__file__).parent.parent),
                check=True
            )
        except subprocess.CalledProcessError as e:
            print(f"[Launcher] ERROR: Failed to install Node.js dependencies: {e}")
            sys.exit(1)

    # Start Node.js service
    node_service_path = Path(__file__).parent / "node_service" / "start_service.js"

    try:
        node_process = subprocess.Popen(
            ["node", str(node_service_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )

        # Wait for service to be ready
        if not check_service_health(
            f"http://{NODE_SERVICE_HOST}:{NODE_SERVICE_PORT}/health",
            "Node.js PDF Service"
        ):
            print("[Launcher] ERROR: Node.js service failed to start properly")
            if node_process:
                node_process.terminate()
            sys.exit(1)

        return node_process

    except Exception as e:
        print(f"[Launcher] ERROR starting Node.js service: {e}")
        sys.exit(1)

def start_fastapi():
    """Start the FastAPI backend"""
    print(f"\n{'='*60}")
    print("Starting FastAPI Backend")
    print(f"{'='*60}")

    # Check if Python dependencies are installed
    try:
        import fastapi
        import uvicorn
    except ImportError as e:
        print(f"[Launcher] ERROR: Missing Python dependency: {e}")
        print("[Launcher] Please run: pip install -r requirements.txt")
        sys.exit(1)

    # Import and run FastAPI app
    try:
        from invoice_app.app import app
        import uvicorn

        print(f"[Launcher] Starting FastAPI on http://{BACKEND_HOST}:{BACKEND_PORT}")
        print(f"[Launcher] Press CTRL+C to stop all services\n")

        uvicorn.run(
            app,
            host=BACKEND_HOST,
            port=BACKEND_PORT,
            log_level="info"
        )

    except Exception as e:
        print(f"[Launcher] ERROR starting FastAPI: {e}")
        raise

def cleanup(signum=None, frame=None):
    """Cleanup processes on exit"""
    print("\n[Launcher] Shutting down services...")

    if node_process:
        print("[Launcher] Stopping Node.js service...")
        node_process.terminate()
        try:
            node_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            node_process.kill()

    print("[Launcher] All services stopped. Goodbye!")
    sys.exit(0)

def main():
    """Main entry point"""
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("""
    ==============================================================
       Invoice/Quote PDF Builder - Application Launcher
    ==============================================================
    """)

    # Check if .env file exists
    if not Path(".env").exists():
        print("[Launcher] WARNING: .env file not found!")
        print("[Launcher] Copy .env.example to .env and configure your Supabase credentials")
        print("[Launcher] Continuing with example values (may not work)...\n")
        time.sleep(2)

    try:
        # Start Node.js service first
        start_node_service()

        # Start FastAPI (this will block until CTRL+C)
        start_fastapi()

    except KeyboardInterrupt:
        cleanup()
    except Exception as e:
        print(f"\n[Launcher] FATAL ERROR: {e}")
        cleanup()
        sys.exit(1)

if __name__ == "__main__":
    main()
