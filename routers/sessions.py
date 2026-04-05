"""routers/sessions.py — Attendance Session Management"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import uuid

from database import get_db, AttendanceSession, Professor

router = APIRouter()


class StartSessionRequest(BaseModel):
    professor_id: str
    subject: str
    start_time: str
    end_time: str
    duration_minutes: int = 10


class LocationUpdate(BaseModel):
    session_id: str
    lat: float
    lon: float


@router.post("/session/start")
def start_session(data: StartSessionRequest, db: DBSession = Depends(get_db)):
    # Enforce max 10 minute window
    duration = min(data.duration_minutes, 10)

    prof = db.query(Professor).filter(Professor.id == data.professor_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professor not found.")

    # Deactivate previous sessions by this professor
    db.query(AttendanceSession).filter(
        AttendanceSession.professor_id == data.professor_id,
        AttendanceSession.is_active == True
    ).update({"is_active": False, "ended_at": datetime.utcnow()})

    session = AttendanceSession(
        id               = str(uuid.uuid4()),
        professor_id     = data.professor_id,
        subject          = data.subject,
        start_time       = data.start_time,
        end_time         = data.end_time,
        duration_minutes = duration,
        is_active        = True
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id":       session.id,
        "subject":          session.subject,
        "duration_minutes": duration,
        "message":          "Session started."
    }


@router.post("/session/stop/{session_id}")
def stop_session(session_id: str, db: DBSession = Depends(get_db)):
    sess = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    sess.is_active = False
    sess.ended_at  = datetime.utcnow()
    db.commit()
    return {"message": "Session stopped."}


@router.get("/session/active")
def get_active_session(db: DBSession = Depends(get_db)):
    sess = db.query(AttendanceSession).filter(AttendanceSession.is_active == True).first()
    if not sess:
        return {"active": False}

    # Auto-expire if past duration
    elapsed = (datetime.utcnow() - sess.started_at).total_seconds()
    window  = sess.duration_minutes * 60
    if elapsed >= window:
        sess.is_active = False
        sess.ended_at  = datetime.utcnow()
        db.commit()
        return {"active": False}

    return {
        "active":            True,
        "session_id":        sess.id,
        "subject":           sess.subject,
        "professor_id":      sess.professor_id,
        "remaining_seconds": int(window - elapsed),
        "prof_lat":          sess.prof_lat,
        "prof_lon":          sess.prof_lon
    }


@router.post("/session/location")
def update_location(data: LocationUpdate, db: DBSession = Depends(get_db)):
    sess = db.query(AttendanceSession).filter(
        AttendanceSession.id == data.session_id,
        AttendanceSession.is_active == True
    ).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found or inactive.")
    sess.prof_lat = data.lat
    sess.prof_lon = data.lon
    db.commit()
    return {"message": "Location updated."}
