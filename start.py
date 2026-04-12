#!/usr/bin/env python3
"""
start.py — Initialize DB and launch AttendEase server.
Usage:  python start.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db
print("🗄️  Initializing database...")
init_db()
print("✅  Database ready.")

# Pre-check all routers load correctly before starting server
print("🔍  Checking routers...")
try:
    from routers import auth, attendance, sessions, students, stats, geofence
    print("✅  Core routers loaded.")
except Exception as e:
    print(f"❌  Core router failed: {e}")
    sys.exit(1)

try:
    from routers import webauthn_router
    print("✅  WebAuthn router loaded.")
except Exception as e:
    print(f"❌  WebAuthn router failed to load: {e}")
    print("    Make sure 'webauthn==2.1.0' is in requirements.txt and installed.")
    sys.exit(1)

print("🚀  Starting AttendEase...")

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"   Listening on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port)
