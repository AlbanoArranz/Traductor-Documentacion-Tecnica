"""
Entry point for PyInstaller packaging.
This script runs the FastAPI app with uvicorn.
"""

import os
import sys

# Ensure the app package is importable
if getattr(sys, 'frozen', False):
    # Running as compiled
    base_path = sys._MEIPASS
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, base_path)

import uvicorn
from app.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting backend on port {port}...")
    uvicorn.run(app, host="127.0.0.1", port=port)
