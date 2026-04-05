# 🎓 AttendEase — Smart QR Attendance System

A full-stack attendance recording web application built with **FastAPI** (backend) and **HTML/CSS/JS** (frontend), featuring QR scanning, biometric verification, geofencing, and real-time session management.

---

## 📁 Project Structure

```
attendance_app/
├── main.py                      # FastAPI app entry point
├── database.py                  # SQLAlchemy ORM models (SQLite)
├── start.py                     # One-command startup script
├── requirements.txt
├── routers/
│   ├── auth.py                  # Register & Login
│   ├── attendance.py            # Record attendance, stats, logs
│   ├── sessions.py              # Start/stop lecture sessions
│   ├── students.py              # Student listing for professors
│   ├── stats.py                 # Aggregate class stats
│   └── geofence.py              # 5m geofence check
└── static/
    ├── css/
    │   └── theme.css            # Global light-blue & pink theme
    ├── js/
    │   ├── landing.js           # Login / register routing
    │   ├── register_student.js  # Student form logic + validation
    │   ├── register_professor.js# Professor form logic
    │   ├── student_dashboard.js # Geo, biometric, QR, stats
    │   └── professor_dashboard.js # Session mgmt, defaulters
    └── pages/
        ├── index.html           # Landing (login / register choice)
        ├── register_student.html
        ├── register_professor.html
        ├── student_dashboard.html
        └── professor_dashboard.html
```

---

## ⚙️ Setup & Run

### 1. Install Python dependencies
```bash
cd attendance_app
pip install -r requirements.txt
```

### 2. Start the server
```bash
python start.py
```
The app will be available at **http://localhost:8000**

---

## 🌐 Share the App Publicly (Get a Public Link)

### Option A — ngrok (easiest)
```bash
# Install ngrok from https://ngrok.com/download
ngrok http 8000
# Copy the https://xxxx.ngrok-free.app URL and share it!
```

### Option B — Cloudflare Tunnel (free, no account needed)
```bash
# macOS/Linux
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
# Or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

cloudflared tunnel --url http://localhost:8000
# Copy the trycloudflare.com URL
```

### Option C — Deploy to Railway (permanent hosting)
1. Push this folder to a GitHub repository
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Set start command: `python start.py`
4. Railway gives you a permanent public URL

### Option D — Deploy to Render (free tier)
1. Push to GitHub
2. Go to https://render.com → New Web Service
3. Build command: `pip install -r requirements.txt`
4. Start command: `python start.py`

---

## 🔑 Features

### 👤 Authentication
- Separate registration for **Students** and **Professors**
- Roll number uniqueness enforced with error message
- Password validation: min 8 chars, uppercase + lowercase + special character
- Multi-entry tag input for subjects (press Enter or comma to add)

### 🎓 Student Flow
1. Login → Student Dashboard
2. When a professor starts a session, a live banner appears
3. Tap **Mark My Attendance** →
   - **Geofencing**: Must be within **5 metres** of professor's device
   - **Biometric**: Fingerprint verification prompt (uses Web Authentication API where supported)
   - **QR Scan**: Scan unique QR code on student ID card
4. **One device = one attendance** per session (device fingerprint stored)
5. Success/failure alert shown immediately
6. View subject-wise attendance %, present/absent/late stats

### 👩‍🏫 Professor Flow
1. Login → Professor Dashboard
2. **Start Session**: Select subject, set lecture time frame, set window (1-10 min, default 10)
3. **Manual attendance**: Enter roll number → marks student as "Late"
4. **Defaulters list**: Auto-computed students with <75% attendance
5. **All students table** with per-student attendance breakdown
6. Class-wide aggregate statistics

### 📍 Geofencing
- Professor's GPS is captured when a session starts and continuously updated
- Student's GPS is checked against professor's location (5m radius)
- Visual indicator (green/red) shown on student dashboard

### 🔐 Security
- Passwords hashed with SHA-256
- One attendance record per device per session
- Biometric verification gate before QR scan
- QR codes are unique per student and stored in the database

---

## 🎨 Theme
- **Primary**: Light Blue (`#4fc3f7`)
- **Accent**: Pink (`#f48fb1`)
- **Fonts**: Nunito (headings) + Poppins (body)
- Smooth animations, gradient cards, responsive layout

---

## 🔧 Customisation

| Setting | File | Variable |
|---|---|---|
| Geofence radius | `routers/geofence.py` | `RADIUS_METRES` |
| Max session duration | `routers/sessions.py` | capped at 10 min |
| Defaulter threshold | `static/js/professor_dashboard.js` | `pct < 75` |
| Database URL | `database.py` | `DATABASE_URL` |

---

## 📱 Mobile Notes
- The app is fully responsive and works on mobile browsers
- Geolocation requires **HTTPS** on mobile — use ngrok/Cloudflare tunnel (they provide HTTPS automatically)
- Biometric prompt uses the device's native fingerprint/face ID via WebAuthn where supported

---

## 🚀 Production Checklist
- [ ] Replace SQLite with PostgreSQL (`DATABASE_URL=postgresql://...`)
- [ ] Add JWT authentication tokens
- [ ] Integrate a real QR scanner library (e.g. `html5-qrcode`)
- [ ] Add email notifications for low attendance
- [ ] Enable HTTPS with a proper SSL certificate
- [ ] Add admin panel for department management
