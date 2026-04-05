// register_professor.js

const API = '';
const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

let taughtSubjects = [];

document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('subjects-wrapper');
  const input   = document.getElementById('subject-input');
  const hidden  = document.getElementById('p-subjects');

  function renderTags() {
    wrapper.querySelectorAll('.tag').forEach(t => t.remove());
    taughtSubjects.forEach((tag, i) => {
      const el = document.createElement('div');
      el.className = 'tag';
      el.innerHTML = `<span>${tag}</span><button type="button">×</button>`;
      el.querySelector('button').onclick = () => { taughtSubjects.splice(i,1); renderTags(); };
      wrapper.insertBefore(el, input);
    });
    hidden.value = JSON.stringify(taughtSubjects);
  }

  function addSubject(val) {
    val = val.replace(',','').trim();
    if (!val || taughtSubjects.includes(val)) return;
    taughtSubjects.push(val);
    renderTags();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSubject(input.value);
      input.value = '';
    }
    if (e.key === 'Backspace' && input.value === '' && taughtSubjects.length) {
      taughtSubjects.pop(); renderTags();
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim()) { addSubject(input.value); input.value = ''; }
  });
});

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
  if (type !== 'error') setTimeout(() => el.className = 'alert', 5000);
}

async function submitProfessor() {
  let valid = true;

  const name    = document.getElementById('p-name').value.trim();
  const dept    = document.getElementById('p-dept').value;
  const empid   = document.getElementById('p-empid').value.trim();
  const pw      = document.getElementById('p-pw').value;
  const pw2     = document.getElementById('p-pw2').value;
  const subjects = JSON.parse(document.getElementById('p-subjects').value || '[]');

  ['err-name','err-dept','err-empid','err-empid-dup','err-subjects','err-pw','err-pw2'].forEach(hideErr);
  ['p-name','p-dept','p-empid','p-pw','p-pw2'].forEach(id => document.getElementById(id).classList.remove('error'));

  if (!name)   { markErr('p-name','err-name');   valid = false; }
  if (!dept)   { markErr('p-dept','err-dept');   valid = false; }
  if (!empid)  { markErr('p-empid','err-empid'); valid = false; }
  if (!subjects.length) { showErr('err-subjects'); valid = false; }
  if (!PW_REGEX.test(pw)) { markErr('p-pw','err-pw'); valid = false; }
  if (pw !== pw2) { markErr('p-pw2','err-pw2'); valid = false; }

  if (!valid) return;

  document.getElementById('btn-text').style.display = 'none';
  document.getElementById('btn-spin').style.display = 'inline-block';

  try {
    const res  = await fetch(`${API}/api/register/professor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, department: dept, employee_id: empid, subjects, password: pw })
    });
    const data = await res.json();

    if (res.status === 409) {
      showErr('err-empid-dup');
      markErr('p-empid','err-empid-dup');
    } else if (!res.ok) {
      showAlert(data.detail || 'Registration failed.');
    } else {
      showAlert('Account created! Redirecting to login…', 'success');
      setTimeout(() => window.location.href = '/static/pages/index.html', 1800);
    }
  } catch(e) {
    showAlert('Server error. Please try again.');
  } finally {
    document.getElementById('btn-text').style.display = 'inline';
    document.getElementById('btn-spin').style.display = 'none';
  }
}
