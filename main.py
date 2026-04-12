"""
AttendEase — FastAPI Backend
Run with: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import uvicorn

from routers import auth, attendance, sessions, students, stats, geofence

# WebAuthn is optional — if package not installed, biometric routes
# are unavailable but the rest of the app works normally
try:
    from routers import webauthn_router
    WEBAUTHN_AVAILABLE = True
    print("✅ WebAuthn router loaded.")
except Exception as e:
    WEBAUTHN_AVAILABLE = False
    print(f"⚠️  WebAuthn unavailable: {e}")

app = FastAPI(title="AttendEase API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- ROUTERS ----
app.include_router(auth.router,       prefix="/api", tags=["Auth"])
app.include_router(attendance.router, prefix="/api", tags=["Attendance"])
app.include_router(sessions.router,   prefix="/api", tags=["Sessions"])
app.include_router(students.router,   prefix="/api", tags=["Students"])
app.include_router(stats.router,      prefix="/api", tags=["Stats"])
app.include_router(geofence.router,   prefix="/api", tags=["Geofence"])

if WEBAUTHN_AVAILABLE:
    app.include_router(webauthn_router.router, prefix="/api", tags=["WebAuthn"])

# ---- STATIC FILES ----
app.mount("/static", StaticFiles(directory="static"), name="static")

# ---- PAGES ----
@app.get("/")
async def root():
    return FileResponse("static/pages/index.html")

@app.get("/student")
async def student_page():
    return FileResponse("static/pages/student_dashboard.html")

@app.get("/professor")
async def professor_page():
    return FileResponse("static/pages/professor_dashboard.html")

@app.get("/register/student")
async def reg_student():
    return FileResponse("static/pages/register_student.html")

@app.get("/register/professor")
async def reg_professor():
    return FileResponse("static/pages/register_professor.html")

# ---- HEALTH CHECK ----
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "app": "AttendEase",
        "webauthn": WEBAUTHN_AVAILABLE
    }

@app.get("/static/sw.js")
async def service_worker():
    return FileResponse("static/sw.js",
                        headers={"Service-Worker-Allowed": "/"})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
