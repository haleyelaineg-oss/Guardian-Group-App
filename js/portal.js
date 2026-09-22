// ============================================================
// GUARDIAN GROUP — portal.js
// Shared boilerplate + per-page logic for the client portal
// (portal/index.html, set-password.html, dashboard.html, certificate.html)
// ============================================================

const pdb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('loginForm'))       initLoginPage();
  if (document.getElementById('setPasswordForm')) initSetPasswordPage();
  if (document.getElementById('dashboard'))       initDashboardPage();
  if (document.getElementById('certificatePage')) initCertificatePage();
});

// ── LOGIN PAGE ──────────────────────────────────────────────
async function initLoginPage() {
  // Already signed in? Skip straight to the dashboard.
  const { data: { session } } = await pdb.auth.getSession();
  if (session) { window.location.href = '/portal/dashboard.html'; return; }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl    = document.getElementById('loginError');
    const btn      = document.getElementById('loginBtn');

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing In...';

    const { error } = await pdb.auth.signInWithPassword({ email, password });

    if (error) {
      errEl.textContent = 'Invalid email or password. Try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In →';
      return;
    }

    window.location.href = '/portal/dashboard.html';
  });

  document.getElementById('forgotBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const errEl = document.getElementById('loginError');
    const successEl = document.getElementById('loginSuccess');
    errEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!email) {
      errEl.textContent = 'Enter your email above first, then click "Forgot your password?"';
      errEl.style.display = 'block';
      return;
    }

    const { error } = await pdb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/portal/set-password.html`
    });

    successEl.textContent = error
      ? 'If that email has a portal account, a reset link is on its way.'
      : 'Check your email for a password reset link.';
    successEl.style.display = 'block';
  });
}

// ── SET PASSWORD PAGE ──────────────────────────────────────
async function initSetPasswordPage() {
  const { data: { session } } = await pdb.auth.getSession();
  const loadingEl = document.getElementById('setPasswordLoading');
  const formEl    = document.getElementById('setPasswordForm');
  const invalidEl = document.getElementById('setPasswordInvalid');

  loadingEl.style.display = 'none';

  if (!session) {
    invalidEl.style.display = 'block';
    return;
  }

  formEl.style.display = 'flex';

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw  = document.getElementById('newPassword').value;
    const pw2 = document.getElementById('confirmPassword').value;
    const errEl = document.getElementById('setPasswordError');
    const btn = document.getElementById('setPasswordBtn');
    errEl.style.display = 'none';

    if (pw.length < 8) {
      errEl.textContent = 'Password must be at least 8 characters.';
      errEl.style.display = 'block';
      return;
    }
    if (pw !== pw2) {
      errEl.textContent = 'Passwords do not match.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Setting Password...';

    const { error } = await pdb.auth.updateUser({ password: pw });

    if (error) {
      errEl.textContent = error.message || 'Could not set your password. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Set Password →';
      return;
    }

    window.location.href = '/portal/dashboard.html';
  });
}

// ── DASHBOARD PAGE ──────────────────────────────────────────
let portalAccount = null;
let myCompany = null;
let trainingRecords = [];

async function initDashboardPage() {
  const { data: { session } } = await pdb.auth.getSession();
  if (!session) { window.location.href = '/portal/index.html'; return; }

  const { data: account, error: accountError } = await pdb
    .from('company_portal_accounts')
    .select('company_id, email')
    .eq('auth_user_id', session.user.id)
    .single();

  if (accountError || !account) {
    document.getElementById('trainingRecordsContent').innerHTML = `
      <div class="portal-empty-state">
        <h2>This login is not connected to a client organization.</h2>
        <p>Please contact <a href="mailto:info@guardiangroupsls.com">info@guardiangroupsls.com</a> for help.</p>
      </div>`;
    document.getElementById('portalUserTag').textContent = session.user.email || '';
    return;
  }

  portalAccount = account;
  const { data: company, error: companyError } = await pdb
    .from('companies')
    .select('id, name')
    .eq('id', account.company_id)
    .single();

  if (companyError || !company) {
    document.getElementById('trainingRecordsContent').innerHTML =
      '<p class="empty-hint">We couldn\'t load your organization. Please contact Guardian Group.</p>';
    return;
  }

  myCompany = company;
  document.getElementById('welcomeLabel').textContent = company.name;
  document.getElementById('portalUserTag').textContent = account.email || session.user.email || '';
  document.getElementById('trainingRecordsSub').textContent = `Training history for everyone at ${company.name}.`;
  document.getElementById('trainingSearch').addEventListener('input', renderTrainingRecords);
  document.getElementById('trainingStatusFilter').addEventListener('change', renderTrainingRecords);

  loadTrainingRecords();
}

async function loadTrainingRecords() {
  const container = document.getElementById('trainingRecordsContent');
  container.innerHTML = '<p class="empty-hint">Loading...</p>';

  const { data: rows, error } = await pdb
    .from('attendance')
    .select(`
      id,
      created_at,
      status,
      certificate_issued,
      certificate_issued_at,
      certificate_number,
      training_title,
      training_date,
      training_facilitator,
      participant:participant_id(id, full_name, email),
      workshop:workshop_id(id, title, subtitle, facilitator, scheduled_at, workshop_date)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<p class="empty-hint">We couldn\'t load your training records. Please try again shortly.</p>';
    return;
  }

  trainingRecords = rows || [];
  renderTrainingSummary();
  renderTrainingRecords();
}

function renderTrainingSummary() {
  const employeeCount = new Set(trainingRecords.map(record => record.participant?.id).filter(Boolean)).size;
  const completedCount = trainingRecords.filter(record => record.status === 'completed').length;
  const certificateCount = trainingRecords.filter(record => record.certificate_issued).length;

  document.getElementById('trainingSummary').innerHTML = `
    <div class="portal-summary-card"><strong>${trainingRecords.length}</strong><span>Total records</span></div>
    <div class="portal-summary-card"><strong>${employeeCount}</strong><span>Employees</span></div>
    <div class="portal-summary-card"><strong>${completedCount}</strong><span>Completed</span></div>
    <div class="portal-summary-card"><strong>${certificateCount}</strong><span>Certificates</span></div>
  `;
}

function renderTrainingRecords() {
  const container = document.getElementById('trainingRecordsContent');
  const query = document.getElementById('trainingSearch')?.value.trim().toLowerCase() || '';
  const status = document.getElementById('trainingStatusFilter')?.value || '';
  const rows = trainingRecords.filter(record => {
    const searchable = `${record.participant?.full_name || ''} ${record.participant?.email || ''} ${record.workshop?.title || record.training_title || ''}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!status || record.status === status);
  });

  if (rows.length === 0) {
    container.innerHTML = `<div class="portal-empty-state"><h2>${trainingRecords.length ? 'No matching records' : 'No training records yet'}</h2><p>${trainingRecords.length ? 'Try changing your search or status filter.' : 'Training records will appear here as employees register and complete workshops.'}</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table portal-training-table">
        <thead>
          <tr><th>Employee</th><th>Training</th><th>Date</th><th>Status</th><th>Certificate</th></tr>
        </thead>
        <tbody>
          ${rows.map(record => `
            <tr>
              <td>
                <strong>${escHtml(record.participant?.full_name || '—')}</strong>
                <span class="portal-table-secondary">${escHtml(record.participant?.email || '')}</span>
              </td>
              <td>
                <strong>${escHtml(record.workshop?.title || record.training_title || 'Training')}</strong>
                <span class="portal-table-secondary">${escHtml(record.workshop?.facilitator || record.training_facilitator ? `Facilitated by ${record.workshop?.facilitator || record.training_facilitator}` : '')}</span>
              </td>
              <td>${escHtml(record.workshop ? portalFormatWorkshopDate(record.workshop) : portalFormatDate(record.training_date))}</td>
              <td><span class="reg-card-status-badge ${escHtml(record.status || 'registered')}">${escHtml(portalStatusLabel(record.status))}</span></td>
              <td>${record.certificate_issued
                ? `<a class="btn-sm btn-sm-ghost" href="/portal/certificate.html?id=${encodeURIComponent(record.id)}">View / Print</a>`
                : '<span class="portal-table-secondary">—</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function portalSignOut() {
  await pdb.auth.signOut();
  window.location.href = '/portal/index.html';
}

// ── CERTIFICATE PAGE ────────────────────────────────────────
async function initCertificatePage() {
  const { data: { session } } = await pdb.auth.getSession();
  if (!session) { window.location.href = '/portal/index.html'; return; }

  const id = new URLSearchParams(window.location.search).get('id');
  const loadingEl  = document.getElementById('certLoading');
  const toolbarEl  = document.getElementById('certToolbar');
  const cardEl     = document.getElementById('certificateCard');
  const errorEl    = document.getElementById('certError');

  if (!id) { loadingEl.style.display = 'none'; errorEl.style.display = 'block'; return; }

  const { data: cert, error } = await pdb
    .from('attendance')
    .select('id, certificate_number, certificate_issued_at, training_title, participant:participant_id(full_name), workshop:workshop_id(title)')
    .eq('id', id)
    .eq('certificate_issued', true)
    .single();

  loadingEl.style.display = 'none';

  if (error || !cert) {
    errorEl.style.display = 'block';
    return;
  }

  document.getElementById('certName').textContent = cert.participant?.full_name || '';
  document.getElementById('certWorkshop').textContent = cert.workshop?.title || cert.training_title || '';
  document.getElementById('certDate').textContent = portalFormatDate(cert.certificate_issued_at);
  document.getElementById('certNumber').textContent = cert.certificate_number || '—';

  toolbarEl.style.display = 'flex';
  cardEl.style.display = 'block';
}

// ── UTIL ─────────────────────────────────────────────────────
function portalFormatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function portalFormatWorkshopDate(workshop) {
  if (!workshop) return '';
  if (workshop.scheduled_at) return portalFormatDate(workshop.scheduled_at);
  if (workshop.workshop_date) return portalFormatDate(workshop.workshop_date);
  return 'Date TBD';
}

function portalStatusLabel(status) {
  return ({
    registered: 'Registered',
    attended: 'Attended',
    completed: 'Completed',
    no_show: 'No show'
  })[status] || status || 'Registered';
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
