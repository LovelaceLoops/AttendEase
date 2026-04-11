// register_student.js

const API = '';

const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

let enrolledSubjects = [];
let createdStudentId = null;   // set after account creation, used by biometric step

// ── Tag input setup ───────────────────────────────────────────────────────────
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
      e.preventDefault();
      addSubject(input.value);
      input.value = '';
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
  el.className = `alert alert-${type} show`;
  el.innerHTML = (type==='error' ? '❌ ' : '✅ ') + msg;
  if (type !== 'error') setTimeout(() => el.className = 'alert', 6000);
}

// ── Step navigation ───────────────────────────────────────────────────────────
function showBiometricStep() {
  document.getElementById('step-form').style.display      = 'none';
  document.getElementById('step-biometric').style.display = 'block';
}

function setFpUI(icon, title, msg, statusText, statusColor, showBtn) {
  document.getElementById('fp-reg-icon').textContent  = icon;
  document.getElementById('fp-reg-title').textContent = title;
  document.getElementById('fp-reg-msg').textContent   = msg;

  const badge = document.getElementById('fp-status-badge');
  const text  = document.getElementById('fp-status-text');
  if (statusText) {
    badge.style.display     = 'block';
    text.textContent        = statusText;
    text.style.background   = statusColor || 'rgba(79,195,247,0.12)';
    text.style.color        = statusColor ? '#fff' : 'var(--primary)';
  } else {
    badge.style.display = 'none';
  }

  const btn = document.getElementById('fp-reg-btn');
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

// ── Fingerprint enrollment (called from Step 2 button) ────────────────────────
async function startFingerprintEnrollment() {
  if (!window.PublicKeyCredential) {
    setFpUI('❌', 'Not Supported',
      'Your browser does not support biometric authentication. Please use Chrome on Android or Safari on iPhone.',
      'Unsupported', 'rgba(239,83,80,0.8)', false);
    document.getElementById('fp-skip-btn').style.display = 'block';
    return;
  }

  // Scanning state
  setFpUI('⏳', 'Scanning…',
    'Follow the prompt on your device to scan your fingerprint or face.',
    'Scanning…', null, false);
  document.getElementById('fp-skip-btn').style.display = 'none';

  try {
    // Step 1: Get options from server
    const beginRes = await fetch(`${API}/api/webauthn/register/begin`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ student_id: createdStudentId })
    });

    if (!beginRes.ok) {
      const err = await beginRes.json();
      throw new Error(err.detail || 'Server error starting biometric setup.');
    }

    const rawOptions = await beginRes.json();
    console.log('WebAuthn register options:', JSON.stringify(rawOptions));
    const options = prepareRegistrationOptions(rawOptions);

    // Step 2: Trigger device biometric prompt
    let credential;
    try {
      credential = await navigator.credentials.create({ publicKey: options });
    } catch(e) {
      if (e.name === 'NotAllowedError') {
        setFpUI('❌', 'Cancelled',
          'The fingerprint prompt was dismissed. Tap the button below to try again.',
          'Cancelled', 'rgba(239,83,80,0.8)', true);
      } else {
        setFpUI('❌', 'Failed',
          `Something went wrong: ${e.message}. Tap the button to try again.`,
          'Error', 'rgba(239,83,80,0.8)', true);
      }
      document.getElementById('fp-skip-btn').style.display = 'block';
      return;
    }

    // Step 3: Send to server
    const completeRes = await fetch(`${API}/api/webauthn/register/complete`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        student_id: createdStudentId,
        credential: serializeCredential(credential)
      })
    });

    if (!completeRes.ok) {
      const err = await completeRes.json();
      throw new Error(err.detail || 'Server could not verify fingerprint.');
    }

    // ── SUCCESS ──
    setFpUI('✅', 'Fingerprint Registered!',
      'Your fingerprint has been successfully linked to your account. Redirecting to login…',
      '✅ Success', 'rgba(76,175,80,0.8)', false);
    document.getElementById('fp-skip-btn').style.display = 'none';

    setTimeout(() => {
      window.location.href = '/static/pages/index.html';
    }, 2000);

  } catch(e) {
    console.error('WebAuthn error:', e);
    setFpUI('❌', 'Registration Failed',
      `${e.message}. Please try again or skip and register later from your dashboard.`,
      'Failed', 'rgba(239,83,80,0.8)', true);
    document.getElementById('fp-skip-btn').style.display = 'block';
  }
}

// ── Skip biometric ────────────────────────────────────────────────────────────
function skipBiometric() {
  window.location.href = '/static/pages/index.html';
}

// ── Account creation (Step 1 submit) ─────────────────────────────────────────
async function submitStudent() {
  let valid = true;

  const name     = document.getElementById('s-name').value.trim();
  const dept     = document.getElementById('s-dept').value;
  const roll     = document.getElementById('s-roll').value.trim();
  const pw       = document.getElementById('s-pw').value;
  const pw2      = document.getElementById('s-pw2').value;
  const subjects = JSON.parse(document.getElementById('s-subjects').value || '[]');

  ['err-name','err-dept','err-roll','err-roll-dup','err-subjects','err-pw','err-pw2'].forEach(hideErr);
  ['s-name','s-dept','s-roll','s-pw','s-pw2'].forEach(id => document.getElementById(id).classList.remove('error'));

  if (!name)             { markErr('s-name','err-name');   valid = false; }
  if (!dept)             { markErr('s-dept','err-dept');   valid = false; }
  if (!roll)             { markErr('s-roll','err-roll');   valid = false; }
  if (!subjects.length)  { showErr('err-subjects');        valid = false; }
  if (!PW_REGEX.test(pw)){ markErr('s-pw','err-pw');       valid = false; }
  if (pw !== pw2)        { markErr('s-pw2','err-pw2');     valid = false; }

  if (!valid) return;

  document.getElementById('btn-text').style.display = 'none';
  document.getElementById('btn-spin').style.display = 'inline-block';

  try {
    const res  = await fetch(`${API}/api/register/student`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, department: dept, roll_number: roll, subjects, password: pw })
    });
    const data = await res.json();

    if (res.status === 409) {
      showErr('err-roll-dup');
      markErr('s-roll','err-roll-dup');
      return;
    } else if (!res.ok) {
      showAlert(data.detail || 'Registration failed.');
      return;
    }

    // Account created — store student ID and move to Step 2
    createdStudentId = data.id;
    showBiometricStep();

  } catch(e) {
    showAlert('Server error. Please try again.');
  } finally {
    document.getElementById('btn-text').style.display = 'inline';
    document.getElementById('btn-spin').style.display = 'none';
  }
}
