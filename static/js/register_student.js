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
  el.className = `alert alert-${type} show`;
  el.style.display = 'block';
  el.style.opacity = '1';
  el.innerHTML = (type==='error' ? '❌ ' : '✅ ') + msg;
  if (type !== 'error') setTimeout(() => { el.className = 'alert'; }, 5000);
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

  // Success — show message and redirect
  showAlert('✅ Account created! Redirecting to login…', 'success');
  setTimeout(() => {
    window.location.href = '/static/pages/index.html';
  }, 2000);

}
