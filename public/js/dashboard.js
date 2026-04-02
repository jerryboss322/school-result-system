// ============================================================
// DASHBOARD.JS — Staff Dashboard Client Logic
// ============================================================

// ── Auth Guard ────────────────────────────────────────────
const token = localStorage.getItem('srms_token');
const staff = JSON.parse(localStorage.getItem('srms_staff') || '{}');

if (!token) { window.location.href = '/login'; }

document.getElementById('staffName').textContent    = staff.name || 'Staff';
document.getElementById('staffInitials').textContent =
  (staff.name || 'S').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

function logout() {
  localStorage.removeItem('srms_token');
  localStorage.removeItem('srms_staff');
  window.location.href = '/login';
}

// ── API Helper ────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch('/api' + path, opts);
  const data = await res.json();
  if (res.status === 401) { logout(); }
  return { ok: res.ok, ...data };
}

// ── Page Navigation ───────────────────────────────────────
function showPage(pageName, btn) {
  // Update sidebar active
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Show/hide sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById('page-' + pageName);
  if (target) { target.classList.remove('hidden'); target.classList.add('animate-in'); }

  // Page-specific init
  if (pageName === 'overview')  loadStats();
  if (pageName === 'students')  loadStudents();
  if (pageName === 'pin-list')  loadPinList();
}

// ── Load Stats ────────────────────────────────────────────
async function loadStats() {
  try {
    const [s, r, p] = await Promise.all([
      api('GET', '/students?limit=1'),
      fetch('/api/results?student_id=0&term=&session=', {headers:{'Authorization':'Bearer '+token}}).then(()=>({})),
      api('GET', '/pins')
    ]);
    document.getElementById('statStudents').textContent  = s.total ?? '—';
    document.getElementById('statPins').textContent      = p.data?.length ?? '—';
    document.getElementById('statPublished').textContent = p.data?.filter(x=>x.used).length ?? '—';
    document.getElementById('statResults').textContent   = p.data?.length > 0 ? p.data.length + '+' : '—';
  } catch(e) {}
}

// ── Students ──────────────────────────────────────────────
let searchTimer;
function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadStudents, 400);
}

async function loadStudents() {
  const cls    = document.getElementById('filterClass')?.value || '';
  const search = document.getElementById('searchStudents')?.value || '';
  const wrap   = document.getElementById('studentsTableWrapper');
  wrap.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> Loading…</div>';

  const params = new URLSearchParams();
  if (cls)    params.set('class', cls);
  if (search) params.set('search', search);
  params.set('limit', '100');

  const data = await api('GET', '/students?' + params);

  if (!data.ok || !data.data?.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">👥</div>
      <h3>No students found</h3>
      <p>${search || cls ? 'Try adjusting your filters.' : 'Add your first student to get started.'}</p>
    </div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Student Code</th><th>Full Name</th><th>Class</th>
          <th>Added By</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data.data.map(s => `
          <tr>
            <td><span class="badge badge-grey">${s.student_code}</span></td>
            <td>
              <strong>${s.last_name}, ${s.first_name}</strong>
              ${s.middle_name ? `<span class="text-muted text-sm"> ${s.middle_name}</span>` : ''}
            </td>
            <td><span class="badge badge-gold">${s.class}</span></td>
            <td class="text-muted text-sm">${s.added_by}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick='openEditStudentModal(${JSON.stringify(s)})'>Edit</button>
              <button class="btn btn-ghost btn-sm" onclick="quickEnterResults(${s.id}, '${s.class}', '${s.first_name} ${s.last_name}')">Results</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="padding:12px 16px; font-size:.78rem; color:var(--text-muted); border-top:1px solid var(--border);">
      Showing ${data.data.length} of ${data.total} students
    </div>`;
}

// ── Quick jump to results entry for a student
function quickEnterResults(id, cls, name) {
  document.getElementById('er_class').value = cls;
  onErClassChange(id);
  showPage('enter-results', document.querySelector('[data-page=enter-results]'));
}

// ── Add Student Modal ─────────────────────────────────────
function openAddStudentModal() {
  document.getElementById('as_first').value  = '';
  document.getElementById('as_middle').value = '';
  document.getElementById('as_last').value   = '';
  document.getElementById('as_class').value  = '';
  document.getElementById('addStudentMsg').innerHTML = '';
  openModal('addStudentModal');
}

async function addStudent() {
  const btn  = document.getElementById('addStudentBtn');
  const msg  = document.getElementById('addStudentMsg');
  const body = {
    first_name:  document.getElementById('as_first').value.trim(),
    middle_name: document.getElementById('as_middle').value.trim(),
    last_name:   document.getElementById('as_last').value.trim(),
    class:       document.getElementById('as_class').value
  };
  if (!body.first_name || !body.last_name || !body.class) {
    msg.innerHTML = '<div class="alert alert-error">First name, last name and class are required.</div>';
    return;
  }

  btn.disabled = true; btn.textContent = 'Adding…';
  const data = await api('POST', '/students', body);
  btn.disabled = false; btn.textContent = '➕ Add Student';

  if (data.success) {
    msg.innerHTML = `<div class="alert alert-success">✅ Student added! Code: <strong>${data.student_code}</strong></div>`;
    loadStudents();
    setTimeout(() => closeModal('addStudentModal'), 1800);
  } else {
    msg.innerHTML = `<div class="alert alert-error">${data.message}</div>`;
  }
}

// Edit student (simple inline modal reuse)
function openEditStudentModal(s) {
  document.getElementById('as_first').value  = s.first_name;
  document.getElementById('as_middle').value = s.middle_name || '';
  document.getElementById('as_last').value   = s.last_name;
  document.getElementById('as_class').value  = s.class;
  document.getElementById('addStudentMsg').innerHTML = '';
  document.querySelector('#addStudentModal .modal-title').textContent = 'Edit Student';

  const btn   = document.getElementById('addStudentBtn');
  btn.textContent = '💾 Save Changes';
  btn.onclick = async () => {
    const body = {
      first_name:  document.getElementById('as_first').value.trim(),
      middle_name: document.getElementById('as_middle').value.trim(),
      last_name:   document.getElementById('as_last').value.trim(),
      class:       document.getElementById('as_class').value
    };
    btn.disabled = true;
    const data = await api('PUT', '/students/' + s.id, body);
    btn.disabled = false;
    if (data.success) {
      document.getElementById('addStudentMsg').innerHTML = '<div class="alert alert-success">✅ Student updated.</div>';
      loadStudents();
      setTimeout(() => {
        closeModal('addStudentModal');
        // Reset modal
        document.querySelector('#addStudentModal .modal-title').textContent = 'Add New Student';
        btn.textContent = '➕ Add Student';
        btn.onclick = addStudent;
      }, 1500);
    } else {
      document.getElementById('addStudentMsg').innerHTML = `<div class="alert alert-error">${data.message}</div>`;
    }
  };
  openModal('addStudentModal');
}

// ── Enter Results ─────────────────────────────────────────
async function onErClassChange(preSelectId) {
  const cls = document.getElementById('er_class').value;
  const sel = document.getElementById('er_student');
  sel.innerHTML = '<option value="">Loading…</option>';

  if (!cls) { sel.innerHTML = '<option value="">— Select Class First —</option>'; return; }

  const data = await api('GET', '/students?class=' + cls + '&limit=200');
  sel.innerHTML = '<option value="">— Select Student —</option>';
  (data.data || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.last_name}, ${s.first_name} (${s.student_code})`;
    if (preSelectId && s.id == preSelectId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function onErStudentChange() {} // placeholder for future use

async function loadSubjectsForEntry() {
  const cls     = document.getElementById('er_class').value;
  const stdId   = document.getElementById('er_student').value;
  const term    = document.getElementById('er_term').value;
  const session = document.getElementById('er_session').value.trim();

  if (!cls)     { showErMsg('Please select a class.', 'error'); return; }
  if (!stdId)   { showErMsg('Please select a student.', 'error'); return; }
  if (!session || !/^\d{4}\/\d{4}$/.test(session)) {
    showErMsg('Please enter session in format YYYY/YYYY (e.g. 2024/2025).', 'error'); return;
  }

  const subjectsData = await api('GET', '/results/subjects?class=' + cls);
  if (!subjectsData.success) { showErMsg('Failed to load subjects.', 'error'); return; }

  // Also try to load existing results
  const existing = await api('GET', `/results?student_id=${stdId}&term=${term}&session=${session}`);
  const existingMap = {};
  (existing.data || []).forEach(r => { existingMap[r.subject_id] = r; });

  const tbody = document.getElementById('scoreTableBody');
  tbody.innerHTML = '';

  subjectsData.data.forEach(sub => {
    const ex = existingMap[sub.id];
    const ca   = ex ? ex.ca_score   : '';
    const exam = ex ? ex.exam_score : '';
    const total = ex ? ex.total  : '—';
    const grade = ex ? ex.grade  : '—';
    const rid   = ex ? ex.id     : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${sub.name}</strong></td>
      <td>
        <input type="number" class="form-control ca-input" data-subject="${sub.id}" data-rid="${rid}"
          min="0" max="40" step="0.5" value="${ca}" placeholder="0–40"
          onchange="calcRowTotal(this)">
      </td>
      <td>
        <input type="number" class="form-control exam-input" data-subject="${sub.id}"
          min="0" max="60" step="0.5" value="${exam}" placeholder="0–60"
          onchange="calcRowTotal(this)">
      </td>
      <td class="total-cell" id="total_${sub.id}">${total}</td>
      <td><span class="badge" id="grade_${sub.id}" style="${gradeStyle(grade)}">${grade}</span></td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('er_subjects_section').classList.remove('hidden');
  document.getElementById('er_message').innerHTML = '';
}

function calcRowTotal(input) {
  const subId = input.dataset.subject;
  const row   = input.closest('tr');
  const ca    = parseFloat(row.querySelector('.ca-input').value) || 0;
  const exam  = parseFloat(row.querySelector('.exam-input').value) || 0;
  const total = ca + exam;
  document.getElementById('total_' + subId).textContent = total.toFixed(1);
  const grade = calcGrade(total);
  const gb = document.getElementById('grade_' + subId);
  gb.textContent = grade;
  gb.style.cssText = gradeStyle(grade);
}

function calcGrade(total) {
  if (total >= 70) return 'A';
  if (total >= 60) return 'B';
  if (total >= 50) return 'C';
  if (total >= 45) return 'D';
  if (total >= 40) return 'E';
  return 'F';
}
function gradeStyle(g) {
  const m = {A:'background:#e8f5e9;color:#2e7d32;',B:'background:#e3f2fd;color:#1565c0;',C:'background:#fff3e0;color:#e65100;',D:'background:#fce4ec;color:#c62828;',E:'background:#f3e5f5;color:#6a1b9a;',F:'background:#fdeaea;color:#b71c1c;'};
  return (m[g] || '') + 'padding:2px 8px;border-radius:100px;font-size:.72rem;font-weight:700;';
}

async function saveResults() {
  const stdId   = document.getElementById('er_student').value;
  const term    = document.getElementById('er_term').value;
  const session = document.getElementById('er_session').value.trim();
  const btn     = document.getElementById('saveResultsBtn');

  const rows = document.querySelectorAll('#scoreTableBody tr');
  const results = [];

  rows.forEach(tr => {
    const ca    = tr.querySelector('.ca-input');
    const exam  = tr.querySelector('.exam-input');
    const subId = ca.dataset.subject;
    const caVal = ca.value.trim();
    const exVal = exam.value.trim();
    if (caVal !== '' || exVal !== '') {
      results.push({ subject_id: subId, ca_score: caVal || 0, exam_score: exVal || 0 });
    }
  });

  if (!results.length) { showErMsg('Please enter at least one result.', 'error'); return; }

  btn.disabled = true; btn.textContent = '💾 Saving…';
  const data = await api('POST', '/results', { student_id: stdId, term, session, results });
  btn.disabled = false; btn.textContent = '💾 Save Results';

  if (data.success) {
    showErMsg('✅ ' + data.message, 'success');
    // Reload to show updated data
    setTimeout(loadSubjectsForEntry, 800);
  } else {
    showErMsg('⚠ ' + data.message, 'error');
  }
}

function showErMsg(msg, type) {
  document.getElementById('er_message').innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

function clearScores() {
  document.querySelectorAll('#scoreTableBody .ca-input, #scoreTableBody .exam-input').forEach(i => { i.value = ''; });
  document.querySelectorAll('[id^=total_]').forEach(el => el.textContent = '—');
  document.querySelectorAll('[id^=grade_]').forEach(el => { el.textContent = '—'; el.style.cssText = ''; });
}

// ── Manage Results ────────────────────────────────────────
async function onMrClassChange() {
  const cls = document.getElementById('mr_class').value;
  const sel = document.getElementById('mr_student');
  sel.innerHTML = '<option value="">Loading…</option>';
  if (!cls) { sel.innerHTML = '<option value="">— Select Class First —</option>'; return; }
  const data = await api('GET', '/students?class=' + cls + '&limit=200');
  sel.innerHTML = '<option value="">— Select Student —</option>';
  (data.data || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.last_name}, ${s.first_name} (${s.student_code})`;
    sel.appendChild(opt);
  });
}

async function loadExistingResults() {
  const stdId   = document.getElementById('mr_student').value;
  const term    = document.getElementById('mr_term').value;
  const session = document.getElementById('mr_session').value.trim();

  if (!stdId || !session) { return; }

  const data = await api('GET', `/results?student_id=${stdId}&term=${term}&session=${session}`);
  const wrap = document.getElementById('mr_tableWrapper');
  const sec  = document.getElementById('mr_results_section');
  sec.classList.remove('hidden');

  if (!data.ok || !data.data?.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>No results found</h3><p>Enter results first.</p></div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Status</th><th>Action</th></tr>
      </thead>
      <tbody>
        ${data.data.map(r => `
          <tr id="mr_row_${r.id}">
            <td><strong>${r.subject_name}</strong></td>
            <td><input type="number" class="form-control" id="mr_ca_${r.id}" value="${r.ca_score}" min="0" max="40" style="width:75px;padding:5px 8px;" ${r.published?'disabled':''}></td>
            <td><input type="number" class="form-control" id="mr_ex_${r.id}" value="${r.exam_score}" min="0" max="60" style="width:75px;padding:5px 8px;" ${r.published?'disabled':''}></td>
            <td class="total-cell">${parseFloat(r.total).toFixed(1)}</td>
            <td><span class="badge" style="${gradeStyle(r.grade)}">${r.grade}</span></td>
            <td>${r.published ? '<span class="badge badge-green">Published</span>' : '<span class="badge badge-grey">Draft</span>'}</td>
            <td>
              ${!r.published ? `
                <button class="btn btn-outline btn-sm" onclick="updateResult(${r.id})">Save</button>
                <button class="btn btn-danger btn-sm" onclick="deleteResult(${r.id})">Del</button>
              ` : '—'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

async function updateResult(id) {
  const ca   = document.getElementById('mr_ca_' + id).value;
  const exam = document.getElementById('mr_ex_' + id).value;
  const data = await api('PUT', '/results/' + id, { ca_score: ca, exam_score: exam });
  const msg  = document.getElementById('mr_message');
  if (data.success) {
    msg.innerHTML = `<div class="alert alert-success">✅ Updated — Total: ${data.total}, Grade: ${data.grade}</div>`;
    setTimeout(loadExistingResults, 1000);
  } else {
    msg.innerHTML = `<div class="alert alert-error">${data.message}</div>`;
  }
}

async function deleteResult(id) {
  if (!confirm('Delete this result entry?')) return;
  const data = await api('DELETE', '/results/' + id);
  if (data.success) { loadExistingResults(); }
  else { alert(data.message); }
}

// ── Generate PIN ──────────────────────────────────────────
async function onGpClassChange() {
  const cls = document.getElementById('gp_class').value;
  const sel = document.getElementById('gp_student');
  sel.innerHTML = '<option value="">Loading…</option>';
  if (!cls) { sel.innerHTML = '<option value="">— Select Class First —</option>'; return; }
  const data = await api('GET', '/students?class=' + cls + '&limit=200');
  sel.innerHTML = '<option value="">— Select Student —</option>';
  (data.data || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.last_name}, ${s.first_name} (${s.student_code})`;
    sel.appendChild(opt);
  });
}

async function generatePin() {
  const stdId   = document.getElementById('gp_student').value;
  const term    = document.getElementById('gp_term').value;
  const session = document.getElementById('gp_session').value.trim();
  const msg     = document.getElementById('gp_message');

  if (!stdId || !session) {
    msg.innerHTML = '<div class="alert alert-error">Please fill all fields.</div>'; return;
  }

  msg.innerHTML = '<div class="loading-overlay" style="padding:12px;"><span class="spinner"></span> Generating…</div>';

  const data = await api('POST', '/pins/generate', { student_id: stdId, term, session });

  if (data.success) {
    msg.innerHTML = `<div class="alert alert-success">✅ ${data.message}</div>`;
    document.getElementById('gp_pin_code').textContent = data.pin;
    document.getElementById('gp_pin_meta').textContent =
      `${data.student?.first_name} ${data.student?.last_name} • ${term} Term • ${session}`;
    document.getElementById('gp_pin_display').classList.remove('hidden');
  } else {
    msg.innerHTML = `<div class="alert alert-error">⚠ ${data.message}</div>`;
  }
}

function copyPin() {
  const pin = document.getElementById('gp_pin_code').textContent;
  navigator.clipboard.writeText(pin).then(() => {
    const btn = event.target;
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy PIN', 2000);
  });
}

// ── PIN List ──────────────────────────────────────────────
async function loadPinList() {
  const wrap = document.getElementById('pinListWrapper');
  wrap.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> Loading…</div>';

  const data = await api('GET', '/pins');
  if (!data.ok || !data.data?.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔑</div><h3>No PINs generated yet</h3></div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>PIN</th><th>Student</th><th>Class</th><th>Term</th><th>Session</th><th>Status</th><th>Generated</th></tr>
      </thead>
      <tbody>
        ${data.data.map(p => `
          <tr>
            <td><code style="font-family:monospace;font-weight:700;color:var(--gold-dark);letter-spacing:.05em;">${p.pin}</code></td>
            <td>${p.last_name}, ${p.first_name}</td>
            <td><span class="badge badge-gold">${p.class}</span></td>
            <td>${p.term}</td>
            <td>${p.session}</td>
            <td>${p.used
              ? '<span class="badge badge-green">Used</span>'
              : '<span class="badge badge-grey">Unused</span>'}</td>
            <td class="text-sm text-muted">${new Date(p.created_at).toLocaleDateString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

// (staff management moved to admin section below)

// ── Modal Helpers ─────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}
// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); });
});
// ESC key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(o => closeModal(o.id));
});

// ── Set default session ───────────────────────────────────
(function setDefaultSession() {
  const year = new Date().getFullYear();
  const session = `${year}/${year + 1}`;
  ['er_session', 'gp_session', 'mr_session'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = session;
  });
})();

// ── Initial Page Load ─────────────────────────────────────
loadStats();

// ════════════════════════════════════════════════════════════
// SUBJECTS MANAGEMENT
// ════════════════════════════════════════════════════════════

const CATEGORY_LABELS = {
  all:     { label: 'All Levels',      style: 'badge-gold'  },
  primary: { label: 'Primary',         style: 'badge-pink'  },
  junior:  { label: 'Junior Secondary', style: 'badge-grey' },
  senior:  { label: 'Senior Secondary', style: 'background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;' }
};

async function loadSubjects() {
  const wrap = document.getElementById('subjectsTableWrapper');
  wrap.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> Loading subjects…</div>';

  const data = await api('GET', '/subjects');

  if (!data.ok || !data.data?.length) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📚</div>
      <h3>No subjects yet</h3>
      <p>Add your first subject using the button above.</p>
    </div>`;
    return;
  }

  // Group by category for the summary count
  const grouped = { all: 0, primary: 0, junior: 0, senior: 0 };
  data.data.forEach(s => { if (grouped[s.category] !== undefined) grouped[s.category]++; });

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Subject Name</th>
          <th>Level / Category</th>
          <th style="text-align:right;padding-right:20px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data.data.map((s, i) => {
          const cat = CATEGORY_LABELS[s.category] || { label: s.category, style: 'badge-grey' };
          const badgeStyle = cat.style.includes(':')
            ? `style="${cat.style}padding:3px 10px;border-radius:100px;font-size:.72rem;font-weight:700;letter-spacing:.04em;"`
            : `class="badge ${cat.style}"`;
          return `
          <tr id="subj-row-${s.id}">
            <td class="text-muted text-sm">${i + 1}</td>
            <td><strong>${s.name}</strong></td>
            <td><span ${badgeStyle}>${cat.label}</span></td>
            <td style="text-align:right;padding-right:16px;">
              <div class="d-flex gap-8" style="justify-content:flex-end;">
                <button class="btn btn-outline btn-sm" onclick='openEditSubjectModal(${JSON.stringify(s)})'>
                  ✏️ Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteSubject(${s.id}, '${s.name.replace(/'/g,"\\'")}')">
                  🗑 Delete
                </button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="padding:10px 16px;font-size:.78rem;color:var(--text-muted);border-top:1px solid var(--border);display:flex;gap:16px;flex-wrap:wrap;">
      <span>Total: <strong>${data.data.length}</strong></span>
      <span>All levels: <strong>${grouped.all}</strong></span>
      <span>Primary: <strong>${grouped.primary}</strong></span>
      <span>Junior: <strong>${grouped.junior}</strong></span>
      <span>Senior: <strong>${grouped.senior}</strong></span>
    </div>`;
}

// ── Open modal to ADD a subject ───────────────────────────────
function openSubjectModal() {
  document.getElementById('subjectModalTitle').textContent = 'Add Subject';
  document.getElementById('sub_name').value        = '';
  document.getElementById('sub_category').value    = 'all';
  document.getElementById('subjectModalMsg').innerHTML = '';
  document.getElementById('subjectModalBtn').textContent = '➕ Add Subject';
  document.getElementById('subjectModalBtn').onclick = submitSubjectModal;
  openModal('subjectModal');
  setTimeout(() => document.getElementById('sub_name').focus(), 100);
}

// ── Open modal to EDIT a subject ──────────────────────────────
function openEditSubjectModal(subject) {
  document.getElementById('subjectModalTitle').textContent  = 'Edit Subject';
  document.getElementById('sub_name').value      = subject.name;
  document.getElementById('sub_category').value  = subject.category;
  document.getElementById('subjectModalMsg').innerHTML = '';
  document.getElementById('subjectModalBtn').textContent = '💾 Save Changes';
  document.getElementById('subjectModalBtn').onclick = () => updateSubject(subject.id);
  openModal('subjectModal');
  setTimeout(() => document.getElementById('sub_name').focus(), 100);
}

// ── Submit (add) ──────────────────────────────────────────────
async function submitSubjectModal() {
  const name     = document.getElementById('sub_name').value.trim();
  const category = document.getElementById('sub_category').value;
  const msg      = document.getElementById('subjectModalMsg');
  const btn      = document.getElementById('subjectModalBtn');

  if (!name) {
    msg.innerHTML = '<div class="alert alert-error">Subject name is required.</div>';
    return;
  }

  btn.disabled = true; btn.textContent = 'Adding…';
  const data = await api('POST', '/subjects', { name, category });
  btn.disabled = false; btn.textContent = '➕ Add Subject';

  if (data.success) {
    msg.innerHTML = '<div class="alert alert-success">✅ Subject added successfully.</div>';
    loadSubjects();
    setTimeout(() => {
      closeModal('subjectModal');
      showSubjectsMsg('✅ Subject added.', 'success');
    }, 900);
  } else {
    msg.innerHTML = `<div class="alert alert-error">⚠ ${data.message}</div>`;
  }
}

// ── Update ────────────────────────────────────────────────────
async function updateSubject(id) {
  const name     = document.getElementById('sub_name').value.trim();
  const category = document.getElementById('sub_category').value;
  const msg      = document.getElementById('subjectModalMsg');
  const btn      = document.getElementById('subjectModalBtn');

  if (!name) {
    msg.innerHTML = '<div class="alert alert-error">Subject name is required.</div>';
    return;
  }

  btn.disabled = true; btn.textContent = 'Saving…';
  const data = await api('PUT', '/subjects/' + id, { name, category });
  btn.disabled = false; btn.textContent = '💾 Save Changes';

  if (data.success) {
    msg.innerHTML = '<div class="alert alert-success">✅ Subject updated.</div>';
    loadSubjects();
    setTimeout(() => {
      closeModal('subjectModal');
      showSubjectsMsg('✅ Subject updated.', 'success');
    }, 900);
  } else {
    msg.innerHTML = `<div class="alert alert-error">⚠ ${data.message}</div>`;
  }
}

// ── Delete ────────────────────────────────────────────────────
async function deleteSubject(id, name) {
  const confirmed = confirm(`Delete subject "${name}"?\n\nThis cannot be undone. Subjects with existing results cannot be deleted.`);
  if (!confirmed) return;

  const data = await api('DELETE', '/subjects/' + id);

  if (data.success) {
    // Animate row out
    const row = document.getElementById('subj-row-' + id);
    if (row) {
      row.style.transition = 'opacity .3s, transform .3s';
      row.style.opacity    = '0';
      row.style.transform  = 'translateX(20px)';
      setTimeout(() => loadSubjects(), 350);
    }
    showSubjectsMsg('🗑 Subject deleted.', 'success');
  } else {
    showSubjectsMsg('⚠ ' + data.message, 'error');
  }
}

function showSubjectsMsg(text, type) {
  const el = document.getElementById('subjects-message');
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}" style="margin-bottom:16px;">${text}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}

// ── Hook into page navigation ─────────────────────────────────
const _origShowPage = showPage;
// Override showPage to trigger loadSubjects when that tab is opened
const origShowPage = showPage;
window.showPage = function(pageName, btn) {
  origShowPage(pageName, btn);
  if (pageName === 'subjects') loadSubjects();
};

// ════════════════════════════════════════════════════════════
// STAFF MANAGEMENT (ADMIN ONLY)
// ════════════════════════════════════════════════════════════

/**
 * Show/hide admin-only UI elements based on the logged-in role.
 * Called once on page load.
 */
function applyRoleUI() {
  if (staff.role === 'admin') {
    document.getElementById('sidebar-staff-section').style.display = '';
    document.getElementById('sidebar-staff-btn').style.display     = '';
  }
}
applyRoleUI();

// ── Load staff table ──────────────────────────────────────────
async function loadStaffList() {
  const wrap = document.getElementById('staffTableWrapper');
  wrap.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> Loading…</div>';

  const data = await api('GET', '/staff');

  if (!data.ok) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⛔</div><h3>${data.message || 'Access denied.'}</h3></div>`;
    return;
  }
  if (!data.data?.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No staff found.</h3></div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th style="text-align:right;padding-right:16px;">Actions</th></tr>
      </thead>
      <tbody>
        ${data.data.map(s => {
          const isSelf = s.id === staff.id;
          const roleBadge = s.role === 'admin'
            ? '<span class="badge badge-pink">Admin</span>'
            : '<span class="badge badge-grey">Staff</span>';
          return `
          <tr id="stf-row-${s.id}">
            <td>
              <strong>${s.name}</strong>
              ${isSelf ? '<span class="badge badge-gold" style="margin-left:6px;font-size:.65rem;">You</span>' : ''}
            </td>
            <td class="text-muted">${s.email}</td>
            <td>${roleBadge}</td>
            <td class="text-sm text-muted">${new Date(s.created_at).toLocaleDateString()}</td>
            <td style="text-align:right;padding-right:16px;">
              <div class="d-flex gap-8" style="justify-content:flex-end;">
                <button class="btn btn-outline btn-sm" onclick='openEditStaffModal(${JSON.stringify(s)})'>✏️ Edit</button>
                ${isSelf ? '' : `<button class="btn btn-danger btn-sm" onclick="deleteStaff(${s.id}, '${s.name.replace(/'/g,"\\'")}')">🗑 Delete</button>`}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="padding:10px 16px;font-size:.78rem;color:var(--text-muted);border-top:1px solid var(--border);">
      ${data.data.length} staff member(s) total
    </div>`;
}

// ── Open modal to ADD staff ───────────────────────────────────
function openStaffModal() {
  document.getElementById('staffModalTitle').textContent    = 'Add Staff Member';
  document.getElementById('stf_name').value                = '';
  document.getElementById('stf_email').value               = '';
  document.getElementById('stf_password').value            = '';
  document.getElementById('stf_role').value                = 'staff';
  document.getElementById('stf_password_label').textContent = 'Password *';
  document.getElementById('stf_password_hint').textContent  = '';
  document.getElementById('stf_password').placeholder       = 'Min. 8 characters';
  document.getElementById('stf_password').required          = true;
  document.getElementById('staffModalMsg').innerHTML        = '';
  document.getElementById('staffModalBtn').textContent      = '➕ Create Account';
  document.getElementById('staffModalBtn').onclick          = submitCreateStaff;
  openModal('staffModal');
  setTimeout(() => document.getElementById('stf_name').focus(), 100);
}

// ── Open modal to EDIT staff ──────────────────────────────────
function openEditStaffModal(s) {
  document.getElementById('staffModalTitle').textContent    = 'Edit Staff Member';
  document.getElementById('stf_name').value                = s.name;
  document.getElementById('stf_email').value               = s.email;
  document.getElementById('stf_password').value            = '';
  document.getElementById('stf_role').value                = s.role;
  document.getElementById('stf_password_label').textContent = 'New Password';
  document.getElementById('stf_password_hint').textContent  = 'Leave blank to keep the current password.';
  document.getElementById('stf_password').placeholder       = 'Leave blank to keep current';
  document.getElementById('stf_password').required          = false;
  document.getElementById('staffModalMsg').innerHTML        = '';
  document.getElementById('staffModalBtn').textContent      = '💾 Save Changes';
  document.getElementById('staffModalBtn').onclick          = () => submitEditStaff(s.id);
  openModal('staffModal');
  setTimeout(() => document.getElementById('stf_name').focus(), 100);
}

// ── Create ────────────────────────────────────────────────────
async function submitCreateStaff() {
  const name     = document.getElementById('stf_name').value.trim();
  const email    = document.getElementById('stf_email').value.trim();
  const password = document.getElementById('stf_password').value;
  const role     = document.getElementById('stf_role').value;
  const msg      = document.getElementById('staffModalMsg');
  const btn      = document.getElementById('staffModalBtn');

  if (!name || !email || !password) {
    msg.innerHTML = '<div class="alert alert-error">All fields are required.</div>'; return;
  }
  if (password.length < 8) {
    msg.innerHTML = '<div class="alert alert-error">Password must be at least 8 characters.</div>'; return;
  }

  btn.disabled = true; btn.textContent = 'Creating…';
  const data = await api('POST', '/staff', { name, email, password, role });
  btn.disabled = false; btn.textContent = '➕ Create Account';

  if (data.success) {
    msg.innerHTML = '<div class="alert alert-success">✅ Staff account created.</div>';
    loadStaffList();
    setTimeout(() => { closeModal('staffModal'); showStaffMsg('✅ Staff account created.', 'success'); }, 1000);
  } else {
    msg.innerHTML = `<div class="alert alert-error">⚠ ${data.message}</div>`;
  }
}

// ── Edit ──────────────────────────────────────────────────────
async function submitEditStaff(id) {
  const name     = document.getElementById('stf_name').value.trim();
  const email    = document.getElementById('stf_email').value.trim();
  const password = document.getElementById('stf_password').value;
  const role     = document.getElementById('stf_role').value;
  const msg      = document.getElementById('staffModalMsg');
  const btn      = document.getElementById('staffModalBtn');

  if (!name || !email) {
    msg.innerHTML = '<div class="alert alert-error">Name and email are required.</div>'; return;
  }
  if (password && password.length < 8) {
    msg.innerHTML = '<div class="alert alert-error">New password must be at least 8 characters.</div>'; return;
  }

  btn.disabled = true; btn.textContent = 'Saving…';
  const body = { name, email, role };
  if (password) body.password = password;
  const data = await api('PUT', '/staff/' + id, body);
  btn.disabled = false; btn.textContent = '💾 Save Changes';

  if (data.success) {
    msg.innerHTML = '<div class="alert alert-success">✅ Staff updated.</div>';
    loadStaffList();
    setTimeout(() => { closeModal('staffModal'); showStaffMsg('✅ Staff updated.', 'success'); }, 1000);
  } else {
    msg.innerHTML = `<div class="alert alert-error">⚠ ${data.message}</div>`;
  }
}

// ── Delete ────────────────────────────────────────────────────
async function deleteStaff(id, name) {
  const confirmed = confirm(`Delete staff account for "${name}"?\n\nThis cannot be undone.`);
  if (!confirmed) return;

  const data = await api('DELETE', '/staff/' + id);
  if (data.success) {
    const row = document.getElementById('stf-row-' + id);
    if (row) {
      row.style.transition = 'opacity .3s, transform .3s';
      row.style.opacity    = '0';
      row.style.transform  = 'translateX(20px)';
      setTimeout(() => loadStaffList(), 350);
    }
    showStaffMsg('🗑 Staff account deleted.', 'success');
  } else {
    showStaffMsg('⚠ ' + data.message, 'error');
  }
}

function showStaffMsg(text, type) {
  const el = document.getElementById('staff-page-message');
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${text}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}

// ── Hook page nav ─────────────────────────────────────────────
const _showPageBase = window.showPage;
window.showPage = function(pageName, btn) {
  _showPageBase(pageName, btn);
  if (pageName === 'manage-staff') loadStaffList();
};
