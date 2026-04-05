"""routers/students.py — Student listing for professors"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from database import get_db, Student, AttendanceRecord, Professor

router = APIRouter()


@router.get("/students")
def get_students(professor_id: str, db: DBSession = Depends(get_db)):
    """Return all students with their attendance stats, filtered by professor's subjects."""
    prof = db.query(Professor).filter(Professor.id == professor_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Professor not found.")

    prof_subjects = set(prof.subjects or [])

    # Get students who share at least one subject with the professor
    all_students = db.query(Student).all()
    result = []

    for s in all_students:
        student_subjects = set(s.subjects or [])
        shared = prof_subjects & student_subjects
        if not shared:
            continue

        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == s.id
        ).all()

        total_p = sum(1 for r in records if r.status == "present")
        total_a = sum(1 for r in records if r.status == "absent")
        total_l = sum(1 for r in records if r.status == "late")

        # Per-subject stats
        subject_map = {}
        for r in records:
            if r.subject not in subject_map:
                subject_map[r.subject] = {"present": 0, "absent": 0, "late": 0}
            subject_map[r.subject][r.status] += 1

        subject_stats = [{"subject": k, **v} for k, v in subject_map.items()]

        result.append({
            "id":           s.id,
            "name":         s.name,
            "department":   s.department,
            "roll_number":  s.roll_number,
            "subjects":     s.subjects,
            "present":      total_p,
            "absent":       total_a,
            "late":         total_l,
            "subject_stats": subject_stats
        })

    return result
