// professor_dashboard.js

const API = '';
let user = null;
let sessionCountdown = null;
let activeSessionId = null;
let allStudents = [];

document.addEventListener('DOMContentLoaded', async () => {
  const raw = localStorage.getItem('user');
  if (!raw) { window.location.href = '/static/pages/index.html'; return; }
  user = JSON.parse(raw);
  if (user.role !== 'professor') { window.location.href = '/static/pages/student_dashboard.html'; return; }

  document.getElementById('nav-name').textContent = user.name;
  document.getElementById('nav-avatar').textContent = user.name[0].toUpperCase();
  document.getElementById('welcome-msg').textContent = `Hello, Prof. ${user.name}! 👋`;
  document.getElementById('dept-info').textContent = `Department: ${user.department} | Employee ID: ${user.employee_id}`;

  renderSubjectChips();
  populateSubjectFilter();
  await loadClassStats();
  await loadAllStudents();
  setDefaultTime();
});

// ----------- SUBJECT CHIPS -----------
function renderSubjectChips() {
  const container = document.getElementById('subject-chips');
  const subjects  = user.subjects || [];
  container.innerHTML = subjects.map(s =>
    `<div class="subject-chip" onclick="selectSubject(this,'${s}')">${s}</div>`
  ).join('');
}

function selectSubject(el, name) {
  document.querySelectorAll('.subject-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('selected-subject').value = name;
}

function populateSubjectFilter() {
  const sel = document.getElementById('stats-subject-filter');
  (user.subjects || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    sel.appendChild(opt);
  });
}

function setDefaultTime() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  document.getElementById('lec-start').value = `${h}:${m}`;
  const end = new Date(now.getTime() + 60*60000);
  document.getElementById('lec-end').value = `${end.getHours().toString().padStart(2,'0')}:${end.getMinutes().toString().padStart(2,'0')}`;
}

// ----------- SESSION MANAGEMENT -----------
async function startSession() {
  const subject  = document.getElementById('selected-subject').value;
  const start    = document.getElementById('lec-start').value;
  const end      = document.getElementById('lec-end').value;
  const duration = Math.min(parseInt(document.getElementById('session-duration').value) || 10, 10);

  if (!subject) { showAlert('Please select a subject first.', 'error'); return; }
  if (!start || !end) { showAlert('Please set lecture time.', 'error'); return; }

  try {
    const res  = await fetch(`${API}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        professor_id: user.id,
        subject,
        start_time: start,
        end_time: end,
        duration_minutes: duration
      })
    });
    const data = await res.json();

    if (!res.ok) { showAlert(data.detail || 'Could not start session.', 'error'); return; }

    activeSessionId = data.session_id;
    document.getElementById('session-live-badge').style.display = 'inline-block';
    document.getElementById('session-timer-wrap').style.display = 'block';
    document.getElementById('start-session-btn').style.display = 'none';
    showAlert(`Session started for "${subject}" — ${duration} min window.`, 'success');
    startCountdown(duration * 60);

    // Share professor location for geofencing
    //shareLocation(data.session_id);

  } catch(e) {
    showAlert('Server error. Please try again.', 'error');
  }
}

function startCountdown(seconds) {
  if (sessionCountdown) clearInterval(sessionCountdown);
  let rem = seconds;
  updateCountdown(rem);
  sessionCountdown = setInterval(() => {
    rem--;
    updateCountdown(rem);
    if (rem <= 0) { clearInterval(sessionCountdown); endSessionUI(); }
  }, 1000);
}

function updateCountdown(s) {
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const sec = (s%60).toString().padStart(2,'0');
  document.getElementById('session-countdown').textContent = `${m}:${sec}`;
}

function stopSession() { openModal('stop-modal'); }

async function confirmStop() {
  closeModal('stop-modal');
  if (activeSessionId) {
    try {
      await fetch(`${API}/api/session/stop/${activeSessionId}`, { method:'POST' });
    } catch {}
  }
  if (sessionCountdown) clearInterval(sessionCountdown);
  endSessionUI();
  showAlert('Session ended.', 'info');
}

function endSessionUI() {
  activeSessionId = null;
  document.getElementById('session-live-badge').style.display = 'none';
  document.getElementById('session-timer-wrap').style.display = 'none';
  document.getElementById('start-session-btn').style.display = 'block';
  loadAllStudents();
  loadClassStats();
}

//function shareLocation(sessionId) {
 // if (!navigator.geolocation) return;
  //navigator.geolocation.watchPosition(pos => {
    //fetch(`${API}/api/session/location`, {
      //method: 'POST',
      //headers: { 'Content-Type': 'application/json' },
      //body: JSON.stringify({
        //session_id: sessionId,
        //lat: pos.coords.latitude,
        //lon: pos.coords.longitude
      //})
    //}).catch(() => {});
  //}, null, { enableHighAccuracy: true, maximumAge: 5000 });
//}

// ----------- MANUAL ATTENDANCE -----------
async function manualAttendance() {
  const roll = document.getElementById('manual-roll').value.trim();
  const msgEl = document.getElementById('manual-result');
  if (!roll) { showMsg(msgEl, 'Enter a roll number.', 'error'); return; }

  const subject = document.getElementById('selected-subject').value;
  if (!subject) { showMsg(msgEl, 'Please select a subject first.', 'error'); return; }

  try {
    const res  = await fetch(`${API}/api/attendance/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll_number: roll, subject, professor_id: user.id, status: 'late' })
    });
    const data = await res.json();

    if (res.ok) {
      showMsg(msgEl, `✅ ${data.student_name} marked as Late for ${subject}.`, 'success');
      document.getElementById('manual-roll').value = '';
      await loadAllStudents();
    } else {
      showMsg(msgEl, `❌ ${data.detail || 'Student not found.'}`, 'error');
    }
  } catch {
    showMsg(msgEl, '❌ Server error.', 'error');
  }
}

function showMsg(el, msg, type) {
  el.className = `alert alert-${type} show`;
  el.textContent = msg;
  setTimeout(() => el.className = 'alert', 4000);
}

// ----------- CLASS STATS -----------
async function loadClassStats() {
  const subject = document.getElementById('stats-subject-filter')?.value || 'all';
  try {
    const res  = await fetch(`${API}/api/stats/class?professor_id=${user.id}&subject=${subject}`);
    if (!res.ok) return;
    const d = await res.json();

    document.getElementById('cls-present').textContent = d.avg_present ?? '—';
    document.getElementById('cls-absent').textContent  = d.avg_absent  ?? '—';
    document.getElementById('cls-late').textContent    = d.avg_late    ?? '—';
    document.getElementById('cls-total').textContent   = d.total_students ?? '—';
  } catch {}
}

// ----------- STUDENTS LIST -----------
async function loadAllStudents() {
  try {
    const res  = await fetch(`${API}/api/students?professor_id=${user.id}`);
    if (!res.ok) return;
    allStudents = await res.json();
    renderStudents(allStudents);
    renderDefaulters(allStudents);
  } catch {}
}

function renderStudents(students) {
  const tbody = document.getElementById('students-body');
  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:24px;">No students enrolled yet.</td></tr>';
    return;
  }
  tbody.innerHTML = students.map(s => {
    const total = s.present + s.absent + s.late;
    const pct   = total > 0 ? Math.round((s.present+s.late)/total*100) : 0;
    const danger = pct < 75;
    return `<tr>
      <td><strong>${s.roll_number}</strong></td>
      <td>${s.name}</td>
      <td>${s.department}</td>
      <td style="color:var(--success);font-weight:600;">${s.present}</td>
      <td style="color:var(--error);font-weight:600;">${s.absent}</td>
      <td style="color:var(--warning);font-weight:600;">${s.late}</td>
      <td><span class="badge ${danger?'badge-error':'badge-success'}">${pct}%</span></td>
    </tr>`;
  }).join('');
}

function renderDefaulters(students) {
  const defaulters = [];
  students.forEach(s => {
    (s.subject_stats||[]).forEach(sub => {
      const total = sub.present + sub.absent + sub.late;
      const pct   = total > 0 ? Math.round((sub.present+sub.late)/total*100) : 0;
      if (pct < 75) defaulters.push({ ...s, subject: sub.subject, pct });
    });
  });

  document.getElementById('defaulter-count').textContent = defaulters.length;
  const tbody = document.getElementById('defaulter-body');

  if (!defaulters.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:24px;">No defaulters 🎉</td></tr>';
    return;
  }
  tbody.innerHTML = defaulters.map(d => `<tr>
    <td><strong>${d.roll_number}</strong></td>
    <td>${d.name}</td>
    <td>${d.subject}</td>
    <td><span class="badge badge-error">${d.pct}%</span></td>
    <td><span class="badge badge-warn">⚠ Defaulter</span></td>
  </tr>`).join('');
}

function filterStudents() {
  const q = document.getElementById('student-search').value.toLowerCase();
  const filtered = allStudents.filter(s =>
    s.name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q)
  );
  renderStudents(filtered);
}

// ----------- MODAL -----------
function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function showAlert(msg, type='info') {
  const el = document.getElementById('alert-box');
  el.className = `alert alert-${type} show`;
  el.innerHTML = msg;
  setTimeout(() => el.className = 'alert', 5000);
}

function logout() {
  localStorage.clear();
  window.location.href = '/static/pages/index.html';
}
