"""routers/sessions.py - Attendance Session Management"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

from database import get_db, AttendanceSession, AttendanceRecord, Professor, Student

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


def utcnow():
    return datetime.now(timezone.utc)


def make_aware(dt):
    if dt is None:
        return utcnow()
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def mark_absentees(session_id: str, subject: str, db: DBSession):
    all_students = db.query(Student).all()
    enrolled = [s for s in all_students if subject in (s.subjects or [])]
    attended_ids = set(
        r.student_id for r in db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id
        ).all()
    )
    for student in enrolled:
        if student.id not in attended_ids:
            record = AttendanceRecord(
                id         = str(uuid.uuid4()),
                student_id = student.id,
                session_id = session_id,
                subject    = subject,
                status     = "absent",
                device_id  = None
            )
            db.add(record)
    db.commit()


@router.post("/session/start")
def start_session(data: StartSessionRequest, db: DBSession = Depends(get_db)):
    duration = min(data.duration_minutes, 10)

    prof = db.query(Professor).filter(Professor.id == data.professor_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professor not found.")

    prev_sessions = db.query(AttendanceSession).filter(
        AttendanceSession.professor_id == data.professor_id,
        AttendanceSession.is_active == True
    ).all()

    for prev in prev_sessions:
        prev.is_active = False
        prev.ended_at  = utcnow()
        db.commit()
        mark_absentees(prev.id, prev.subject, db)

    session = AttendanceSession(
        id               = str(uuid.uuid4()),
        professor_id     = data.professor_id,
        subject          = data.subject,
        start_time       = data.start_time,
        end_time         = data.end_time,
        duration_minutes = duration,
        is_active        = True,
        started_at       = utcnow()
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
    sess.ended_at  = utcnow()
    db.commit()
    mark_absentees(session_id, sess.subject, db)
    return {"message": "Session stopped."}


@router.get("/session/active")
def get_active_session(db: DBSession = Depends(get_db)):
    sess = db.query(AttendanceSession).filter(AttendanceSession.is_active == True).first()
    if not sess:
        return {"active": False}

    elapsed = (utcnow() - make_aware(sess.started_at)).total_seconds()
    window  = sess.duration_minutes * 60

    if elapsed >= window:
        sess.is_active = False
        sess.ended_at  = utcnow()
        db.commit()
        mark_absentees(sess.id, sess.subject, db)
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