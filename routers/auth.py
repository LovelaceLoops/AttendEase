"""routers/auth.py — Registration & Login"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from typing import List
import uuid, hashlib, re, io

from database import get_db, Student, Professor

router = APIRouter()

# ---- Password Rules ----
PW_PATTERN = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()\-_=+\[\]{};:\'",.<>?/\\|`~]).{8,}$')


def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def check_pw(pw: str, hashed: str) -> bool:
    return hash_pw(pw) == hashed

def make_qr(roll: str) -> str:
    # QR code simply stores the roll number — easy to scan and compare
    return roll


# ---- Schemas ----
class StudentRegister(BaseModel):
    name: str
    department: str
    roll_number: str
    subjects: List[str]
    password: str

    @validator('password')
    def pw_strength(cls, v):
        if not PW_PATTERN.match(v):
            raise ValueError("Password must be min 8 chars with uppercase, lowercase and special character.")
        return v

class ProfessorRegister(BaseModel):
    name: str
    department: str
    employee_id: str
    subjects: List[str]
    password: str

    @validator('password')
    def pw_strength(cls, v):
        if not PW_PATTERN.match(v):
            raise ValueError("Password must be min 8 chars with uppercase, lowercase and special character.")
        return v

class LoginRequest(BaseModel):
    identifier: str  # roll_number or employee_id
    password: str


# ---- ROUTES ----

@router.post("/register/student", status_code=201)
def register_student(data: StudentRegister, db: Session = Depends(get_db)):
    # Check duplicate roll
    existing = db.query(Student).filter(Student.roll_number == data.roll_number).first()
    if existing:
        raise HTTPException(status_code=409, detail="Roll number already registered.")

    student = Student(
        id          = str(uuid.uuid4()),
        name        = data.name,
        department  = data.department,
        roll_number = data.roll_number,
        subjects    = data.subjects,
        password    = hash_pw(data.password),
        qr_code     = make_qr(data.roll_number)
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return {"message": "Student registered successfully.", "id": student.id}


@router.post("/register/professor", status_code=201)
def register_professor(data: ProfessorRegister, db: Session = Depends(get_db)):
    existing = db.query(Professor).filter(Professor.employee_id == data.employee_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Employee ID already registered.")

    prof = Professor(
        id          = str(uuid.uuid4()),
        name        = data.name,
        department  = data.department,
        employee_id = data.employee_id,
        subjects    = data.subjects,
        password    = hash_pw(data.password)
    )
    db.add(prof)
    db.commit()
    db.refresh(prof)
    return {"message": "Professor registered successfully.", "id": prof.id}


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    # Try student first
    student = db.query(Student).filter(Student.roll_number == data.identifier).first()
    if student and check_pw(data.password, student.password):
        return {
            "role":        "student",
            "id":          student.id,
            "name":        student.name,
            "department":  student.department,
            "roll_number": student.roll_number,
            "subjects":    student.subjects,
            "qr_code":     student.qr_code
        }

    # Try professor
    prof = db.query(Professor).filter(Professor.employee_id == data.identifier).first()
    if prof and check_pw(data.password, prof.password):
        return {
            "role":        "professor",
            "id":          prof.id,
            "name":        prof.name,
            "department":  prof.department,
            "employee_id": prof.employee_id,
            "subjects":    prof.subjects
        }

    raise HTTPException(status_code=401, detail="Invalid credentials.")


# ---- QR CODE IMAGE ----
@router.get("/student/qr-image/{student_id}")
def get_qr_image(student_id: str, db: Session = Depends(get_db)):
    """Generate and return a QR code image encoding the student's roll number."""
    try:
        import qrcode
    except ImportError:
        raise HTTPException(status_code=500, detail="qrcode library not installed. Run: pip install qrcode[pil]")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # QR encodes just the roll number
    img = qrcode.make(student.roll_number)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png",
                             headers={"Cache-Control": "no-cache"})
