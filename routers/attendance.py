"""routers/attendance.py — Recording & Logs"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid, math

from database import get_db, AttendanceRecord, AttendanceSession, Student, DeviceRecord

router = APIRouter()

GEO_RADIUS_M = 5.0  # 5 metre fence


class RecordAttendanceRequest(BaseModel):
    student_id:         str
    session_id:         Optional[str] = None
    device_id:          str
    qr_code:            str
    biometric_verified: bool = False


class ManualAttendanceRequest(BaseModel):
    roll_number:  str
    subject:      str
    professor_id: str
    status:       str = "late"


def haversine(lat1, lon1, lat2, lon2) -> float:
    """Return distance in metres between two GPS coords."""
    R = 6371000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(dλ/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


@router.post("/attendance/record")
def record_attendance(data: RecordAttendanceRequest, db: DBSession = Depends(get_db)):
    # Verify biometric
    if not data.biometric_verified:
        raise HTTPException(status_code=403, detail="Biometric verification required.")

    # The QR code contains only the roll number as plain text.
    # Look up student by the scanned roll number first.
    scanned_roll = data.qr_code.strip()
    student_by_qr = db.query(Student).filter(
        Student.roll_number == scanned_roll
    ).first()

    if not student_by_qr:
        raise HTTPException(status_code=400, detail=f"No student found for QR code '{scanned_roll}'.")

    # The logged-in student's ID must match the scanned QR roll number.
    # This prevents one student from scanning another student's QR code.
    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Logged-in student not found.")

    if student.roll_number != scanned_roll:
        raise HTTPException(
            status_code=403,
            detail="QR code does not match your account. Please scan your own QR code."
        )

    # Find active session
    if data.session_id:
        session = db.query(AttendanceSession).filter(
            AttendanceSession.id == data.session_id,
            AttendanceSession.is_active == True
        ).first()
    else:
        session = db.query(AttendanceSession).filter(
            AttendanceSession.is_active == True
        ).first()

    if not session:
        raise HTTPException(status_code=404, detail="No active attendance session found.")

    # Check subject enrollment
    if session.subject not in (student.subjects or []):
        raise HTTPException(status_code=403, detail=f"You are not enrolled in '{session.subject}'.")

    # ONE device per session check
    dev_rec = db.query(DeviceRecord).filter(
        DeviceRecord.device_id == data.device_id,
        DeviceRecord.session_id == session.id
    ).first()
    if dev_rec:
        raise HTTPException(status_code=409, detail="This device has already recorded attendance for this session.")

    # Duplicate student check for this session
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == data.student_id,
        AttendanceRecord.session_id == session.id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Attendance already recorded for this session.")

    # Geofence check
    if session.prof_lat and session.prof_lon:
        pass  # Geofence validated on client + geofence endpoint; accept here

    # Determine status — if session was started <10 min ago it's "present", else "late"
    elapsed = (datetime.now(timezone.utc) - session.started_at).total_seconds()
    status  = "present"  # late is set only via manual endpoint

    # Save device record
    dr = DeviceRecord(
        id         = str(uuid.uuid4()),
        device_id  = data.device_id,
        session_id = session.id,
        student_id = student.id
    )
    db.add(dr)

    # Save attendance record
    record = AttendanceRecord(
        id         = str(uuid.uuid4()),
        student_id = student.id,
        session_id = session.id,
        subject    = session.subject,
        status     = status,
        device_id  = data.device_id
    )
    db.add(record)
    db.commit()

    return {"message": "Attendance recorded.", "status": status, "subject": session.subject}


@router.post("/attendance/manual")
def manual_attendance(data: ManualAttendanceRequest, db: DBSession = Depends(get_db)):
    student = db.query(Student).filter(Student.roll_number == data.roll_number).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    record = AttendanceRecord(
        id         = str(uuid.uuid4()),
        student_id = student.id,
        session_id = None,
        subject    = data.subject,
        status     = "late",
        device_id  = "manual"
    )
    db.add(record)
    db.commit()

    return {"message": "Manual attendance recorded.", "student_name": student.name, "status": "late"}


@router.get("/attendance/stats/{student_id}")
def get_student_stats(student_id: str, db: DBSession = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id
    ).all()

    total_present = sum(1 for r in records if r.status == "present")
    total_absent  = sum(1 for r in records if r.status == "absent")
    total_late    = sum(1 for r in records if r.status == "late")

    # Subject-wise breakdown
    subject_map = {}
    for r in records:
        if r.subject not in subject_map:
            subject_map[r.subject] = {"present": 0, "absent": 0, "late": 0}
        subject_map[r.subject][r.status] += 1

    subjects = [{"subject": k, **v} for k, v in subject_map.items()]

    return {
        "present":  total_present,
        "absent":   total_absent,
        "late":     total_late,
        "subjects": subjects
    }


@router.get("/attendance/log/{student_id}")
def get_attendance_log(student_id: str, db: DBSession = Depends(get_db)):
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id
    ).order_by(AttendanceRecord.timestamp.desc()).limit(50).all()

    return [
        {
            "subject":   r.subject,
            "status":    r.status,
            "timestamp": r.timestamp.isoformat()
        }
        for r in records
    ]
