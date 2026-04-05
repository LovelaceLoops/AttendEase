"""routers/stats.py — Aggregate class stats for professors"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from database import get_db, Student, Professor, AttendanceRecord

router = APIRouter()


@router.get("/stats/class")
def class_stats(professor_id: str, subject: str = "all", db: DBSession = Depends(get_db)):
    prof = db.query(Professor).filter(Professor.id == professor_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professor not found.")

    prof_subjects = set(prof.subjects or [])
    all_students  = db.query(Student).all()

    relevant = [s for s in all_students if prof_subjects & set(s.subjects or [])]
    total_students = len(relevant)

    if total_students == 0:
        return {
            "avg_present": 0,
            "avg_absent":  0,
            "avg_late":    0,
            "total_students": 0
        }

    total_p = total_a = total_l = 0

    for s in relevant:
        query = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == s.id)
        if subject != "all":
            query = query.filter(AttendanceRecord.subject == subject)
        records = query.all()

        total_p += sum(1 for r in records if r.status == "present")
        total_a += sum(1 for r in records if r.status == "absent")
        total_l += sum(1 for r in records if r.status == "late")

    return {
        "avg_present":    round(total_p / total_students, 1),
        "avg_absent":     round(total_a / total_students, 1),
        "avg_late":       round(total_l / total_students, 1),
        "total_students": total_students
    }
