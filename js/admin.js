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

  if (viewName === 'survey-builder') loadSurveyBuilder();
  if (viewName === 'registrants') loadRegistrants();
}

// ── WORKSHOPS ─────────────────────────────────────────────────
async function loadWorkshops() {
  const [{ data, error }, { data: seatData }] = await Promise.all([
    ggClient.from('workshops').select('*').order('created_at', { ascending: false }),
    ggClient.from('registrations').select('workshop_id, seats_purchased')
  ]);

  if (error || !data) return;

  // Tally seats per workshop
  const seatsByWorkshop = {};
  (seatData || []).forEach(r => {
    seatsByWorkshop[r.workshop_id] = (seatsByWorkshop[r.workshop_id] || 0) + (r.seats_purchased || 0);
  });

  const select = document.getElementById('workshopSelect');
  select.innerHTML = '<option value="">— Select a workshop —</option>';
  data.forEach(ws => {
    const opt = document.createElement('option');
    opt.value = ws.id;
    opt.textContent = `${ws.title}${ws.workshop_date ? ' — ' + formatDate(ws.workshop_date) : ''}`;
    select.appendChild(opt);
  });

  renderWorkshopsList(data, seatsByWorkshop);
}

function renderWorkshopsList(workshops, seatsByWorkshop = {}) {
  const list = document.getElementById('workshopsList');
  if (!workshops.length) {
    list.innerHTML = '<p style="color:var(--gg-muted); font-style:italic; grid-column:1/-1">No workshops yet. Create your first one above.</p>';
    return;
  }

  list.innerHTML = workshops.map(ws => {
    const soldSeats = seatsByWorkshop[ws.id] || 0;
    const maxSeats = ws.max_seats || null;
    const seatsRemaining = maxSeats !== null ? maxSeats - soldSeats : null;

    let seatsDisplay = '';
    if (maxSeats !== null) {
      const remainingText = seatsRemaining <= 0 ? 'Sold out' : `${seatsRemaining} of ${maxSeats} seats remaining`;
      const color = seatsRemaining <= 0 ? '#c0392b' : seatsRemaining <= 10 ? '#b45309' : 'var(--gg-muted)';
      seatsDisplay = `<div style="font-size:12px; color:${color}; margin-top:4px;">◉ ${soldSeats} registered · ${remainingText}</div>`;
    } else if (soldSeats > 0) {
      seatsDisplay = `<div style="font-size:12px; color:var(--gg-muted); margin-top:4px;">◉ ${soldSeats} registered</div>`;
    }

    return `
    <div class="workshop-card ${ws.is_active ? '' : 'inactive'}">
      <div class="wc-title">${escHtml(ws.title)}</div>
      ${ws.subtitle ? `<div class="wc-subtitle">${escHtml(ws.subtitle)}</div>` : ''}
      <div class="wc-meta">
        ${ws.facilitator ? `<span class="wc-badge">👤 ${escHtml(ws.facilitator)}</span>` : ''}
        ${ws.workshop_date ? `<span class="wc-badge">📅 ${formatDate(ws.workshop_date)}</span>` : ''}
        ${ws.price_per_seat != null ? `<span class="wc-badge">💲 ${formatCurrency(ws.price_per_seat)}/seat</span>` : ''}
        <span class="wc-badge ${ws.is_active ? 'active-badge' : ''}">${ws.is_active ? '● Active' : '○ Inactive'}</span>
      </div>
      <div style="font-size:12px; color:var(--gg-muted); font-family:monospace; margin-top:4px;">
        Link: ?workshop=${escHtml(ws.slug)}
      </div>
      ${seatsDisplay}
      ${ws.meeting_link
        ? `<div style="font-size:12px; color:var(--gg-muted); margin-top:4px;">🔗 <a href="${escHtml(ws.meeting_link)}" target="_blank" style="color:var(--gg-muted);">Zoom link set</a></div>`
        : `<div style="font-size:12px; color:var(--gg-muted); margin-top:4px;">🔗 No Zoom link yet</div>`
      }
      <div class="wc-actions">
        <button class="btn-sm btn-sm-ghost" onclick="copyWorkshopLink('${escHtml(ws.slug)}')">Copy Link</button>
        <button class="btn-sm btn-sm-ghost" onclick="showEditWorkshop('${ws.id}')">Edit</button>
        <button class="btn-sm btn-sm-ghost" onclick="toggleActive('${ws.id}', ${ws.is_active})">${ws.is_active ? 'Deactivate' : 'Activate'}</button>
        <button class="btn-sm btn-sm-danger" onclick="deleteWorkshop('${ws.id}', '${escHtml(ws.title).replace(/'/g, "\\'")}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

async function toggleActive(id, current) {
  await ggClient.from('workshops').update({ is_active: !current }).eq('id', id);
  loadWorkshops();
}

async function deleteWorkshop(id, title) {
  if (!confirm(`Delete "${title}"?\n\nThis cannot be undone. Any existing registrations will remain in the database.`)) return;
  const { error } = await ggClient.from('workshops').delete().eq('id', id);
  if (error) { alert('Error deleting workshop: ' + error.message); return; }
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

  const newDate = document.getElementById('newDate').value;
  const newTime = document.getElementById('newTime').value;
  const { error } = await ggClient.from('workshops').insert({
    title,
    subtitle:        document.getElementById('newSubtitle').value.trim() || null,
    facilitator:     document.getElementById('newFacilitator').value.trim() || null,
    workshop_date:   newDate || null,
    scheduled_at:    buildScheduledAt(newDate, newTime),
    duration_minutes: parseFloat(document.getElementById('newDuration').value) * 60 || null,
    description:     document.getElementById('newDescription').value.trim() || null,
    price_per_seat:  parseFloat(document.getElementById('newCost').value) || null,
    max_seats:       parseInt(document.getElementById('newMaxSeats').value, 10) || null,
    meeting_link:    document.getElementById('newMeetingLink').value.trim() || null,
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
  document.getElementById('newTime').value = '';
  document.getElementById('newDuration').value = '';
  document.getElementById('newSlug').value = '';
  document.getElementById('newDescription').value = '';
  document.getElementById('newCost').value = '';
  document.getElementById('newMaxSeats').value = '';
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
  document.getElementById('editDate').value = ws.workshop_date || (ws.scheduled_at ? ws.scheduled_at.slice(0, 10) : '');
  document.getElementById('editTime').value = ws.scheduled_at ? new Date(ws.scheduled_at).toTimeString().slice(0, 5) : '';
  document.getElementById('editDuration').value = ws.duration_minutes ? ws.duration_minutes / 60 : '';
  document.getElementById('editDescription').value = ws.description || '';
  document.getElementById('editCost').value = ws.price_per_seat ?? '';
  document.getElementById('editMaxSeats').value = ws.max_seats ?? '';
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

  const editDate = document.getElementById('editDate').value;
  const editTime = document.getElementById('editTime').value;
  const { error } = await ggClient.from('workshops').update({
    title,
    subtitle:         document.getElementById('editSubtitle').value.trim() || null,
    facilitator:      document.getElementById('editFacilitator').value.trim() || null,
    workshop_date:    editDate || null,
    scheduled_at:     buildScheduledAt(editDate, editTime),
    duration_minutes: parseFloat(document.getElementById('editDuration').value) * 60 || null,
    description:      document.getElementById('editDescription').value.trim() || null,
    price_per_seat:   parseFloat(document.getElementById('editCost').value) || null,
    max_seats:        parseInt(document.getElementById('editMaxSeats').value, 10) || null,
    meeting_link:     document.getElementById('editMeetingLink').value.trim() || null,
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
  loadRegistrants();
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

function loadSurveyTemplate() {
  if (window.surveyBuilderConfig && window.surveyBuilderConfig.length > 0) {
    if (!confirm('This will replace your current questions with the default template. Continue?')) return;
  }
  window.surveyBuilderConfig = [
    { id: 'full_name',        text: 'Full Name',                                   type: 'text',     required: true,  section: 1, options: [], position: 1 },
    { id: 'organization',     text: 'Organization / Company',                      type: 'text',     required: true,  section: 1, options: [], position: 2 },
    { id: 'job_title',        text: 'Job Title / Role',                            type: 'text',     required: true,  section: 1, options: [], position: 3 },
    { id: 'industry',         text: 'Industry',                                    type: 'select',   required: true,  section: 1, options: ['Construction', 'Oil & Gas', 'Mining', 'Manufacturing', 'Healthcare', 'Transportation', 'Utilities', 'Government', 'Other'], position: 4 },
    { id: 'time_in_role',     text: 'How long have you been in a safety role?',    type: 'select',   required: false, section: 1, options: ['Less than 1 year', '1–3 years', '3–5 years', '5–10 years', '10+ years'], position: 5 },
    { id: 'safety_involvement', text: 'What best describes your involvement in safety? (Select all that apply)', type: 'checkbox', required: false, section: 2, options: ['Primary safety role', 'Safety as part of a broader role', 'Supervisor/manager with safety responsibilities', 'Executive/leadership', 'Safety committee member'], position: 6 },
    { id: 'one_thing_wanted', text: 'What is the ONE thing you most want to get out of this workshop?', type: 'textarea', required: true,  section: 3, options: [], position: 7 },
    { id: 'specific_challenge', text: 'Is there a specific challenge you\'re hoping this workshop will help with?', type: 'textarea', required: false, section: 3, options: [], position: 8 },
    { id: 'accessibility_needs', text: 'Do you have any accessibility needs we should know about?',   type: 'text',     required: false, section: 5, options: [], position: 9 },
  ];
  renderSurveyQuestionList();
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

// ── REGISTRANTS ───────────────────────────────────────────────
async function loadRegistrants() {
  const workshopId = document.getElementById('workshopSelect').value;
  const container = document.getElementById('registrantsContent');

  if (!workshopId) {
    container.innerHTML = '<p class="empty-hint">Select a workshop above to view its registrants.</p>';
    return;
  }

  container.innerHTML = '<p class="empty-hint">Loading...</p>';

  const [{ data: registrations, error }, { data: attendanceRows }] = await Promise.all([
    ggClient
      .from('registrations')
      .select('id, registration_type, seats_purchased, total_paid, created_at, square_transaction_id, purchaser:purchaser_id(full_name, email)')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: false }),
    ggClient
      .from('attendance')
      .select('registration_id, status, participant:participant_id(full_name, email)')
      .eq('workshop_id', workshopId)
  ]);

  if (error || !registrations || registrations.length === 0) {
    container.innerHTML = '<p class="empty-hint">No registrations yet for this workshop.</p>';
    return;
  }

  // Group attendance rows by registration_id
  const attendeesByReg = {};
  (attendanceRows || []).forEach(row => {
    if (!attendeesByReg[row.registration_id]) attendeesByReg[row.registration_id] = [];
    attendeesByReg[row.registration_id].push(row);
  });

  const totalSeats = registrations.reduce((sum, r) => sum + (r.seats_purchased || 0), 0);
  const totalRevenue = registrations.reduce((sum, r) => sum + (r.total_paid || 0), 0);

  container.innerHTML = `
    <div class="reg-summary-bar">
      <div class="reg-summary-stat"><span class="reg-summary-num">${registrations.length}</span><span class="reg-summary-label">Registrations</span></div>
      <div class="reg-summary-stat"><span class="reg-summary-num">${totalSeats}</span><span class="reg-summary-label">Total Seats</span></div>
      <div class="reg-summary-stat"><span class="reg-summary-num">${formatCurrency(totalRevenue)}</span><span class="reg-summary-label">Total Revenue</span></div>
    </div>
    <div class="reg-cards">
      ${registrations.map((reg, i) => {
        const attendees = attendeesByReg[reg.id] || [];
        const typeLabel = { myself: 'Self', myself_and_others: 'Group', others_only: 'Others Only' }[reg.registration_type] || reg.registration_type;
        return `
          <div class="reg-card">
            <div class="reg-card-header">
              <div>
                <div class="reg-card-name">${escHtml(reg.purchaser?.full_name || '—')}</div>
                <div class="reg-card-email">${escHtml(reg.purchaser?.email || '—')}</div>
              </div>
              <div class="reg-card-meta-right">
                <span class="wc-badge">${typeLabel}</span>
                <span class="wc-badge">${reg.seats_purchased} seat${reg.seats_purchased !== 1 ? 's' : ''}</span>
                <span class="wc-badge active-badge">${formatCurrency(reg.total_paid || 0)}</span>
              </div>
            </div>
            ${attendees.length ? `
              <div class="reg-card-attendees">
                <div class="reg-card-attendees-label">Attendees</div>
                ${attendees.map(a => `
                  <div class="reg-card-attendee-row">
                    <span>${escHtml(a.participant?.full_name || '—')}</span>
                    <span class="reg-card-attendee-email">${escHtml(a.participant?.email || '—')}</span>
                    <span class="reg-card-status-badge ${a.status}">${a.status}</span>
                  </div>
                `).join('')}
              </div>` : ''}
            <div class="reg-card-footer-meta">
              Registered ${timeAgo(reg.created_at)}
              ${reg.square_transaction_id ? ` · Txn: <code>${escHtml(reg.square_transaction_id)}</code>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount || 0);
}

// ── UTILS ─────────────────────────────────────────────────────
function buildScheduledAt(date, time) {
  if (!date) return null;
  return time ? new Date(`${date}T${time}`).toISOString() : null;
}

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
