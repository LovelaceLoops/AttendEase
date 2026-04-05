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

app = FastAPI(title="AttendEase API", version="1.0.0")

# CORS — allow all origins for shareability (tighten in production)
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

# ---- STATIC FILES ----
app.mount("/static", StaticFiles(directory="static"), name="static")

# ---- ROOT → serve landing page ----
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
    return {"status": "ok", "app": "AttendEase"}

import uvicorn
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
