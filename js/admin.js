// ============================================================
// GUARDIAN GROUP — admin.js
// Handles: auth, workshop management, response views, charts
// ============================================================

const ggClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allResponses = [];
let charts = {};
let editingWorkshopId = null;
let loadedWorkshops = [];

// ── AUTH ──────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');

  const { data, error } = await ggClient.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent = 'Invalid email or password. Try again.';
    errEl.style.display = 'block';
    return;
  }

  showDashboard();
});

async function checkSession() {
  const { data: { session } } = await ggClient.auth.getSession();
  if (session) {
    showDashboard();
  }
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  loadWorkshops();
}

async function signOut() {
  await ggClient.auth.signOut();
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

// ── VIEWS ─────────────────────────────────────────────────────
function setView(viewName, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
  btn.classList.add('active');

  if (viewName === 'survey-builder') {
    loadSurveyBuilder();
  }
}

// ── WORKSHOPS ─────────────────────────────────────────────────
async function loadWorkshops() {
  const { data, error } = await ggClient
    .from('workshops')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return;

  const select = document.getElementById('workshopSelect');
  select.innerHTML = '<option value="">— Select a workshop —</option>';
  data.forEach(ws => {
    const opt = document.createElement('option');
    opt.value = ws.id;
    opt.textContent = `${ws.title}${ws.workshop_date ? ' — ' + formatDate(ws.workshop_date) : ''}`;
    select.appendChild(opt);
  });

  renderWorkshopsList(data);
}

function renderWorkshopsList(workshops) {
  const list = document.getElementById('workshopsList');
  if (!workshops.length) {
    list.innerHTML = '<p style="color:var(--gg-muted); font-style:italic; grid-column:1/-1">No workshops yet. Create your first one above.</p>';
    return;
  }

  list.innerHTML = workshops.map(ws => `
    <div class="workshop-card ${ws.is_active ? '' : 'inactive'}">
      <div class="wc-title">${escHtml(ws.title)}</div>
      ${ws.subtitle ? `<div class="wc-subtitle">${escHtml(ws.subtitle)}</div>` : ''}
      <div class="wc-meta">
        ${ws.facilitator ? `<span class="wc-badge">👤 ${escHtml(ws.facilitator)}</span>` : ''}
        ${ws.workshop_date ? `<span class="wc-badge">📅 ${formatDate(ws.workshop_date)}</span>` : ''}
        <span class="wc-badge ${ws.is_active ? 'active-badge' : ''}">${ws.is_active ? '● Active' : '○ Inactive'}</span>
      </div>
      <div style="font-size:12px; color:var(--gg-muted); font-family:monospace; margin-top:4px;">
        Link: ?workshop=${escHtml(ws.slug)}
      </div>
      ${ws.meeting_link
        ? `<div style="font-size:12px; color:var(--gg-muted); margin-top:4px;">🔗 <a href="${escHtml(ws.meeting_link)}" target="_blank" style="color:var(--gg-muted);">Zoom link set</a></div>`
        : `<div style="font-size:12px; color:var(--gg-muted); margin-top:4px;">🔗 No Zoom link yet</div>`
      }
      <div class="wc-actions">
        <button class="btn-sm btn-sm-ghost" onclick="copyWorkshopLink('${escHtml(ws.slug)}')">Copy Link</button>
        <button class="btn-sm btn-sm-ghost" onclick="showEditWorkshop('${ws.id}')">Edit</button>
        <button class="btn-sm btn-sm-ghost" onclick="toggleActive('${ws.id}', ${ws.is_active})">${ws.is_active ? 'Deactivate' : 'Activate'}</button>
      </div>
    </div>
  `).join('');
}

async function toggleActive(id, current) {
  await ggClient.from('workshops').update({ is_active: !current }).eq('id', id);
  loadWorkshops();
}

function copyWorkshopLink(slug) {
  const base = window.location.origin + window.location.pathname.replace('/admin/index.html', '').replace('/admin/', '');
  navigator.clipboard.writeText(`${base}/?workshop=${slug}`);
  alert('Link copied!');
}

function showCreateWorkshop() {
  document.getElementById('createWorkshopCard').style.display = 'block';
}
function hideCreateWorkshop() {
  document.getElementById('createWorkshopCard').style.display = 'none';
}

// Auto-generate slug from title
document.getElementById('newTitle')?.addEventListener('input', (e) => {
  const slugField = document.getElementById('newSlug');
  if (!slugField.dataset.manuallyEdited) {
    slugField.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
});
document.getElementById('newSlug')?.addEventListener('input', (e) => {
  e.target.dataset.manuallyEdited = 'true';
});

async function createWorkshop() {
  const title = document.getElementById('newTitle').value.trim();
  const slug = document.getElementById('newSlug').value.trim();
  if (!title || !slug) { alert('Title and slug are required.'); return; }

  const { error } = await ggClient.from('workshops').insert({
    title,
    subtitle: document.getElementById('newSubtitle').value.trim() || null,
    facilitator: document.getElementById('newFacilitator').value.trim() || null,
    workshop_date: document.getElementById('newDate').value || null,
    meeting_link: document.getElementById('newMeetingLink').value.trim() || null,
    slug,
  });

  if (error) {
    alert(error.message.includes('unique') ? 'That slug is already taken. Try a different one.' : 'Error creating workshop: ' + error.message);
    return;
  }

  hideCreateWorkshop();
  document.getElementById('newTitle').value = '';
  document.getElementById('newSubtitle').value = '';
  document.getElementById('newFacilitator').value = '';
  document.getElementById('newDate').value = '';
  document.getElementById('newSlug').value = '';
  document.getElementById('newMeetingLink').value = '';
  loadWorkshops();
  alert('Workshop created! ✓');
}

async function showEditWorkshop(id) {
  const { data: ws, error } = await ggClient.from('workshops').select('*').eq('id', id).single();
  if (error || !ws) { alert('Could not load workshop.'); return; }

  editingWorkshopId = id;
  document.getElementById('editTitle').value = ws.title || '';
  document.getElementById('editSubtitle').value = ws.subtitle || '';
  document.getElementById('editFacilitator').value = ws.facilitator || '';
  document.getElementById('editDate').value = ws.workshop_date || '';
  document.getElementById('editMeetingLink').value = ws.meeting_link || '';

  document.getElementById('editWorkshopModal').style.display = 'flex';
}

function hideEditWorkshop() {
  document.getElementById('editWorkshopModal').style.display = 'none';
  editingWorkshopId = null;
}

function handleModalOverlayClick(event) {
  if (event.target === document.getElementById('editWorkshopModal')) {
    hideEditWorkshop();
  }
}

async function saveWorkshop() {
  if (!editingWorkshopId) return;

  const title = document.getElementById('editTitle').value.trim();
  if (!title) { alert('Title is required.'); return; }

  const { error } = await ggClient.from('workshops').update({
    title,
    subtitle: document.getElementById('editSubtitle').value.trim() || null,
    facilitator: document.getElementById('editFacilitator').value.trim() || null,
    workshop_date: document.getElementById('editDate').value || null,
    meeting_link: document.getElementById('editMeetingLink').value.trim() || null,
  }).eq('id', editingWorkshopId);

  if (error) {
    alert('Error saving workshop: ' + error.message);
    return;
  }

  hideEditWorkshop();
  loadWorkshops();
  alert('Workshop saved! ✓');
}

// ── LOAD WORKSHOP DATA ────────────────────────────────────────
async function loadWorkshopData() {
  const workshopId = document.getElementById('workshopSelect').value;
  if (!workshopId) return;

  // Get workshop details
  const { data: ws } = await ggClient.from('workshops').select('*').eq('id', workshopId).single();

  // Update share link
  const base = window.location.origin + window.location.pathname.replace('/admin/index.html', '').replace('/admin/', '');
  const link = `${base}/?workshop=${ws.slug}`;
  document.getElementById('shareLinkText').textContent = link;
  document.getElementById('shareLink').style.display = 'flex';

  // Get responses (supports static and dynamic surveys)
  const [{ data: preResponses }, { data: customResponses }] = await Promise.all([
    ggClient.from('pre_survey_responses').select('*').eq('workshop_id', workshopId).order('created_at', { ascending: false }),
    ggClient.from('custom_survey_responses').select('*').eq('workshop_id', workshopId).order('created_at', { ascending: false }),
  ]);

  const isDynamic = Array.isArray(ws.survey_config) && ws.survey_config.length > 0;
  allResponses = isDynamic ? (customResponses || []) : (preResponses || []);

  updateOverview(ws, allResponses, isDynamic);
  updateResponsesTable(allResponses, isDynamic);
  loadSurveyBuilder();
}

async function loadSurveyBuilder() {
  const workshopId = document.getElementById('workshopSelect').value;
  if (!workshopId) return;

  const { data: ws, error } = await ggClient.from('workshops').select('survey_config').eq('id', workshopId).single();
  if (error) {
    console.error(error);
    return;
  }

  window.surveyBuilderConfig = Array.isArray(ws?.survey_config) ? ws.survey_config : [];
  renderSurveyQuestionList();
}

function renderSurveyQuestionList() {
  const list = document.getElementById('surveyQuestionsList');
  if (!list) return;
  const questions = window.surveyBuilderConfig || [];

  if (!questions.length) {
    list.innerHTML = '<p style="color:var(--gg-muted); font-style:italic;">No survey questions configured yet.</p>';
    return;
  }

  list.innerHTML = questions
    .sort((a, b) => (a.section - b.section) || (a.position - b.position))
    .map((q, idx) => `
    <div class="survey-question-item">
      <div class="survey-question-text">${escHtml(q.text)}</div>
      <div class="survey-question-meta">Section ${q.section} • ${q.type} • Required: ${q.required ? 'Yes' : 'No'}</div>
      <div class="survey-question-meta">Options: ${q.options && q.options.length ? escHtml(q.options.join(' / ')) : 'n/a'}</div>
      <button class="btn-sm btn-sm-ghost" onclick="removeSurveyQuestion(${idx})">Remove</button>
    </div>
  `).join('');
}

function addSurveyQuestion() {
  const text = document.getElementById('surveyQuestionText').value.trim();
  const type = document.getElementById('surveyQuestionType').value;
  const section = Number(document.getElementById('surveyQuestionSection').value);
  const required = document.getElementById('surveyQuestionRequired').value === 'true';
  const optionsRaw = document.getElementById('surveyQuestionOptions').value.trim();

  if (!text) {
    alert('Question text is required');
    return;
  }

  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const options = optionsRaw ? optionsRaw.split(',').map(item => item.trim()).filter(Boolean) : [];

  if (!window.surveyBuilderConfig) window.surveyBuilderConfig = [];

  window.surveyBuilderConfig.push({
    id,
    text,
    type,
    required,
    section,
    options,
    position: window.surveyBuilderConfig.length + 1,
  });

  document.getElementById('surveyQuestionText').value = '';
  document.getElementById('surveyQuestionOptions').value = '';

  renderSurveyQuestionList();
}

function removeSurveyQuestion(index) {
  window.surveyBuilderConfig.splice(index, 1);
  renderSurveyQuestionList();
}

async function saveSurveyConfig() {
  const workshopId = document.getElementById('workshopSelect').value;
  if (!workshopId) {
    alert('Please select a workshop first');
    return;
  }

  const { error } = await ggClient.from('workshops').update({ survey_config: window.surveyBuilderConfig }).eq('id', workshopId);
  if (error) {
    alert('Failed to save survey config');
    console.error(error);
    return;
  }

  alert('Survey configuration saved. The survey page will now serve this custom survey.');
  loadSurveyBuilder();
}

function copyLink() {
  navigator.clipboard.writeText(document.getElementById('shareLinkText').textContent);
  const btn = document.querySelector('.btn-copy');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 2000);
}

// ── OVERVIEW ──────────────────────────────────────────────────
function updateOverview(ws, responses, isDynamic = false) {
  document.getElementById('overviewTitle').textContent = ws.title;
  document.getElementById('overviewSub').textContent = ws.subtitle || (isDynamic ? 'Custom survey responses' : 'Pre-workshop survey responses');
  document.getElementById('statTotal').textContent = responses.length || '0';
  document.getElementById('statRequired').textContent = responses.length ? `${responses.length}/${responses.length}` : '—';
  document.getElementById('statDate').textContent = ws.workshop_date ? formatDate(ws.workshop_date) : '—';
  document.getElementById('statLatest').textContent = responses.length
    ? timeAgo(responses[0].created_at)
    : '—';

  if (responses.length === 0) {
    document.getElementById('chartsRow').style.opacity = '0.3';
    document.getElementById('openSection').style.display = 'none';
    document.getElementById('challengeSection').style.display = 'none';
    return;
  }

  if (isDynamic) {
    document.getElementById('chartsRow').style.opacity = '0.3';
    document.getElementById('openSection').style.display = 'none';
    document.getElementById('challengeSection').style.display = 'none';
    return;
  }

  document.getElementById('chartsRow').style.opacity = '1';
  document.getElementById('openSection').style.display = 'block';
  document.getElementById('challengeSection').style.display = 'block';

  buildCharts(responses);
  buildOpenEndedCards(responses);
}

// ── CHARTS ────────────────────────────────────────────────────
const BRAND_COLORS = [
  '#16435B', '#2A5C76', '#52829C', '#77A4BC', '#A3C0D2',
  '#C8DCE9', '#8FA8B8', '#4A7A96', '#1E5470', '#336B87',
];

function countField(responses, field) {
  const counts = {};
  responses.forEach(r => {
    const val = r[field];
    if (!val) return;
    counts[val] = (counts[val] || 0) + 1;
  });
  return counts;
}

function countArrayField(responses, field) {
  const counts = {};
  responses.forEach(r => {
    const arr = r[field];
    if (!arr) return;
    arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  });
  return counts;
}

function makePieChart(canvasId, counts, shortenLabels = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (charts[canvasId]) { charts[canvasId].destroy(); }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([k]) => shortenLabels ? k.split(' —')[0].split(' /')[0].substring(0, 30) : k.substring(0, 35));
  const values = entries.map(([, v]) => v);

  charts[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: BRAND_COLORS.slice(0, values.length),
        borderWidth: 2,
        borderColor: '#f4f7fa',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: "'Barlow', sans-serif", size: 11 },
            color: '#52829C',
            padding: 10,
            boxWidth: 12,
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw / values.reduce((a,b)=>a+b,0) * 100)}%)`
          }
        }
      }
    }
  });
}

function buildCharts(responses) {
  makePieChart('chartIndustry', countField(responses, 'industry'));
  makePieChart('chartFamiliarity', countField(responses, 'safety_ii_familiarity'), true);
  makePieChart('chartCulture', countField(responses, 'safety_culture'), true);
  makePieChart('chartIndustryExp', countField(responses, 'time_in_industry'));
  makePieChart('chartReason', countField(responses, 'attendance_reason'), true);
  makePieChart('chartInvolvement', countArrayField(responses, 'safety_involvement'), true);
}

// ── OPEN-ENDED CARDS ──────────────────────────────────────────
function buildOpenEndedCards(responses) {
  const oneThingEl = document.getElementById('openCards');
  const challengeEl = document.getElementById('challengeCards');

  oneThingEl.innerHTML = responses
    .filter(r => r.one_thing_wanted)
    .map(r => `
      <div class="open-card">
        <div class="open-card-text">"${escHtml(r.one_thing_wanted)}"</div>
        <div class="open-card-meta">${escHtml(r.full_name)} · ${escHtml(r.job_title)}</div>
      </div>
    `).join('') || '<p style="color:var(--gg-muted);font-style:italic">No responses yet</p>';

  const challenges = responses.filter(r => r.specific_challenge);
  challengeEl.innerHTML = challenges.length
    ? challenges.map(r => `
        <div class="open-card">
          <div class="open-card-text">"${escHtml(r.specific_challenge)}"</div>
          <div class="open-card-meta">${escHtml(r.full_name)} · ${escHtml(r.organization)}</div>
        </div>
      `).join('')
    : '<p style="color:var(--gg-muted);font-style:italic">No specific challenges submitted</p>';
}

// ── RESPONSES TABLE ───────────────────────────────────────────
function updateResponsesTable(responses, isDynamic = false) {
  const tbody = document.getElementById('responsesBody');
  const empty = document.getElementById('emptyResponses');

  if (!responses.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  if (isDynamic) {
    tbody.innerHTML = responses.map((r, i) => `
      <tr onclick="toggleDetail(${i})">
        <td><strong>Response ${i + 1}</strong></td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>${timeAgo(r.created_at)}</td>
        <td><button class="expand-btn" id="expand-btn-${i}">View</button></td>
      </tr>
      <tr class="response-detail-row" id="detail-row-${i}">
        <td colspan="6">
          <div class="detail-grid">
            <div class="detail-item detail-full">
              <div class="detail-label">Answers</div>
              <div class="detail-value"><pre>${escHtml(JSON.stringify(r.answers || {}, null, 2))}</pre></div>
            </div>
          </div>
        </td>
      </tr>
    `).join('');
    return;
  }

  tbody.innerHTML = responses.map((r, i) => `
    <tr onclick="toggleDetail(${i})">
      <td><strong>${escHtml(r.full_name)}</strong></td>
      <td>${escHtml(r.organization)}</td>
      <td>${escHtml(r.job_title)}</td>
      <td>${escHtml(r.industry)}</td>
      <td>${timeAgo(r.created_at)}</td>
      <td><button class="expand-btn" id="expand-btn-${i}">View</button></td>
    </tr>
    <tr class="response-detail-row" id="detail-row-${i}">
      <td colspan="6">
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Email</div>
            <div class="detail-value">${escHtml(r.email || '—')}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Time Zone</div>
            <div class="detail-value">${escHtml(r.time_zone || '—')}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Time in Role / Industry</div>
            <div class="detail-value">${escHtml(r.time_in_role || '—')} / ${escHtml(r.time_in_industry || '—')}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Safety II Familiarity</div>
            <div class="detail-value">${escHtml(r.safety_ii_familiarity || '—')}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Safety Culture</div>
            <div class="detail-value">${escHtml(r.safety_culture || '—')}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Org Size / Team Size</div>
            <div class="detail-value">${escHtml(r.org_size || '—')} / ${escHtml(r.team_size || '—')}</div>
          </div>
          <div class="detail-item detail-full">
            <div class="detail-label">Safety Involvement</div>
            <div class="detail-value">${(r.safety_involvement || []).join(' · ') || '—'}</div>
          </div>
          <div class="detail-item detail-full">
            <div class="detail-label">The ONE thing they want</div>
            <div class="detail-value">${escHtml(r.one_thing_wanted || '—')}</div>
          </div>
          ${r.specific_challenge ? `
          <div class="detail-item detail-full">
            <div class="detail-label">Specific Challenge</div>
            <div class="detail-value">${escHtml(r.specific_challenge)}</div>
          </div>` : ''}
          ${r.safety_leadership_description ? `
          <div class="detail-item detail-full">
            <div class="detail-label">Safety Leadership in Their Org</div>
            <div class="detail-value">${escHtml(r.safety_leadership_description)}</div>
          </div>` : ''}
          ${r.do_not_cover ? `
          <div class="detail-item detail-full">
            <div class="detail-label">Don't Cover</div>
            <div class="detail-value">${escHtml(r.do_not_cover)}</div>
          </div>` : ''}
          ${r.org_change_context ? `
          <div class="detail-item detail-full">
            <div class="detail-label">Org Change Context</div>
            <div class="detail-value">${escHtml(r.org_change_context)}</div>
          </div>` : ''}
          ${r.accessibility_needs ? `
          <div class="detail-item detail-full">
            <div class="detail-label">Accessibility Needs</div>
            <div class="detail-value">${escHtml(r.accessibility_needs)}</div>
          </div>` : ''}
          ${r.anything_else ? `
          <div class="detail-item detail-full">
            <div class="detail-label">Anything Else</div>
            <div class="detail-value">${escHtml(r.anything_else)}</div>
          </div>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function toggleDetail(i) {
  const row = document.getElementById(`detail-row-${i}`);
  const btn = document.getElementById(`expand-btn-${i}`);
  const isOpen = row.classList.contains('open');
  row.classList.toggle('open', !isOpen);
  if (btn) btn.textContent = isOpen ? 'View' : 'Close';
}

// ── UTILS ─────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── INIT ──────────────────────────────────────────────────────
checkSession();
