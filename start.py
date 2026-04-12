import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db, SessionLocal, AttendanceSession
from datetime import datetime

print("Initializing database...")
init_db()

# Clear any corrupt sessions on startup
db = SessionLocal()
try:
    db.query(AttendanceSession).filter(
        AttendanceSession.started_at == None
    ).delete()
    db.commit()
    print("Cleaned up corrupt sessions.")
finally:
    db.close()

print("Database ready.")

import uvicorn
port = int(os.environ.get("PORT", 8000))
print(f"Starting on port {port}")
uvicorn.run("main:app", host="0.0.0.0", port=port)