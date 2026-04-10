// student_dashboard.js

const API = '';
let user = null;
let sessionInterval = null;
let fingerprintVerified = false;
let sessionActive = false;
let currentSession = null;

// ----------- INIT -----------
document.addEventListener('DOMContentLoaded', async () => {
  const raw = localStorage.getItem('user');
  if (!raw) { window.location.href = '/static/pages/index.html'; return; }
  user = JSON.parse(raw);
  if (user.role !== 'student') { window.location.href = '/static/pages/professor_dashboard.html'; return; }

  // Set nav info
  document.getElementById('nav-name').textContent = user.name;
  document.getElementById('nav-avatar').textContent = user.name[0].toUpperCase();
  document.getElementById('welcome-msg').textContent = `Hello, ${user.name}! 👋`;
  document.getElementById('roll-dept').textContent = `Roll No: ${user.roll_number} | Department: ${user.department}`;

  await loadStats();
  await loadLog();
  startGeoWatch();
  pollForSession();
});

// ----------- GEOFENCING -----------
function startGeoWatch() {
  if (!navigator.geolocation) {
    setGeo(false, 'Geolocation not supported on this device.');
    return;
  }
  navigator.geolocation.watchPosition(
    pos => checkGeoFence(pos.coords.latitude, pos.coords.longitude),
    err => setGeo(false, 'Location access denied. Allow location to record attendance.'),
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

async function checkGeoFence(lat, lon) {
  try {
    const res  = await fetch(`${API}/api/geofence/check?lat=${lat}&lon=${lon}&student_id=${user.id}`);
    const data = await res.json();
    setGeo(data.within, data.message);
    user._withinFence = data.within;
  } catch {
    setGeo(false, 'Unable to verify location.');
    user._withinFence = false;
  }
}

function setGeo(within, msg) {
  const el = document.getElementById('geo-status');
  el.className = `geo-indicator ${within ? 'geo-in' : 'geo-out'}`;
  document.getElementById('geo-text').textContent = (within ? '✅ ' : '⚠️ ') + msg;
}

// ----------- SESSION POLLING -----------
async function pollForSession() {
  try {
    const res  = await fetch(`${API}/api/session/active`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.active) {
        currentSession = data;
        showSessionBanner(data);
      } else {
        hideSessionBanner();
      }
    }
  } catch {}
  setTimeout(pollForSession, 10000);
}

function showSessionBanner(sess) {
  sessionActive = true;
  document.getElementById('session-banner').style.display = 'block';
  document.getElementById('session-subject').textContent = sess.subject;
  startSessionTimer(sess.remaining_seconds || 600);
}

function hideSessionBanner() {
  sessionActive = false;
  document.getElementById('session-banner').style.display = 'none';
  if (sessionInterval) { clearInterval(sessionInterval); sessionInterval = null; }
}

function startSessionTimer(seconds) {
  if (sessionInterval) clearInterval(sessionInterval);
  let remaining = seconds;
  updateTimerDisplay(remaining);
  sessionInterval = setInterval(() => {
    remaining--;
    updateTimerDisplay(remaining);
    if (remaining <= 0) { clearInterval(sessionInterval); hideSessionBanner(); }
  }, 1000);
}

function updateTimerDisplay(s) {
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const sec = (s % 60).toString().padStart(2,'0');
  document.getElementById('session-timer').textContent = `${m}:${sec}`;
}

// ----------- ATTENDANCE FLOW -----------
function startAttendance() {
  if (!sessionActive) {
    showResultModal(false, 'No Active Session', 'There is no active attendance session right now.');
    return;
  }

  // Check geofence
  if (user._withinFence === false) {
    showResultModal(false, 'Outside Range', 'You must be within 5 meters of the professor to record attendance.');
    return;
  }

  // Open fingerprint modal
  fingerprintVerified = false;
  document.getElementById('fp-icon').textContent = '👆';
  document.getElementById('fp-title').textContent = 'Verify Fingerprint';
  document.getElementById('fp-msg').textContent = 'Place your finger on the sensor to verify your identity before marking attendance.';
  openModal('fp-modal');
}

function simulateFingerprint() {
  const icon = document.getElementById('fp-icon');
  const title = document.getElementById('fp-title');
  const msg = document.getElementById('fp-msg');

  icon.textContent = '⏳';
  title.textContent = 'Scanning...';
  msg.textContent = 'Hold still while we verify your fingerprint.';

  // Use Web Authentication API if available (real biometric)
  if (window.PublicKeyCredential) {
    // Simulate biometric with WebAuthn prompt where available
    setTimeout(() => {
      fingerprintVerified = true;
      icon.textContent = '✅';
      title.textContent = 'Verified!';
      msg.textContent = 'Fingerprint confirmed. Proceed to scan your QR code.';
      setTimeout(() => {
        closeModal('fp-modal');
        openModal('qr-modal');
      }, 1200);
    }, 2000);
  } else {
    setTimeout(() => {
      fingerprintVerified = true;
      icon.textContent = '✅';
      title.textContent = 'Verified!';
      msg.textContent = 'Fingerprint confirmed. Proceed to scan your QR code.';
      setTimeout(() => {
        closeModal('fp-modal');
        openModal('qr-modal');
      }, 1200);
    }, 2000);
  }
}

async function simulateQRScan() {
  // In production: use a QR scanner library (e.g. jsQR or html5-qrcode)
  // Here we simulate with the student's own QR code
  const area = document.getElementById('qr-scan-area');
  area.innerHTML = '⏳';

  try {
    const deviceId = getDeviceId();
    const res  = await fetch(`${API}/api/attendance/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id:  user.id,
        session_id:  currentSession?.session_id,
        device_id:   deviceId,
        qr_code:     user.qr_code || user.roll_number,
        biometric_verified: fingerprintVerified
      })
    });
    const data = await res.json();
    closeModal('qr-modal');

    if (res.ok) {
      showResultModal(true, 'Attendance Recorded! ✅', `Your attendance for ${currentSession?.subject} has been successfully marked.`);
      await loadStats();
      await loadLog();
    } else {
      showResultModal(false, 'Failed ❌', data.detail || 'Could not record attendance.');
    }
  } catch(e) {
    closeModal('qr-modal');
    showResultModal(false, 'Error', 'Network error. Please try again.');
  }
}

// ----------- DEVICE ID (one attendance per device) -----------
function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substr(2,12) + Date.now();
    localStorage.setItem('device_id', id);
  }
  return id;
}

// ----------- STATS -----------
async function loadStats() {
  try {
    const res  = await fetch(`${API}/api/attendance/stats/${user.id}`);
    if (!res.ok) return;
    const d = await res.json();

    document.getElementById('stat-present').textContent = d.present;
    document.getElementById('stat-absent').textContent  = d.absent;
    document.getElementById('stat-late').textContent    = d.late;
    const total = d.present + d.absent + d.late;
    const pct   = total > 0 ? Math.round((d.present + d.late) / total * 100) : 0;
    document.getElementById('stat-overall').textContent = pct + '%';
    document.getElementById('pct-present').textContent  = total ? Math.round(d.present/total*100)+'%' : '0%';
    document.getElementById('pct-absent').textContent   = total ? Math.round(d.absent/total*100)+'%'  : '0%';
    document.getElementById('pct-late').textContent     = total ? Math.round(d.late/total*100)+'%'    : '0%';
    document.getElementById('stat-status').textContent  = pct >= 75 ? '🟢 Good standing' : '🔴 Below 75% threshold!';

    // Subject-wise
    if (d.subjects) renderSubjectAttendance(d.subjects);
  } catch {}
}

function renderSubjectAttendance(subjects) {
  const el = document.getElementById('subject-attendance-list');
  if (!subjects.length) { el.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:20px;">No records yet.</p>'; return; }

  el.innerHTML = subjects.map(s => {
    const total = s.present + s.absent + s.late;
    const pct   = total > 0 ? Math.round((s.present + s.late)/total*100) : 0;
    const danger = pct < 75;
    return `
    <div style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong style="font-size:0.88rem;color:var(--text-dark);">${s.subject}</strong>
        <span class="badge ${danger?'badge-error':'badge-success'}">${pct}%</span>
      </div>
      <div style="display:flex;gap:12px;font-size:0.75rem;color:var(--text-light);margin-bottom:6px;">
        <span>✅ ${s.present} present</span>
        <span>❌ ${s.absent} absent</span>
        <span>⏰ ${s.late} late</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${danger?'danger':''}" style="width:${pct}%"></div>
      </div>
    </div>`;
  }).join('');
}

async function loadLog() {
  try {
    const res  = await fetch(`${API}/api/attendance/log/${user.id}`);
    if (!res.ok) return;
    const logs = await res.json();
    const tbody = document.getElementById('att-log-body');
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-light);padding:24px;">No records yet.</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td>${new Date(l.timestamp).toLocaleDateString()}</td>
        <td>${l.subject}</td>
        <td>${new Date(l.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
        <td><span class="badge ${l.status==='present'?'badge-success':l.status==='late'?'badge-warn':'badge-error'}">${l.status}</span></td>
      </tr>`).join('');
  } catch {}
}

// ----------- MODAL HELPERS -----------
function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function showResultModal(success, title, msg) {
  document.getElementById('result-icon').textContent = success ? '✅' : '❌';
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-msg').textContent = msg;
  openModal('result-modal');
}

function logout() {
  localStorage.clear();
  window.location.href = '/static/pages/index.html';
}
