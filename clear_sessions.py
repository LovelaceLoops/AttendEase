import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from database import init_db, SessionLocal, AttendanceSession
init_db()
db = SessionLocal()
db.query(AttendanceSession).delete()
db.commit()
db.close()
print("Cleared all sessions.")
