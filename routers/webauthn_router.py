"""
routers/webauthn_router.py — WebAuthn Biometric Registration & Authentication

Flow:
  REGISTRATION
    1. POST /webauthn/register/begin   → returns options (challenge) to browser
    2. POST /webauthn/register/complete → verifies response, stores public key

  AUTHENTICATION (at attendance time)
    1. POST /webauthn/auth/begin       → returns options (challenge) to browser
    2. POST /webauthn/auth/complete    → verifies signature, returns token

Dependencies:
    pip install webauthn==2.1.0
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel
from typing import Optional
import uuid, json, base64
from routers import webauthn_router

import webauthn
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    ResidentKeyRequirement,
    AuthenticatorAttachment,
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier

from database import get_db, Student, WebAuthnCredential

router = APIRouter()

RP_ID     = "attendease-nao1.onrender.com"
RP_NAME   = "AttendEase"
RP_ORIGIN = "https://attendease-nao1.onrender.com"

# In-memory challenge store (use Redis in production for multi-instance)
# Key: student_id, Value: base64url challenge string
_pending_reg_challenges  : dict[str, str] = {}
_pending_auth_challenges : dict[str, str] = {}


# ── Helpers ──────────────────────────────────────────────────────────────────

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


# ── Schemas ───────────────────────────────────────────────────────────────────

class BeginRequest(BaseModel):
    student_id: str

class RegistrationCompleteRequest(BaseModel):
    student_id: str
    credential: dict          # raw JSON from navigator.credentials.create()

class AuthBeginRequest(BaseModel):
    student_id: str

class AuthCompleteRequest(BaseModel):
    student_id: str
    credential: dict          # raw JSON from navigator.credentials.get()


# ── REGISTRATION ─────────────────────────────────────────────────────────────

@router.post("/webauthn/register/begin")
def register_begin(data: BeginRequest, db: DBSession = Depends(get_db)):
    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # Collect existing credential IDs to exclude (prevent double-registration)
    existing = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.student_id == data.student_id
    ).all()
    exclude_credentials = [
        webauthn.helpers.structs.PublicKeyCredentialDescriptor(
            id=b64url_decode(c.credential_id)
        )
        for c in existing
    ]

    options = webauthn.generate_registration_options(
        rp_id   = RP_ID,
        rp_name = RP_NAME,
        user_id = student.id.encode(),
        user_name        = student.roll_number,
        user_display_name= student.name,
        authenticator_selection = AuthenticatorSelectionCriteria(
            authenticator_attachment = AuthenticatorAttachment.PLATFORM,  # device biometric only
            resident_key             = ResidentKeyRequirement.PREFERRED,
            user_verification        = UserVerificationRequirement.REQUIRED,
        ),
        supported_pub_key_algs = [
            COSEAlgorithmIdentifier.ECDSA_SHA_256,
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
        ],
        exclude_credentials = exclude_credentials,
    )

    # Store challenge for verification step
    _pending_reg_challenges[data.student_id] = b64url_encode(options.challenge)

    return webauthn.options_to_json(options)


@router.post("/webauthn/register/complete")
def register_complete(data: RegistrationCompleteRequest, db: DBSession = Depends(get_db)):
    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    expected_challenge = _pending_reg_challenges.pop(data.student_id, None)
    if not expected_challenge:
        raise HTTPException(status_code=400, detail="No pending registration challenge. Please restart.")

    try:
        verification = webauthn.verify_registration_response(
            credential        = data.credential,
            expected_challenge= b64url_decode(expected_challenge),
            expected_rp_id    = RP_ID,
            expected_origin   = RP_ORIGIN,
            require_user_verification = True,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Biometric registration failed: {str(e)}")

    # Store the credential
    cred = WebAuthnCredential(
        id            = str(uuid.uuid4()),
        student_id    = student.id,
        credential_id = b64url_encode(verification.credential_id),
        public_key    = b64url_encode(verification.credential_public_key),
        sign_count    = verification.sign_count,
        device_type   = str(verification.credential_device_type),
    )
    db.add(cred)
    db.commit()

    return {"message": "Biometric registered successfully.", "credential_id": cred.credential_id}


# ── AUTHENTICATION ────────────────────────────────────────────────────────────

@router.post("/webauthn/auth/begin")
def auth_begin(data: AuthBeginRequest, db: DBSession = Depends(get_db)):
    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    credentials = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.student_id == data.student_id
    ).all()

    if not credentials:
        raise HTTPException(
            status_code=404,
            detail="No biometric registered for this device. Please register your fingerprint first."
        )

    allow_credentials = [
        webauthn.helpers.structs.PublicKeyCredentialDescriptor(
            id=b64url_decode(c.credential_id)
        )
        for c in credentials
    ]

    options = webauthn.generate_authentication_options(
        rp_id             = RP_ID,
        allow_credentials = allow_credentials,
        user_verification = UserVerificationRequirement.REQUIRED,
    )

    _pending_auth_challenges[data.student_id] = b64url_encode(options.challenge)

    return webauthn.options_to_json(options)


@router.post("/webauthn/auth/complete")
def auth_complete(data: AuthCompleteRequest, db: DBSession = Depends(get_db)):
    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    expected_challenge = _pending_auth_challenges.pop(data.student_id, None)
    if not expected_challenge:
        raise HTTPException(status_code=400, detail="No pending auth challenge. Please restart.")

    # Find the specific credential being used
    credential_id_used = data.credential.get("id", "")
    cred = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.student_id    == data.student_id,
        WebAuthnCredential.credential_id == credential_id_used
    ).first()

    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found. Please register your biometric again.")

    try:
        verification = webauthn.verify_authentication_response(
            credential             = data.credential,
            expected_challenge     = b64url_decode(expected_challenge),
            expected_rp_id         = RP_ID,
            expected_origin        = RP_ORIGIN,
            credential_public_key  = b64url_decode(cred.public_key),
            credential_current_sign_count = cred.sign_count,
            require_user_verification     = True,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Biometric verification failed: {str(e)}")

    # Update sign count (replay attack protection)
    cred.sign_count = verification.new_sign_count
    db.commit()

    return {"verified": True, "message": "Biometric verified successfully."}


# ── STATUS CHECK ──────────────────────────────────────────────────────────────

@router.get("/webauthn/status/{student_id}")
def webauthn_status(student_id: str, db: DBSession = Depends(get_db)):
    """Check if a student has any registered biometric credentials."""
    count = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.student_id == student_id
    ).count()
    return {"registered": count > 0, "credential_count": count}
