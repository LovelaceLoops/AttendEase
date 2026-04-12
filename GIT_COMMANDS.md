# AttendEase — Git Commands to Deploy

## ──────────────────────────────────────────
## STEP 1 — First-Time Setup (run once only)
## ──────────────────────────────────────────

### 1a. Go into your project folder
```bash
cd attendance_app
```

### 1b. Initialise a git repo
```bash
git init
```

### 1c. Set your identity (replace with your details)
```bash
git config user.name  "Your Name"
git config user.email "you@example.com"
```

### 1d. Add all files
```bash
git add .
```

### 1e. First commit
```bash
git commit -m "Initial commit — AttendEase with real QR scanner"
```

### 1f. Create a repo on GitHub
Go to https://github.com/new and create a repo called `attendease`
(leave it empty — do NOT add README or .gitignore on GitHub)

### 1g. Link local repo to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/attendease.git
```

### 1h. Push to GitHub
```bash
git branch -M main
git push -u origin main
```

---

## ──────────────────────────────────────────
## STEP 2 — Deploy (pick ONE platform)
## ──────────────────────────────────────────

### OPTION A — Railway (recommended, free tier)
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `attendease` repo
4. Railway auto-detects the Procfile — no config needed
5. Click "Deploy"
6. Railway gives you a public URL like: https://attendease-production.up.railway.app

### OPTION B — Render (free tier)
1. Go to https://render.com
2. New → Web Service → Connect GitHub → select `attendease`
3. Set:
   - Build command: `pip install -r requirements.txt`
   - Start command: `python start.py`
4. Click "Create Web Service"
5. Render gives you a URL like: https://attendease.onrender.com

### OPTION C — ngrok (local machine, instant share)
```bash
# Terminal 1 — run the app
python start.py

# Terminal 2 — expose it publicly
ngrok http 8000
# Copy the https://xxxx.ngrok-free.app URL and share it
```

---

## ──────────────────────────────────────────
## STEP 3 — Push future changes to GitHub
## ──────────────────────────────────────────

Every time you edit files and want to deploy the new version:

```bash
# Check what changed
git status

# Stage all changed files
git add .

# Commit with a message describing the change
git commit -m "Fix: updated QR scanner logic"

# Push to GitHub (Railway/Render auto-redeploy on push)
git push
```

---

## ──────────────────────────────────────────
## STEP 4 — View deploy logs (Railway)
## ──────────────────────────────────────────

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Tail live logs
railway logs
```

---

## ──────────────────────────────────────────
## IMPORTANT — HTTPS for QR scanner & camera
## ──────────────────────────────────────────

The camera API (used by the QR scanner) ONLY works over HTTPS.
- Railway ✅ — gives HTTPS automatically
- Render  ✅ — gives HTTPS automatically
- ngrok   ✅ — gives HTTPS automatically
- http://localhost — ❌ camera will NOT work on mobile

Always access the deployed app via the HTTPS URL on your phone.

---

## Quick reference — common git commands

| Command | What it does |
|---|---|
| `git status` | See which files changed |
| `git add .` | Stage all changes |
| `git add <file>` | Stage one specific file |
| `git commit -m "msg"` | Save a commit locally |
| `git push` | Upload to GitHub |
| `git pull` | Download latest from GitHub |
| `git log --oneline` | See commit history |
| `git diff` | See exact line-by-line changes |
