"""
database.py — SQLite database setup with SQLAlchemy ORM
"""

from sqlalchemy import (
    create_engine, Column, String, Integer, Float,
    Boolean, DateTime, ForeignKey, JSON, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./attendease.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ----------- MODELS -----------

class Student(Base):
    __tablename__ = "students"

    id          = Column(String, primary_key=True, index=True)  # UUID
    name        = Column(String, nullable=False)
    department  = Column(String, nullable=False)
    roll_number = Column(String, unique=True, nullable=False, index=True)
    subjects    = Column(JSON, default=list)      # list of subject strings
    password    = Column(String, nullable=False)  # hashed
    qr_code     = Column(String, unique=True)     # unique QR identifier
    created_at  = Column(DateTime, default=datetime.utcnow)

    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all,delete")


class Professor(Base):
    __tablename__ = "professors"

    id          = Column(String, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    department  = Column(String, nullable=False)
    employee_id = Column(String, unique=True, nullable=False, index=True)
    subjects    = Column(JSON, default=list)
    password    = Column(String, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("AttendanceSession", back_populates="professor", cascade="all,delete")


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id              = Column(String, primary_key=True, index=True)
    professor_id    = Column(String, ForeignKey("professors.id"), nullable=False)
    subject         = Column(String, nullable=False)
    start_time      = Column(String)           # HH:MM string
    end_time        = Column(String)
    duration_minutes = Column(Integer, default=10)
    is_active       = Column(Boolean, default=True)
    prof_lat        = Column(Float, nullable=True)
    prof_lon        = Column(Float, nullable=True)
    started_at      = Column(DateTime, default=datetime.utcnow)
    ended_at        = Column(DateTime, nullable=True)

    professor = relationship("Professor", back_populates="sessions")
    records   = relationship("AttendanceRecord", back_populates="session", cascade="all,delete")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id          = Column(String, primary_key=True, index=True)
    student_id  = Column(String, ForeignKey("students.id"), nullable=False)
    session_id  = Column(String, ForeignKey("attendance_sessions.id"), nullable=True)
    subject     = Column(String, nullable=False)
    status      = Column(String, nullable=False)   # present | absent | late
    device_id   = Column(String, nullable=True)
    timestamp   = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="attendance_records")
    session = relationship("AttendanceSession", back_populates="records")


class DeviceRecord(Base):
    """Track which devices have already submitted attendance for a session."""
    __tablename__ = "device_records"

    id         = Column(String, primary_key=True)
    device_id  = Column(String, nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    student_id = Column(String, nullable=False)
    timestamp  = Column(DateTime, default=datetime.utcnow)


# ----------- DB DEPENDENCY -----------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
