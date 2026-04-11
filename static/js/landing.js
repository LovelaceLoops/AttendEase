// landing.js — Login / Registration Routing

const API = '';

function showStep(id) {
  ['step-auth','step-login','step-register-role'].forEach(s => {
    document.getElementById(s).style.display = 'none';
  });
  document.getElementById(id).style.display = 'block';
}

function showLogin()        { showStep('step-login'); }
function showRegisterRole() { showStep('step-register-role'); }

function goRegister(role) {
  if (role === 'student')   window.location.href = '/static/pages/register_student.html';
  else                      window.location.href = '/static/pages/register_professor.html';
}

function showAlert(msg, type='error') {
  const el = document.getElementById('alert-box');
  el.className = `alert alert-${type} show`;
  el.innerHTML = (type==='error'?'❌ ':'✅ ') + msg;
  setTimeout(() => el.className = 'alert', 4000);
}

async function doLogin() {
  const uid = document.getElementById('login-id').value.trim();
  const pw  = document.getElementById('login-pw').value;
  if (!uid || !pw) { showAlert('Please enter your ID and password.'); return; }

  // Capture GPS coordinates before sending login
  let lat = null, lon = null;
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 8000
      })
    );
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
  } catch(e) {
    // GPS unavailable or denied — login still proceeds, coordinates will be null
  }

  try {
    const res  = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: uid, password: pw, lat, lon })
    });
    const data = await res.json();
    if (!res.ok) { showAlert(data.detail || 'Login failed.'); return; }

    localStorage.setItem('user', JSON.stringify(data));

    if (data.role === 'student')
      window.location.href = '/static/pages/student_dashboard.html';
    else
      window.location.href = '/static/pages/professor_dashboard.html';

  } catch(e) {
    showAlert('Server error. Please try again.');
  }
}

// Allow Enter key in login fields
document.addEventListener('DOMContentLoaded', () => {
  ['login-id','login-pw'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  });
});
