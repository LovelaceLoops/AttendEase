"""
database.py — PostgreSQL database setup with SQLAlchemy ORM
"""

from sqlalchemy import (
    create_engine, Column, String, Integer, Float,
    Boolean, DateTime, ForeignKey, JSON, Text, BigInteger
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timezone
import os

import re

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./attendease.db")

# Normalize postgres:// → postgresql+pg8000://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+pg8000://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ----------- MODELS -----------

class Student(Base):
    __tablename__ = "students"

    id          = Column(String, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    department  = Column(String, nullable=False)
    roll_number = Column(String, unique=True, nullable=False, index=True)
    subjects    = Column(JSON, default=list)
    password    = Column(String, nullable=False)
    qr_code     = Column(String, unique=True)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all,delete")
    webauthn_credentials = relationship("WebAuthnCredential", back_populates="student", cascade="all,delete")


class Professor(Base):
    __tablename__ = "professors"

    id          = Column(String, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    department  = Column(String, nullable=False)
    employee_id = Column(String, unique=True, nullable=False, index=True)
    subjects    = Column(JSON, default=list)
    password    = Column(String, nullable=False)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    login_lat   = Column(Float, nullable=True)
    login_lon   = Column(Float, nullable=True)

    sessions = relationship("AttendanceSession", back_populates="professor", cascade="all,delete")


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id               = Column(String, primary_key=True, index=True)
    professor_id     = Column(String, ForeignKey("professors.id"), nullable=False)
    subject          = Column(String, nullable=False)
    start_time       = Column(String)
    end_time         = Column(String)
    duration_minutes = Column(Integer, default=10)
    is_active        = Column(Boolean, default=True)
    prof_lat         = Column(Float, nullable=True)
    prof_lon         = Column(Float, nullable=True)
    started_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ended_at         = Column(DateTime, nullable=True)

    professor = relationship("Professor", back_populates="sessions")
    records   = relationship("AttendanceRecord", back_populates="session", cascade="all,delete")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id         = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    session_id = Column(String, ForeignKey("attendance_sessions.id"), nullable=True)
    subject    = Column(String, nullable=False)
    status     = Column(String, nullable=False)   # present | absent | late
    device_id  = Column(String, nullable=True)
    timestamp  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="attendance_records")
    session = relationship("AttendanceSession", back_populates="records")


class DeviceRecord(Base):
    """Track which devices have already submitted attendance for a session."""
    __tablename__ = "device_records"

    id         = Column(String, primary_key=True)
    device_id  = Column(String, nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    student_id = Column(String, nullable=False)
    timestamp  = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class WebAuthnCredential(Base):
    """
    Stores the WebAuthn public key credential for each student device.
    One student can have multiple credentials (e.g. phone + tablet).
    The private key and raw fingerprint data NEVER leave the device —
    only the public key and a sign count are stored here.
    """
    __tablename__ = "webauthn_credentials"

    id            = Column(String, primary_key=True, index=True)   # UUID
    student_id    = Column(String, ForeignKey("students.id"), nullable=False, index=True)
    credential_id = Column(String, unique=True, nullable=False, index=True)  # base64url
    public_key    = Column(Text, nullable=False)   # base64url encoded COSE public key
    sign_count    = Column(BigInteger, default=0)  # replay attack counter
    device_type   = Column(String, nullable=True)  # single_device | multi_device
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="webauthn_credentials")


# ----------- DB DEPENDENCY -----------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
