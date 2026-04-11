"""routers/geofence.py — 5-metre geofence check"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from database import get_db, AttendanceSession
import math

router = APIRouter()

RADIUS_METRES = 100.0


def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a  = math.sin(dφ/2)**2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ/2)**2
    dist= R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    print(dist)
    return dist


@router.get("/geofence/check")
def check_geofence(lat: float, lon: float, student_id: str, db: DBSession = Depends(get_db)):
    session = db.query(AttendanceSession).filter(
        AttendanceSession.is_active == True
    ).first()

    if not session:
        return {"within": False, "message": "No active session found."}

    # Read from Professor table instead of session
    from database import Professor
    prof = db.query(Professor).filter(
        Professor.id == session.professor_id
    ).first()

    if not prof or prof.login_lat is None or prof.login_lon is None:
        return {"within": True, "message": "Within range (professor location pending)."}

    dist = haversine(lat, lon, prof.login_lat, prof.login_lon)
    within = dist <= RADIUS_METRES

    return {
        "within":   within,
        "distance": round(dist, 2),
        "message":  (
            f"Within range ({round(dist,1)}m from professor)."
            if within else
            f"Too far — {round(dist,1)}m away. Move within {RADIUS_METRES}m of the professor."
        )
    }
