#!/usr/bin/env python3
"""
start.py — Initialize DB and launch AttendEase server.
Usage:  python start.py
"""

#!/usr/bin/env python3
import sys, os

sys.path.insert(0, os.path.dirname(__file__))

from database import init_db
print("🗄️  Initializing database...")
init_db()
print("✅  Database ready.")

print("🚀  Starting AttendEase...")

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)


