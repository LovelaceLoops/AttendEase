// register_student.js

const API = '';

// --- Password validation
const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

// --- Tag input
let enrolledSubjects = [];

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

// --- Show/hide error helpers
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

// ── WebAuthn helpers ──────────────────────────────────────────────────────────

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function b64urlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert the server options so the browser's WebAuthn API can understand them
function prepareRegistrationOptions(options) {
  options.challenge = b64urlDecode(options.challenge);
  options.user.id   = b64urlDecode(options.user.id);
  if (options.excludeCredentials) {
    options.excludeCredentials = options.excludeCredentials.map(c => ({
      ...c, id: b64urlDecode(c.id)
    }));
  }
  return options;
}

// Convert the browser credential response back to JSON-safe format for the server
function serializeCredential(credential) {
  return {
    id:    credential.id,
    rawId: b64urlEncode(credential.rawId),
    type:  credential.type,
    response: {
      clientDataJSON:    b64urlEncode(credential.response.clientDataJSON),
      attestationObject: b64urlEncode(credential.response.attestationObject),
    }
  };
}

// ── Main WebAuthn registration flow ──────────────────────────────────────────

async function registerBiometric(studentId) {
  // Check browser support
  if (!window.PublicKeyCredential) {
    showAlert('Your browser does not support biometric authentication. Please use Chrome on Android or Safari on iPhone.', 'error');
    return false;
  }

  showAlert('📲 Setting up biometric… Please follow your device prompt.', 'info');

  try {
    // Step 1: Get options from server
    const beginRes = await fetch(`${API}/api/webauthn/register/begin`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ student_id: studentId })
    });

    if (!beginRes.ok) {
      const err = await beginRes.json();
      throw new Error(err.detail || 'Could not start biometric registration.');
    }

    const options = await beginRes.json();

    // Step 2: Ask device to create a credential (triggers fingerprint/face prompt)
    let credential;
    try {
      credential = await navigator.credentials.create({
        publicKey: prepareRegistrationOptions(options)
      });
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        showAlert('Biometric prompt was cancelled or timed out. You can register your fingerprint later from the dashboard.', 'error');
      } else {
        showAlert(`Biometric setup failed: ${e.message}`, 'error');
      }
      return false;
    }

    // Step 3: Send the credential to server for verification and storage
    const completeRes = await fetch(`${API}/api/webauthn/register/complete`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        student_id: studentId,
        credential: serializeCredential(credential)
      })
    });

    if (!completeRes.ok) {
      const err = await completeRes.json();
      throw new Error(err.detail || 'Server could not verify biometric.');
    }

    showAlert('✅ Biometric registered! Redirecting to login…', 'success');
    return true;

  } catch (e) {
    console.error('WebAuthn registration error:', e);
    showAlert(`Biometric registration failed: ${e.message}`, 'error');
    return false;
  }
}

// ── Account creation + biometric enrollment ───────────────────────────────────

async function submitStudent() {
  let valid = true;

  const name     = document.getElementById('s-name').value.trim();
  const dept     = document.getElementById('s-dept').value;
  const roll     = document.getElementById('s-roll').value.trim();
  const pw       = document.getElementById('s-pw').value;
  const pw2      = document.getElementById('s-pw2').value;
  const subjects = JSON.parse(document.getElementById('s-subjects').value || '[]');

  // Clear errors
  ['err-name','err-dept','err-roll','err-roll-dup','err-subjects','err-pw','err-pw2'].forEach(hideErr);
  ['s-name','s-dept','s-roll','s-pw','s-pw2'].forEach(id => document.getElementById(id).classList.remove('error'));

  if (!name)             { markErr('s-name','err-name');   valid = false; }
  if (!dept)             { markErr('s-dept','err-dept');   valid = false; }
  if (!roll)             { markErr('s-roll','err-roll');   valid = false; }
  if (!subjects.length)  { showErr('err-subjects');        valid = false; }
  if (!PW_REGEX.test(pw)){ markErr('s-pw','err-pw');       valid = false; }
  if (pw !== pw2)        { markErr('s-pw2','err-pw2');     valid = false; }

  if (!valid) return;

  // Loading state
  document.getElementById('btn-text').style.display = 'none';
  document.getElementById('btn-spin').style.display = 'inline-block';

  try {
    // ── Step 1: Create account ──────────────────────────────────────────────
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

    // Account created — data.id is the student UUID
    const studentId = data.id;
    showAlert('✅ Account created! Now setting up biometric authentication…', 'success');

    // ── Step 2: Enroll biometric ────────────────────────────────────────────
    // Small delay so the success message is readable before the system prompt
    await new Promise(r => setTimeout(r, 1200));
    const biometricOk = await registerBiometric(studentId);

    // Whether biometric succeeded or not, account is created — redirect to login
    await new Promise(r => setTimeout(r, biometricOk ? 1500 : 3000));
    window.location.href = '/static/pages/index.html';

  } catch(e) {
    showAlert('Server error. Please try again.');
  } finally {
    document.getElementById('btn-text').style.display = 'inline';
    document.getElementById('btn-spin').style.display = 'none';
  }
}
