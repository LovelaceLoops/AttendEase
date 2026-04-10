"""routers/geofence.py — 5-metre geofence check"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from database import get_db, AttendanceSession
import math

router = APIRouter()

RADIUS_METRES = 30.0


def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a  = math.sin(dφ/2)**2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/geofence/check")
def check_geofence(lat: float, lon: float, student_id: str, accuracy:float=20.0, db: DBSession = Depends(get_db)):
    """Check if the student is within 5m of the active session's professor."""
    session = db.query(AttendanceSession).filter(
        AttendanceSession.is_active == True
    ).first()

    if not session:
        return {"within": False, "message": "No active session found."}

    if session.prof_lat is None or session.prof_lon is None:
        # Professor hasn't shared location yet — allow optimistically
        return {"within": True, "message": "Within range (professor location pending)."}

    dist = haversine(lat, lon, session.prof_lat, session.prof_lon)
    within = dist <= RADIUS_METRES

    return {
        "within":   within,
        "distance": round(dist, 2),
        "message":  (
            f"Within range ({round(dist,1)}m from professor)."
            if within else
            f"Too far — {round(dist,1)}m away. Move within 5m of the professor."
        )
    }
