// register_student.js

const API = '';

const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

let enrolledSubjects = [];
let createdStudentId = null;

// ── Tag input ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('subjects-wrapper');
  const input   = document.getElementById('subject-input');
  const hidden  = document.getElementById('s-subjects');

  function renderTags() {
    wrapper.querySelectorAll('.tag').forEach(t => t.remove());
    enrolledSubjects.forEach((tag, i) => {
      const el = document.createElement('div');
      el.className = 'tag';
      el.innerHTML = `<span>${tag}</span><button type="button">×</button>`;
      el.querySelector('button').onclick = () => { enrolledSubjects.splice(i,1); renderTags(); };
      wrapper.insertBefore(el, input);
    });
    hidden.value = JSON.stringify(enrolledSubjects);
  }

  function addSubject(val) {
    val = val.replace(',','').trim();
    if (!val || enrolledSubjects.includes(val)) return;
    enrolledSubjects.push(val);
    renderTags();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); addSubject(input.value); input.value = '';
    }
    if (e.key === 'Backspace' && input.value === '' && enrolledSubjects.length) {
      enrolledSubjects.pop(); renderTags();
    }
  });
  input.addEventListener('blur', () => {
    if (input.value.trim()) { addSubject(input.value); input.value = ''; }
  });
});

// ── Error helpers ─────────────────────────────────────────────────────────────
function showErr(id)  { document.getElementById(id).classList.add('show'); }
function hideErr(id)  { document.getElementById(id).classList.remove('show'); }
function markErr(fieldId, errId) {
  document.getElementById(fieldId).classList.add('error');
  showErr(errId);
}
function showAlert(msg, type='error') {
  const el = document.getElementById('alert-box');
  if (!el) return;
  el.className = `alert alert-${type} show`;
  el.innerHTML = (type==='error' ? '❌ ' : '✅ ') + msg;
  if (type !== 'error') setTimeout(() => el.className = 'alert', 6000);
}

// ── Step navigation ───────────────────────────────────────────────────────────
function showBiometricStep() {
  const formStep = document.getElementById('step-form');
  const bioStep  = document.getElementById('step-biometric');
  if (!bioStep) {
    console.error('step-biometric element not found in HTML');
    // Fallback — redirect to login since account was created
    alert('Account created! Please login and register your fingerprint from the dashboard.');
    window.location.href = '/static/pages/index.html';
    return;
  }
  if (formStep) formStep.style.display = 'none';
  bioStep.style.display = 'block';
  // Scroll to top so user sees the fingerprint step
  window.scrollTo(0, 0);
}

function setFpUI(icon, title, msg, statusText, statusColor, showBtn) {
  const iconEl  = document.getElementById('fp-reg-icon');
  const titleEl = document.getElementById('fp-reg-title');
  const msgEl   = document.getElementById('fp-reg-msg');
  const badge   = document.getElementById('fp-status-badge');
  const text    = document.getElementById('fp-status-text');
  const btn     = document.getElementById('fp-reg-btn');

  if (iconEl)  iconEl.textContent  = icon;
  if (titleEl) titleEl.textContent = title;
  if (msgEl)   msgEl.textContent   = msg;

  if (badge && text) {
    if (statusText) {
      badge.style.display   = 'block';
      text.textContent      = statusText;
      text.style.background = statusColor || 'rgba(79,195,247,0.12)';
      text.style.color      = statusColor ? '#fff' : 'var(--primary)';
    } else {
      badge.style.display = 'none';
    }
  }
  if (btn) btn.style.display = showBtn ? 'block' : 'none';
}

// ── WebAuthn helpers ──────────────────────────────────────────────────────────
function b64urlToBuffer(str) {
  if (!str || typeof str !== 'string') {
    throw new Error('Expected base64url string, got: ' + typeof str);
  }
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToB64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function prepareRegistrationOptions(options) {
  if (typeof options.challenge === 'string') {
    options.challenge = b64urlToBuffer(options.challenge);
  }
  if (options.user && typeof options.user.id === 'string') {
    options.user.id = b64urlToBuffer(options.user.id);
  }
  if (Array.isArray(options.excludeCredentials)) {
    options.excludeCredentials = options.excludeCredentials.map(c => ({
      ...c, id: typeof c.id === 'string' ? b64urlToBuffer(c.id) : c.id
    }));
  }
  return options;
}

function serializeCredential(credential) {
  return {
    id:    credential.id,
    rawId: bufferToB64url(credential.rawId),
    type:  credential.type,
    response: {
      clientDataJSON:    bufferToB64url(credential.response.clientDataJSON),
      attestationObject: bufferToB64url(credential.response.attestationObject),
    }
  };
}

// ── Account creation ──────────────────────────────────────────────────────────
async function submitStudent() {
  let valid = true;

  const name     = document.getElementById('s-name').value.trim();
  const dept     = document.getElementById('s-dept').value;
  const roll     = document.getElementById('s-roll').value.trim();
  const pw       = document.getElementById('s-pw').value;
  const pw2      = document.getElementById('s-pw2').value;
  const subjects = JSON.parse(document.getElementById('s-subjects').value || '[]');

  ['err-name','err-dept','err-roll','err-roll-dup','err-subjects','err-pw','err-pw2'].forEach(hideErr);
  ['s-name','s-dept','s-roll','s-pw','s-pw2'].forEach(id =>
    document.getElementById(id).classList.remove('error'));

  if (!name)             { markErr('s-name','err-name');   valid = false; }
  if (!dept)             { markErr('s-dept','err-dept');   valid = false; }
  if (!roll)             { markErr('s-roll','err-roll');   valid = false; }
  if (!subjects.length)  { showErr('err-subjects');        valid = false; }
  if (!PW_REGEX.test(pw)){ markErr('s-pw','err-pw');       valid = false; }
  if (pw !== pw2)        { markErr('s-pw2','err-pw2');     valid = false; }
  if (!valid) return;

  const btnText = document.getElementById('btn-text');
  const btnSpin = document.getElementById('btn-spin');
  btnText.style.display = 'none';
  btnSpin.style.display = 'inline-block';

  // ── Network call only — JS logic is OUTSIDE this try/catch ──────────────
  let responseData = null;
  let responseOk   = false;
  let responseStatus = 0;

  try {
    const res  = await fetch(`${API}/api/register/student`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, department: dept, roll_number: roll, subjects, password: pw })
    });
    responseData   = await res.json();
    responseOk     = res.ok;
    responseStatus = res.status;
  } catch(e) {
    // Only genuine network failures reach here
    showAlert('Network error. Check your connection and try again.');
    btnText.style.display = 'inline';
    btnSpin.style.display = 'none';
    return;
  }

  btnText.style.display = 'inline';
  btnSpin.style.display = 'none';

  // ── Handle response outside try/catch so JS errors are visible ──────────
  if (responseStatus === 409) {
    showErr('err-roll-dup');
    markErr('s-roll','err-roll-dup');
    return;
  }

  if (!responseOk) {
    showAlert(responseData?.detail || 'Registration failed. Please try again.');
    return;
  }

 }
