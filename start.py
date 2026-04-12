#!/usr/bin/env python3
"""
start.py — Initialize DB and launch AttendEase server.
Usage:  python start.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db, engine
from sqlalchemy import text

print("🗄️  Initializing database...")
init_db()  # Creates any missing tables
print("✅  Tables ready.")

# ── Auto-migrate missing columns ──────────────────────────────────────────────
# Safe to run every startup — IF NOT EXISTS prevents errors on repeat runs
print("🔧  Running migrations...")

migrations = [
    # professors table — login coordinates for geofencing
    "ALTER TABLE professors ADD COLUMN IF NOT EXISTS login_lat FLOAT",
    "ALTER TABLE professors ADD COLUMN IF NOT EXISTS login_lon FLOAT",
]

with engine.connect() as conn:
    for sql in migrations:
        try:
            conn.execute(text(sql))
            print(f"   ✅ {sql[:60]}…")
        except Exception as e:
            print(f"   ℹ️  Skipped (already exists): {sql[:50]}")
    conn.commit()

print("✅  Migrations complete.")

# ── Check routers ─────────────────────────────────────────────────────────────
print("🔍  Checking routers...")

try:
    from routers import auth, attendance, sessions, students, stats, geofence
    print("✅  Core routers loaded.")
except Exception as e:
    print(f"❌  Core router failed: {e}")
    sys.exit(1)

# ── Start server ──────────────────────────────────────────────────────────────
print("🚀  Starting AttendEase...")

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"   Listening on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port)
