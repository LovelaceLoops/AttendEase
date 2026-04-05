#!/usr/bin/env python3
"""
start.py — Initialize DB and launch AttendEase server.
Usage:  python start.py
"""

import sys, os

# Ensure the app directory is on the path
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db
print("🗄️  Initializing database...")
init_db()
print("✅  Database ready.")


print("🚀  Starting AttendEase on http://0.0.0.0:8000")
print("🌐  Share this link after exposing with ngrok / Cloudflare Tunnel")

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


