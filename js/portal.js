// ============================================================
// GUARDIAN GROUP — portal.js
// Shared boilerplate + per-page logic for the client portal
// (portal/index.html, set-password.html, dashboard.html, certificate.html)
// ============================================================

const pdb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('loginForm'))       initLoginPage();
  if (document.getElementById('signupForm'))      initSignupPage();
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

// ── SIGNUP PAGE ──────────────────────────────────────────────
async function initSignupPage() {
  // Already signed in? Skip straight to the dashboard.
  const { data: { session } } = await pdb.auth.getSession();
  if (session) { window.location.href = '/portal/dashboard.html'; return; }

  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientCode = document.getElementById('signupCode').value.trim();
    const fullName   = document.getElementById('signupName').value.trim();
    const email      = document.getElementById('signupEmail').value.trim();
    const password   = document.getElementById('signupPassword').value;
    const confirm    = document.getElementById('signupConfirmPassword').value;
    const errEl      = document.getElementById('signupError');
    const btn        = document.getElementById('signupBtn');

    errEl.style.display = 'none';

    if (password.length < 8) {
      errEl.textContent = 'Password must be at least 8 characters.';
      errEl.style.display = 'block';
      return;
    }
    if (password !== confirm) {
      errEl.textContent = 'Passwords do not match.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating Account...';

    try {
      const resp = await fetch('/.netlify/functions/portal-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientCode, fullName, email, password })
      });
      const result = await resp.json().catch(() => ({}));

      if (!resp.ok || !result.success) {
        errEl.textContent = result.error || 'Could not create your account. Please try again.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Create Account →';
        return;
      }

      const { error: signInErr } = await pdb.auth.signInWithPassword({ email, password });
      if (signInErr) {
        window.location.href = '/portal/index.html';
        return;
      }
      window.location.href = '/portal/dashboard.html';
    } catch (err) {
      errEl.textContent = 'Could not create your account. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Create Account →';
    }
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
let myParticipant = null;
let myCompany = null;
let isOrgAdmin = false;

async function initDashboardPage() {
  const { data: { session } } = await pdb.auth.getSession();
  if (!session) { window.location.href = '/portal/index.html'; return; }

  const { data: participant, error: pErr } = await pdb
    .from('participants')
    .select('id, full_name, email, company_id')
    .eq('auth_user_id', session.user.id)
    .single();

  if (pErr || !participant) {
    document.getElementById('registrationsContent').innerHTML =
      '<p class="empty-hint">We couldn\'t find your participant record. Please contact info@guardiangroupsls.com.</p>';
    return;
  }

  myParticipant = participant;
  document.getElementById('welcomeLabel').textContent = `Welcome, ${participant.full_name}`;
  document.getElementById('portalUserTag').textContent = participant.email;

  if (participant.company_id) {
    const { data: company } = await pdb
      .from('companies')
      .select('id, name, org_admin_participant_id')
      .eq('id', participant.company_id)
      .single();
    myCompany = company || null;
    isOrgAdmin = !!(company && company.org_admin_participant_id === participant.id);
  }

  if (isOrgAdmin) {
    document.getElementById('companyNavItem').style.display = 'flex';
    document.getElementById('companySub').textContent = `Training status for everyone at ${myCompany?.name || 'your organization'}.`;
  }

  loadRegistrationsView();
}

function setView(viewName, btnEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  btnEl?.classList.add('active');

  if (viewName === 'registrations') loadRegistrationsView();
  if (viewName === 'certificates')  loadCertificatesView();
  if (viewName === 'company')       loadCompanyView();
}

async function loadRegistrationsView() {
  const container = document.getElementById('registrationsContent');
  container.innerHTML = '<p class="empty-hint">Loading...</p>';

  const { data: rows, error } = await pdb
    .from('attendance')
    .select('id, status, workshop:workshop_id(id, title, subtitle, facilitator, scheduled_at, workshop_date)')
    .order('id', { ascending: false });

  if (error || !rows || rows.length === 0) {
    container.innerHTML = '<p class="empty-hint">No registrations yet. Once you register for a workshop, it\'ll show up here.</p>';
    return;
  }

  container.innerHTML = `
    <div class="reg-cards">
      ${rows.map(r => `
        <div class="reg-card">
          <div class="reg-card-header">
            <div>
              <div class="reg-card-name">${escHtml(r.workshop?.title || 'Workshop')}</div>
              <div class="reg-card-email">${escHtml(r.workshop?.facilitator ? `Facilitated by ${r.workshop.facilitator}` : '')}</div>
            </div>
            <div class="reg-card-meta-right">
              <span class="wc-badge">${escHtml(portalFormatWorkshopDate(r.workshop))}</span>
              <span class="reg-card-status-badge ${escHtml(r.status)}">${escHtml(r.status)}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadCertificatesView() {
  const container = document.getElementById('certificatesContent');
  container.innerHTML = '<p class="empty-hint">Loading...</p>';

  const { data: rows, error } = await pdb
    .from('attendance')
    .select('id, certificate_number, certificate_issued_at, workshop:workshop_id(title)')
    .eq('certificate_issued', true)
    .order('certificate_issued_at', { ascending: false });

  if (error || !rows || rows.length === 0) {
    container.innerHTML = '<p class="empty-hint">No certificates yet. Certificates appear here once a workshop is marked complete.</p>';
    return;
  }

  container.innerHTML = `
    <div class="reg-cards">
      ${rows.map(c => `
        <div class="reg-card">
          <div class="reg-card-header">
            <div>
              <div class="reg-card-name">${escHtml(c.workshop?.title || 'Workshop')}</div>
              <div class="reg-card-email">Certificate No. ${escHtml(c.certificate_number || '—')}</div>
            </div>
            <div class="reg-card-meta-right">
              <span class="wc-badge active-badge">Issued ${portalFormatDate(c.certificate_issued_at)}</span>
              <a class="btn-sm btn-sm-ghost" href="/portal/certificate.html?id=${encodeURIComponent(c.id)}">View / Print</a>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadCompanyView() {
  const container = document.getElementById('companyContent');
  if (!isOrgAdmin || !myParticipant?.company_id) {
    container.innerHTML = '<p class="empty-hint">Company records are only visible to your organization\'s admin.</p>';
    return;
  }
  container.innerHTML = '<p class="empty-hint">Loading...</p>';

  const [{ data: roster }, { data: seatStatus }] = await Promise.all([
    pdb
      .from('participants')
      .select('id, full_name, email, is_active, auth_user_id')
      .eq('company_id', myParticipant.company_id)
      .order('full_name', { ascending: true }),
    pdb.rpc('org_admin_seat_status', { p_company_id: myParticipant.company_id }).maybeSingle()
  ]);

  if (!roster || roster.length === 0) {
    container.innerHTML = '<p class="empty-hint">No one from your company has joined the portal yet.</p>';
    return;
  }

  const seatLine = seatStatus
    ? `<p class="view-sub">${seatStatus.active_count} of ${seatStatus.max_seats} seats used${seatStatus.membership_tier ? ` — ${escHtml(seatStatus.membership_tier)}` : ''}</p>`
    : '';

  const rows = roster.map(p => {
    const active = p.is_active && p.auth_user_id;
    const isMe = p.id === myParticipant.id;
    return `
      <tr>
        <td>${escHtml(p.full_name || '—')}</td>
        <td>${escHtml(p.email || '—')}</td>
        <td><span class="reg-card-status-badge ${active ? 'attended' : 'no_show'}">${active ? 'Active' : 'Removed'}</span></td>
        <td>${active && !isMe ? `<button class="btn-sm btn-sm-danger" onclick="removeMember('${p.id}', '${escHtml(p.full_name || 'this member').replace(/'/g, "\\'")}')">Remove</button>` : (isMe ? '<span class="empty-hint">You</span>' : '—')}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    ${seatLine}
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function removeMember(participantId, name) {
  if (!confirm(`Remove ${name} from the portal? They will lose access immediately.`)) return;

  const { data: { session } } = await pdb.auth.getSession();
  const resp = await fetch('/.netlify/functions/portal-remove-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: session.access_token, targetParticipantId: participantId })
  });
  const result = await resp.json().catch(() => ({}));

  if (!resp.ok || !result.success) {
    alert(result.error || 'Could not remove member.');
    return;
  }
  loadCompanyView();
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
    .select('id, certificate_number, certificate_issued_at, participant:participant_id(full_name), workshop:workshop_id(title)')
    .eq('id', id)
    .eq('certificate_issued', true)
    .single();

  loadingEl.style.display = 'none';

  if (error || !cert) {
    errorEl.style.display = 'block';
    return;
  }

  document.getElementById('certName').textContent = cert.participant?.full_name || '';
  document.getElementById('certWorkshop').textContent = cert.workshop?.title || '';
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

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
