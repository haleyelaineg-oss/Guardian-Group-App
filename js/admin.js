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
  document.querySelectorAll('.nav-item, .nav-subitem').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
  btn.classList.add('active');

  const parentGroup = btn.closest('.nav-group');
  if (parentGroup) {
    parentGroup.classList.add('expanded');
    parentGroup.querySelector('.nav-group-toggle').classList.add('active');
  }

  if (viewName === 'survey-builder') loadSurveyBuilder();
  if (viewName === 'registrants') loadRegistrants();
  if (viewName === 'clients') loadCompanies();
  if (viewName === 'address-book') loadAddressBook();
}

function toggleNavGroup(toggleBtn) {
  toggleBtn.closest('.nav-group').classList.toggle('expanded');
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
      .select('id, registration_id, status, participant_id, certificate_issued, certificate_number, participant:participant_id(full_name, email)')
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
                    <select class="attendance-status-select" onchange="updateAttendanceStatus('${a.id}', this.value)">
                      ${['registered', 'attended', 'no_show', 'completed'].map(s =>
                        `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`
                      ).join('')}
                    </select>
                    ${a.status === 'completed'
                      ? (a.certificate_issued
                          ? `<span class="wc-badge active-badge">✓ Certified (${escHtml(a.certificate_number || '')})</span>`
                          : `<button class="btn-sm btn-sm-ghost" onclick="issueCertificate('${a.id}')">Issue Certificate</button>`)
                      : ''}
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

async function updateAttendanceStatus(attendanceId, newStatus) {
  const { error } = await ggClient.from('attendance').update({ status: newStatus }).eq('id', attendanceId);
  if (error) { alert('Could not update attendance: ' + error.message); return; }
  loadRegistrants();
}

async function issueCertificate(attendanceId) {
  const { error } = await ggClient
    .from('attendance')
    .update({ certificate_issued: true })
    .eq('id', attendanceId);
  if (error) { alert('Could not issue certificate: ' + error.message); return; }
  loadRegistrants();
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount || 0);
}

// ── CLIENTS (compact list) ──────────────────────────────────
let currentClientId = null;

async function loadCompanies() {
  const container = document.getElementById('clientsContent');
  container.innerHTML = '<p class="empty-hint">Loading...</p>';

  const { data: companies, error } = await ggClient
    .from('companies')
    .select('id, name, contact_name, contact_email, org_admin_participant_id')
    .order('name', { ascending: true });

  if (error || !companies || companies.length === 0) {
    container.innerHTML = '<p class="empty-hint">No clients yet.</p>';
    return;
  }

  const [{ data: allParticipants }, { data: memberships }] = await Promise.all([
    ggClient
      .from('participants')
      .select('id, company_id, is_active, auth_user_id')
      .in('company_id', companies.map(c => c.id)),
    ggClient
      .from('company_membership')
      .select('company_id, client_code, membership_tier, max_seats')
      .in('company_id', companies.map(c => c.id))
  ]);

  const participantsByCompany = {};
  (allParticipants || []).forEach(p => {
    if (!participantsByCompany[p.company_id]) participantsByCompany[p.company_id] = [];
    participantsByCompany[p.company_id].push(p);
  });

  const membershipByCompany = {};
  (memberships || []).forEach(m => { membershipByCompany[m.company_id] = m; });

  container.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead>
          <tr><th>Client</th><th>Code</th><th>Tier</th><th>Seats</th><th></th></tr>
        </thead>
        <tbody>
          ${companies.map(c => {
            const members = participantsByCompany[c.id] || [];
            const activeCount = members.filter(m => m.is_active && m.auth_user_id).length;
            const membership = membershipByCompany[c.id];
            return `
              <tr class="client-list-row" onclick="showClientDetail('${c.id}')">
                <td>${escHtml(c.name)}</td>
                <td>${membership ? `<span class="client-code-chip">${escHtml(membership.client_code)}</span>` : '—'}</td>
                <td>${escHtml(membership?.membership_tier || '—')}</td>
                <td>${membership ? (membership.max_seats === null ? `${activeCount} / Unlimited` : `${activeCount} / ${membership.max_seats}`) : '—'}</td>
                <td style="white-space:nowrap;">
                  <button class="btn-sm btn-sm-ghost" onclick="event.stopPropagation(); showClientDetail('${c.id}')">Edit</button>
                  <button class="btn-sm btn-sm-danger" onclick="event.stopPropagation(); deleteClient('${c.id}', '${escHtml(c.name).replace(/'/g, "\\'")}')">Delete</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function setCompanyOrgAdmin(companyId, participantId) {
  const { error } = await ggClient
    .from('companies')
    .update({ org_admin_participant_id: participantId || null })
    .eq('id', companyId);
  if (error) { alert('Could not update org admin: ' + error.message); return; }
  loadClientDetail();
}

function generateClientCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — avoids read-aloud ambiguity
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

function copyClientCode(code) {
  navigator.clipboard.writeText(code);
  alert('Client code copied!');
}

async function regenerateClientCode(companyId) {
  if (!confirm('Regenerating immediately invalidates the current code — anyone who hasn\'t signed up yet will need the new one. Continue?')) return;
  const { error } = await ggClient
    .from('company_membership')
    .update({ client_code: generateClientCode() })
    .eq('company_id', companyId);
  if (error) { alert('Could not regenerate code: ' + error.message); return; }
  loadClientDetail();
}

async function updateMembershipField(companyId, field, rawValue) {
  const value = field === 'max_seats' ? (parseInt(rawValue, 10) || 0) : (rawValue.trim() || null);
  const { error } = await ggClient
    .from('company_membership')
    .update({ [field]: value })
    .eq('company_id', companyId);
  if (error) { alert('Could not save: ' + error.message); }
  loadClientDetail();
}

async function enableMembership(companyId) {
  const { error } = await ggClient
    .from('company_membership')
    .insert({ company_id: companyId, client_code: generateClientCode(), max_seats: 5 });
  if (error) { alert('Could not enable membership: ' + error.message); return; }
  loadClientDetail();
}

function showCreateCompany() {
  document.getElementById('createCompanyCard').style.display = 'block';
}
function hideCreateCompany() {
  document.getElementById('createCompanyCard').style.display = 'none';
}

// Keeps a company's primary_contact_participant_id pointed at a real
// participant row matching the typed name/email — creates one the
// first time, updates that same one on later edits, never duplicates.
// Used by both createCompany() and saveClientOverview().
async function upsertPrimaryContact(companyId, existingParticipantId, fullName, email) {
  if (!fullName) return { id: null, error: null };

  if (existingParticipantId) {
    const { error } = await ggClient.from('participants')
      .update({ full_name: fullName, email })
      .eq('id', existingParticipantId);
    return { id: existingParticipantId, error };
  }

  const { data, error } = await ggClient.from('participants')
    .insert({ full_name: fullName, email, company_id: companyId })
    .select('id')
    .single();
  return { id: data?.id || null, error };
}

async function createCompany() {
  const name = document.getElementById('newCompanyName').value.trim();
  if (!name) { alert('Client name is required.'); return; }

  const contactName = document.getElementById('newCompanyContactName').value.trim() || null;
  const contactEmail = document.getElementById('newCompanyContactEmail').value.trim() || null;

  const { data: co, error } = await ggClient
    .from('companies')
    .insert({
      name,
      contact_name: contactName,
      contact_email: contactEmail,
      billing_address: document.getElementById('newCompanyBillingAddress').value.trim() || null,
    })
    .select()
    .single();

  if (error) { alert('Error creating client: ' + error.message); return; }

  if (contactName) {
    const { id: contactId, error: contactErr } = await upsertPrimaryContact(co.id, null, contactName, contactEmail);
    if (contactErr) {
      alert(/duplicate key|unique/i.test(contactErr.message)
        ? 'Client created, but that contact email is already on file for someone else — link them from the Address Book instead.'
        : 'Client created, but saving the primary contact failed: ' + contactErr.message);
    } else if (contactId) {
      await ggClient.from('companies').update({ primary_contact_participant_id: contactId }).eq('id', co.id);
    }
  }

  const unlimitedSeats = document.getElementById('newCompanyUnlimitedSeats').checked;
  const { error: memErr } = await ggClient.from('company_membership').insert({
    company_id: co.id,
    client_code: generateClientCode(),
    membership_tier: document.getElementById('newCompanyTier').value.trim() || null,
    max_seats: unlimitedSeats ? null : (parseInt(document.getElementById('newCompanyMaxSeats').value, 10) || 5),
  });
  if (memErr) { alert('Client created, but membership setup failed: ' + memErr.message); }

  document.getElementById('newCompanyName').value = '';
  document.getElementById('newCompanyContactName').value = '';
  document.getElementById('newCompanyContactEmail').value = '';
  document.getElementById('newCompanyBillingAddress').value = '';
  document.getElementById('newCompanyTier').value = '';
  document.getElementById('newCompanyMaxSeats').value = '';
  document.getElementById('newCompanyMaxSeats').disabled = false;
  document.getElementById('newCompanyUnlimitedSeats').checked = false;

  hideCreateCompany();
  loadCompanies();
}

async function deleteClient(companyId, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone — their client code, membership, and roster assignment all go with it.`)) return;
  const { error } = await ggClient.from('companies').delete().eq('id', companyId);
  if (error) {
    alert(/foreign key|violates/i.test(error.message)
      ? `Can't delete ${name} — they still have contacts, registrants, or training records on file. Remove those first (Address Book) before deleting the client.`
      : 'Could not delete client: ' + error.message);
    return;
  }
  loadCompanies();
}

// ── CLIENT DETAIL (client code, address book, training, invoices) ──

function showClientDetail(companyId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-client-detail').classList.add('active');
  currentClientId = companyId;
  loadClientDetail();
}

function backToClients() {
  setView('clients', document.querySelector('[data-view="clients"]'));
}

let editingPhones = [];
let currentPrimaryContactId = null;
const PHONE_TYPES = ['Office', 'Work Cell', 'Personal'];

function renderPhoneRows() {
  if (editingPhones.length === 0) {
    return '<p class="empty-hint" style="margin:8px 0;">No phone numbers yet.</p>';
  }
  return editingPhones.map((p, i) => `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
      <select class="field-input" style="max-width:140px;" onchange="editingPhones[${i}].type = this.value">
        ${PHONE_TYPES.map(t => `<option value="${t}" ${p.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <input type="text" class="field-input" value="${escHtml(p.number || '')}" placeholder="(555) 555-5555" oninput="editingPhones[${i}].number = this.value" />
      <button type="button" class="btn-sm btn-sm-danger" onclick="removePhoneRow(${i})">×</button>
    </div>
  `).join('');
}

function addPhoneRow() {
  editingPhones.push({ type: 'Office', number: '' });
  document.getElementById('phoneRowsContainer').innerHTML = renderPhoneRows();
}

function removePhoneRow(index) {
  editingPhones.splice(index, 1);
  document.getElementById('phoneRowsContainer').innerHTML = renderPhoneRows();
}

async function loadClientDetail() {
  const container = document.getElementById('clientDetailContent');
  container.innerHTML = '<p class="empty-hint">Loading...</p>';
  const companyId = currentClientId;

  const [{ data: company }, { data: membership }, { data: roster }] = await Promise.all([
    ggClient.from('companies').select('id, name, contact_name, contact_email, phones, billing_address, primary_contact_participant_id, org_admin_participant_id').eq('id', companyId).single(),
    ggClient.from('company_membership').select('company_id, client_code, membership_tier, max_seats').eq('company_id', companyId).maybeSingle(),
    ggClient.from('participants').select('id, full_name, email, phone, title, is_active, auth_user_id').eq('company_id', companyId).order('full_name', { ascending: true })
  ]);

  if (!company) { container.innerHTML = '<p class="empty-hint">Client not found.</p>'; return; }

  editingPhones = (company.phones || []).map(p => ({ ...p }));
  currentPrimaryContactId = company.primary_contact_participant_id || null;

  const members = roster || [];
  const activeCount = members.filter(m => m.is_active && m.auth_user_id).length;
  const memberIds = members.map(m => m.id);

  const [{ data: attendanceRows }, { data: invoiceRows }] = await Promise.all([
    memberIds.length
      ? ggClient.from('attendance').select('id, participant_id, status, certificate_issued, workshop:workshop_id(title)').in('participant_id', memberIds)
      : Promise.resolve({ data: [] }),
    ggClient.from('documents').select('id, doc_type, doc_number, status, total, doc_date, quote_clients!inner(company_id)').eq('quote_clients.company_id', companyId).order('created_at', { ascending: false })
  ]);

  const rosterById = {};
  members.forEach(m => { rosterById[m.id] = m; });

  const membershipPanel = membership ? `
    <div class="builder-card" style="margin-top:12px;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span class="client-code-chip">${escHtml(membership.client_code)}</span>
        <button class="btn-sm btn-sm-ghost" onclick="copyClientCode('${escHtml(membership.client_code)}')">Copy</button>
        <button class="btn-sm btn-sm-ghost" onclick="regenerateClientCode('${company.id}')">Regenerate</button>
        <span class="seat-badge">${activeCount} / ${membership.max_seats === null ? 'Unlimited' : membership.max_seats} active</span>
      </div>
      <div class="fields-grid" style="margin-top:12px;">
        <div class="field-group half">
          <label class="field-label">Membership Tier</label>
          <select class="field-input" onchange="updateMembershipField('${company.id}', 'membership_tier', this.value)">
            <option value="">— Select —</option>
            ${['Blue', 'Silver', 'Gold', 'Platinum'].map(t => `<option value="${t}" ${membership.membership_tier === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field-group half">
          <label class="field-label">Max Seats</label>
          <div style="display:flex; align-items:center; gap:12px;">
            <input type="number" class="field-input" value="${membership.max_seats === null ? '' : membership.max_seats}" min="0" step="1" ${membership.max_seats === null ? 'disabled' : ''} onchange="updateMembershipField('${company.id}', 'max_seats', this.value)" />
            <label style="display:flex; align-items:center; gap:6px; white-space:nowrap; font-size:13px; color:var(--gg-muted);">
              <input type="checkbox" ${membership.max_seats === null ? 'checked' : ''} onchange="setUnlimitedSeats('${company.id}', this.checked)" />
              Unlimited
            </label>
          </div>
        </div>
      </div>
    </div>
  ` : `
    <div class="builder-card" style="margin-top:12px;">
      <button class="btn-sm btn-sm-ghost" onclick="enableMembership('${company.id}')">Enable Portal Membership</button>
    </div>
  `;

  const rosterRows = members.map(m => {
    const isOrgAdmin = company.org_admin_participant_id === m.id;
    const isPrimaryContact = company.primary_contact_participant_id === m.id;
    const hasPortalAccess = m.is_active && m.auth_user_id;
    return `
      <tr>
        <td>${escHtml(m.full_name || '—')}${isPrimaryContact ? ' <span class="wc-badge">Primary Contact</span>' : ''}${isOrgAdmin ? ' <span class="wc-badge">Org Admin</span>' : ''}</td>
        <td>${escHtml(m.email || '—')}</td>
        <td>${escHtml(m.phone || '—')}</td>
        <td>${escHtml(m.title || '—')}</td>
        <td>${hasPortalAccess ? '<span class="reg-card-status-badge attended">Active</span>' : '<span class="reg-card-status-badge no_show">Not signed up</span>'}</td>
      </tr>
    `;
  }).join('');

  const trainingRows = (attendanceRows || []).map(a => {
    const p = rosterById[a.participant_id];
    return `
      <tr>
        <td>${escHtml(p?.full_name || '—')}</td>
        <td>${escHtml(a.workshop?.title || '—')}</td>
        <td><span class="reg-card-status-badge ${escHtml(a.status)}">${escHtml(a.status)}</span></td>
        <td>${a.certificate_issued ? 'Issued' : '—'}</td>
      </tr>
    `;
  }).join('');

  const invoiceRowsHtml = (invoiceRows || []).map(d => `
    <tr>
      <td>${escHtml(d.doc_number)}</td>
      <td>${escHtml(d.doc_type)}</td>
      <td><span class="reg-card-status-badge">${escHtml(d.status)}</span></td>
      <td>${formatCurrency(d.total)}</td>
      <td>${escHtml(d.doc_date || '—')}</td>
      <td><a class="btn-sm btn-sm-ghost" href="../quote-tool/index.html?doc=${encodeURIComponent(d.id)}" target="_blank" rel="noopener">View →</a></td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">${escHtml(company.name)}</h1>
    </div>

    <div class="detail-section-title">Overview</div>
    <div class="fields-grid">
      <div class="field-group half">
        <label class="field-label">Primary Contact</label>
        <input type="text" id="detailContactName" class="field-input" value="${escHtml(company.contact_name || '')}" />
        <p class="field-hint">Saved to this client's roster too, so they can be picked as Org Admin.</p>
      </div>
      <div class="field-group half">
        <label class="field-label">Contact Email</label>
        <input type="email" id="detailContactEmail" class="field-input" value="${escHtml(company.contact_email || '')}" />
      </div>
      <div class="field-group full">
        <label class="field-label">Phone Numbers</label>
        <div id="phoneRowsContainer">${renderPhoneRows()}</div>
        <button type="button" class="btn-sm btn-sm-ghost" onclick="addPhoneRow()">+ Add Phone Number</button>
      </div>
      <div class="field-group full">
        <label class="field-label">Billing Address</label>
        <textarea id="detailBillingAddress" class="field-input" rows="2">${escHtml(company.billing_address || '')}</textarea>
      </div>
      <div class="field-group half">
        <label class="field-label" style="margin:0;">Org Admin</label>
        <select class="attendance-status-select" onchange="setCompanyOrgAdmin('${company.id}', this.value)" ${members.length === 0 ? 'disabled' : ''}>
          <option value="">— None —</option>
          ${members.map(m => `<option value="${m.id}" ${company.org_admin_participant_id === m.id ? 'selected' : ''}>${escHtml(m.full_name)} (${escHtml(m.email || 'no email')})</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="create-form-actions" style="justify-content:flex-start; margin-top:16px;">
      <button class="btn btn-primary" onclick="saveClientOverview('${company.id}')">Save →</button>
    </div>

    <div class="detail-section-title">Client Code</div>
    ${membershipPanel}

    <div class="detail-section-title">Company Roster</div>
    <p class="view-sub" style="margin-top:-8px;">Everyone registered with this client's code. <a href="#" onclick="openAddressBookForCompany('${company.id}'); return false;">Manage contacts in Address Book →</a></p>
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Title</th><th>Portal</th></tr></thead>
        <tbody>${rosterRows || '<tr><td colspan="5">No one registered yet.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="detail-section-title">Training Records</div>
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead><tr><th>Name</th><th>Workshop</th><th>Status</th><th>Certificate</th></tr></thead>
        <tbody>${trainingRows || '<tr><td colspan="4">No training records yet.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="detail-section-title">Invoices</div>
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead><tr><th>Number</th><th>Type</th><th>Status</th><th>Total</th><th>Date</th><th></th></tr></thead>
        <tbody>${invoiceRowsHtml || '<tr><td colspan="6">No invoices yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

async function saveClientOverview(companyId) {
  const contactName = document.getElementById('detailContactName').value.trim() || null;
  const contactEmail = document.getElementById('detailContactEmail').value.trim() || null;

  let primaryContactId = contactName ? currentPrimaryContactId : null;
  if (contactName) {
    const { id, error: contactErr } = await upsertPrimaryContact(companyId, currentPrimaryContactId, contactName, contactEmail);
    if (contactErr) {
      alert(/duplicate key|unique/i.test(contactErr.message)
        ? 'That email is already on file for another contact — link them from the Address Book instead.'
        : 'Could not save primary contact: ' + contactErr.message);
      return;
    }
    primaryContactId = id;
  }

  const payload = {
    contact_name: contactName,
    contact_email: contactEmail,
    phones: editingPhones.filter(p => p.number && p.number.trim()),
    billing_address: document.getElementById('detailBillingAddress').value.trim() || null,
    primary_contact_participant_id: primaryContactId
  };
  const { error } = await ggClient.from('companies').update(payload).eq('id', companyId);
  if (error) { alert('Could not save: ' + error.message); return; }
  loadClientDetail();
}

async function setUnlimitedSeats(companyId, unlimited) {
  const { error } = await ggClient.from('company_membership').update({ max_seats: unlimited ? null : 5 }).eq('company_id', companyId);
  if (error) { alert('Could not save: ' + error.message); }
  loadClientDetail();
}

async function updateContactField(participantId, field, rawValue) {
  const { error } = await ggClient.from('participants').update({ [field]: rawValue.trim() || null }).eq('id', participantId);
  if (error) { alert('Could not save: ' + error.message); }
  loadAddressBook();
}

async function removeContact(participantId, name) {
  if (!confirm(`Remove ${name} from the address book? This cannot be undone.`)) return;
  const { error } = await ggClient.from('participants').delete().eq('id', participantId);
  if (error) {
    alert(/foreign key|violates/i.test(error.message)
      ? `Can't remove ${name} — they have training or registration history on file.`
      : 'Could not remove contact: ' + error.message);
    return;
  }
  loadAddressBook();
}

// ── ADDRESS BOOK (all contacts, filterable across clients) ──────
let addressBookCompanies = [];

async function loadAddressBookFilters() {
  const { data } = await ggClient.from('companies').select('id, name').order('name', { ascending: true });
  addressBookCompanies = data || [];
  const opts = addressBookCompanies.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  const filterSel = document.getElementById('abFilterCompany');
  const selectedFilter = filterSel.value;
  filterSel.innerHTML = '<option value="">All Companies</option>' + opts;
  filterSel.value = selectedFilter;

  document.getElementById('abNewCompany').innerHTML = '<option value="">— None —</option>' + opts;
}

async function loadAddressBook() {
  await loadAddressBookFilters();
  const container = document.getElementById('addressBookContent');
  container.innerHTML = '<p class="empty-hint">Loading...</p>';

  const companyFilter = document.getElementById('abFilterCompany').value;
  const statusFilter = document.getElementById('abFilterStatus').value;
  const search = document.getElementById('abFilterSearch').value.trim().toLowerCase();

  let query = ggClient
    .from('participants')
    .select('id, full_name, email, phone, title, company_id, is_active, auth_user_id, companies!company_id(name, org_admin_participant_id)')
    .order('full_name', { ascending: true });
  if (companyFilter) query = query.eq('company_id', companyFilter);

  const { data: rows, error } = await query;
  if (error) { container.innerHTML = `<p class="empty-hint">Error: ${escHtml(error.message)}</p>`; return; }

  let filtered = rows || [];
  if (statusFilter === 'active') filtered = filtered.filter(p => p.is_active && p.auth_user_id);
  if (statusFilter === 'none') filtered = filtered.filter(p => !(p.is_active && p.auth_user_id));
  if (search) {
    filtered = filtered.filter(p =>
      (p.full_name || '').toLowerCase().includes(search) ||
      (p.email || '').toLowerCase().includes(search) ||
      (p.phone || '').toLowerCase().includes(search) ||
      (p.title || '').toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) { container.innerHTML = '<p class="empty-hint">No contacts match.</p>'; return; }

  container.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Title</th><th>Portal</th><th></th></tr></thead>
        <tbody>
          ${filtered.map(p => {
            const isOrgAdmin = p.companies?.org_admin_participant_id === p.id;
            const hasPortalAccess = p.is_active && p.auth_user_id;
            const canRemove = !hasPortalAccess && !isOrgAdmin;
            return `
              <tr>
                <td>${escHtml(p.full_name || '—')}${isOrgAdmin ? ' <span class="wc-badge">Org Admin</span>' : ''}</td>
                <td>
                  <select class="field-input" onchange="reassignContactCompany('${p.id}', this.value)">
                    <option value="">— None —</option>
                    ${addressBookCompanies.map(c => `<option value="${c.id}" ${p.company_id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
                  </select>
                </td>
                <td><input type="email" class="field-input" value="${escHtml(p.email || '')}" onchange="updateContactField('${p.id}', 'email', this.value)" /></td>
                <td><input type="text" class="field-input" value="${escHtml(p.phone || '')}" onchange="updateContactField('${p.id}', 'phone', this.value)" /></td>
                <td><input type="text" class="field-input" value="${escHtml(p.title || '')}" onchange="updateContactField('${p.id}', 'title', this.value)" /></td>
                <td>${hasPortalAccess ? '<span class="reg-card-status-badge attended">Active</span>' : '<span class="reg-card-status-badge no_show">Not signed up</span>'}</td>
                <td>${canRemove
                  ? `<button class="btn-sm btn-sm-danger" onclick="removeContact('${p.id}', '${escHtml(p.full_name || 'this contact').replace(/'/g, "\\'")}')">Remove</button>`
                  : `<span class="empty-hint" title="${isOrgAdmin ? 'Reassign the org admin first' : 'Manage portal access from their Company view in the client portal'}">Locked</span>`}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showCreateContact() {
  document.getElementById('createContactCard').style.display = 'block';
}
function hideCreateContact() {
  document.getElementById('createContactCard').style.display = 'none';
}

async function createAddressBookContact() {
  const fullName = document.getElementById('abNewName').value.trim();
  if (!fullName) { alert('Full name is required.'); return; }

  const { error } = await ggClient.from('participants').insert({
    full_name: fullName,
    company_id: document.getElementById('abNewCompany').value || null,
    email: document.getElementById('abNewEmail').value.trim() || null,
    phone: document.getElementById('abNewPhone').value.trim() || null,
    title: document.getElementById('abNewTitle').value.trim() || null
  });

  if (error) {
    alert(/duplicate key|unique/i.test(error.message) ? 'That email is already on file for another contact.' : 'Could not add contact: ' + error.message);
    return;
  }

  document.getElementById('abNewName').value = '';
  document.getElementById('abNewCompany').value = '';
  document.getElementById('abNewEmail').value = '';
  document.getElementById('abNewPhone').value = '';
  document.getElementById('abNewTitle').value = '';
  hideCreateContact();
  loadAddressBook();
}

async function reassignContactCompany(participantId, companyId) {
  const { error } = await ggClient.from('participants').update({ company_id: companyId || null }).eq('id', participantId);
  if (error) { alert('Could not reassign: ' + error.message); }
  loadAddressBook();
}

async function openAddressBookForCompany(companyId) {
  setView('address-book', document.querySelector('[data-view="address-book"]'));
  await loadAddressBookFilters();
  document.getElementById('abFilterCompany').value = companyId;
  loadAddressBook();
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
