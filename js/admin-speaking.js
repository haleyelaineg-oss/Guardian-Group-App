// ============================================================
// GUARDIAN GROUP — admin-speaking.js
// Handles the Speaking Engagement lifecycle: Opportunity → CFP →
// Application → Selection → Planning → ... → Post-Event. A
// speaking_engagements row exists independently while the
// opportunity is still just an application; moving its status to
// 'selected' creates (or reuses, never duplicates) a linked
// `events` row so it joins the shared Calendar/itinerary/expenses/
// documents/tasks spine everything else already uses. The
// engagement stays the source of truth for title/dates/location/
// income — every save pushes those fields onto the linked event;
// edits made directly on the event never flow back.
// Relies on globals defined in admin.js (ggClient, escHtml,
// formatCurrency, formatDate, todayIsoDate, capWords), admin-
// calendar.js (showEventDetail, loadCalendarMonth, handleClient
// SelectChange), and admin-engagements.js (SPEAKING_STATUS_LABELS,
// renderStatusBadge, peopleArrayToText, textToPeopleArray).
// ============================================================

let allSpeakingCache = [];
let editingSpeakingId = null;
let currentSpeakingEngagement = null;
let currentSpeakingSubmissions = [];

// Statuses that imply "this is a real, scheduled engagement" — any of
// these without a linked event (whether reached by editing the status
// live, or set directly at creation for a speaker who was asked to
// speak with no CFP/application involved) should prompt to create one.
// Declined/withdrawn/cancelled never need an event.
const EVENT_IMPLIED_SPEAKING_STATUSES = new Set([
  'selected', 'contracting', 'planning', 'ready', 'completed', 'payment_pending', 'closed'
]);

// ── LIST VIEW ────────────────────────────────────────────────
async function loadSpeakingView() {
  const tbody = document.getElementById('speakingTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

  const { data, error } = await ggClient.from('speaking_engagements').select('*').order('event_start_date', { ascending: true, nullsFirst: false });
  if (error) { tbody.innerHTML = `<tr><td colspan="6">Error: ${escHtml(error.message)}</td></tr>`; return; }

  allSpeakingCache = data || [];
  await renderSpeakingStats();
  renderSpeakingTable();
}

async function renderSpeakingStats() {
  const statsEl = document.getElementById('speakingStats');
  if (!statsEl) return;
  const todayStr = todayIsoDate();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const horizonStr = toDateInputValue(horizon);

  const opportunities = allSpeakingCache.filter(e => e.status === 'opportunity').length;
  const awaitingDecision = allSpeakingCache.filter(e => ['applied', 'under_review'].includes(e.status)).length;
  const confirmedUpcoming = allSpeakingCache.filter(e =>
    !['opportunity', 'preparing_submission', 'applied', 'under_review', 'declined', 'withdrawn', 'cancelled', 'closed'].includes(e.status) &&
    e.event_start_date && e.event_start_date >= todayStr
  ).length;
  const expectedRevenue = allSpeakingCache
    .filter(e => !['declined', 'withdrawn', 'cancelled', 'closed'].includes(e.status))
    .reduce((sum, e) => sum + (Number(e.offered_fee) || Number(e.requested_fee) || 0), 0);
  const paymentPending = allSpeakingCache.filter(e => e.status === 'payment_pending').length;

  // Two cheap cross-table counts (checklist items due soon; travel legs
  // not yet booked), scoped to this kind by column/event-id filters
  // rather than a join — no RPC needed for either.
  const linkedEventIds = allSpeakingCache.map(e => e.event_id).filter(Boolean);
  const [{ count: prepDue }, travelResult] = await Promise.all([
    ggClient.from('engagement_checklist_items').select('id', { count: 'exact', head: true })
      .not('speaking_engagement_id', 'is', null).eq('status', 'pending').lte('due_date', horizonStr),
    linkedEventIds.length
      ? ggClient.from('event_itinerary_items').select('id', { count: 'exact', head: true })
          .in('event_id', linkedEventIds).in('item_type', TRAVEL_ITEM_TYPES).eq('status', 'planned')
      : Promise.resolve({ count: 0 })
  ]);

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${opportunities}</div>
      <div class="stat-label">Opportunities</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${awaitingDecision}</div>
      <div class="stat-label">Awaiting Decision</div>
    </div>
    <div class="stat-card accent">
      <div class="stat-value">${confirmedUpcoming}</div>
      <div class="stat-label">Confirmed Upcoming</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(expectedRevenue)}</div>
      <div class="stat-label">Expected Speaking Revenue</div>
    </div>
    <div class="stat-card ${prepDue ? 'over-budget' : ''}">
      <div class="stat-value">${prepDue || 0}</div>
      <div class="stat-label">Prep Items Due (7 Days)</div>
    </div>
    <div class="stat-card ${travelResult.count ? 'over-budget' : ''}">
      <div class="stat-value">${travelResult.count || 0}</div>
      <div class="stat-label">Travel Needs Attention</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${paymentPending}</div>
      <div class="stat-label">Payment Pending</div>
    </div>
  `;
}

function renderSpeakingTable() {
  const tbody = document.getElementById('speakingTableBody');
  if (!tbody) return;

  const statusFilter = document.getElementById('speakingStatusFilter').value;
  const timeframeFilter = document.getElementById('speakingTimeframeFilter').value;
  const q = document.getElementById('speakingSearchInput').value.trim().toLowerCase();
  const todayStr = todayIsoDate();

  let rows = allSpeakingCache;
  if (statusFilter !== 'all') rows = rows.filter(e => e.status === statusFilter);
  if (timeframeFilter === 'upcoming') rows = rows.filter(e => e.event_start_date && e.event_start_date >= todayStr);
  if (timeframeFilter === 'past') rows = rows.filter(e => e.event_start_date && e.event_start_date < todayStr);
  if (q) {
    rows = rows.filter(e =>
      (e.event_name || '').toLowerCase().includes(q) ||
      (e.organization_name || '').toLowerCase().includes(q) ||
      peopleArrayToText(e.speakers).toLowerCase().includes(q)
    );
  }

  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6">No speaking engagements match.</td></tr>'; return; }

  tbody.innerHTML = rows.map(e => {
    const location = [e.city, e.region, e.country].filter(Boolean).join(', ') || '—';
    const dates = e.event_start_date
      ? formatDate(e.event_start_date) + (e.event_end_date && e.event_end_date !== e.event_start_date ? ' – ' + formatDate(e.event_end_date) : '')
      : (e.cfp_deadline ? 'CFP due ' + formatDate(e.cfp_deadline) : '—');
    return `
      <tr class="client-list-row" onclick="showSpeakingDetail('${e.id}')">
        <td>${escHtml(e.event_name)}</td>
        <td>${escHtml(e.organization_name || '—')}</td>
        <td>${escHtml(location)}</td>
        <td>${escHtml(dates)}</td>
        <td>${escHtml(peopleArrayToText(e.speakers) || '—')}</td>
        <td>${renderStatusBadge(e.status, SPEAKING_STATUS_LABELS)}</td>
      </tr>
    `;
  }).join('');
}

// ── CREATE (Opportunity intake) ─────────────────────────────
function showCreateSpeaking() {
  document.getElementById('createSpeakingModal').style.display = 'flex';
}
function hideCreateSpeaking() {
  document.getElementById('createSpeakingModal').style.display = 'none';
}

async function createSpeakingEngagement() {
  const eventName = document.getElementById('spkNewEventName').value.trim();
  if (!eventName) { alert('Event name is required.'); return; }

  const requestedFee = document.getElementById('spkNewRequestedFee').value;

  const payload = {
    event_name: eventName,
    status: document.getElementById('spkNewStatus').value,
    organization_name: document.getElementById('spkNewOrganization').value.trim() || null,
    event_website: document.getElementById('spkNewWebsite').value.trim() || null,
    city: document.getElementById('spkNewCity').value.trim() || null,
    region: document.getElementById('spkNewRegion').value.trim() || null,
    country: document.getElementById('spkNewCountry').value.trim() || null,
    cfp_deadline: document.getElementById('spkNewCfpDeadline').value || null,
    date_discovered: document.getElementById('spkNewDateDiscovered').value || null,
    application_url: document.getElementById('spkNewApplicationUrl').value.trim() || null,
    contact_name: document.getElementById('spkNewContactName').value.trim() || null,
    contact_email: document.getElementById('spkNewContactEmail').value.trim() || null,
    contact_phone: document.getElementById('spkNewContactPhone').value.trim() || null,
    requested_fee: requestedFee ? parseFloat(requestedFee) : null,
    notes: document.getElementById('spkNewNotes').value.trim() || null
  };

  const { error } = await ggClient.from('speaking_engagements').insert(payload);
  if (error) { alert('Could not add speaking opportunity: ' + error.message); return; }

  ['spkNewEventName', 'spkNewOrganization', 'spkNewWebsite', 'spkNewCity', 'spkNewRegion', 'spkNewCountry',
   'spkNewCfpDeadline', 'spkNewDateDiscovered', 'spkNewApplicationUrl', 'spkNewContactName', 'spkNewContactEmail',
   'spkNewContactPhone', 'spkNewRequestedFee', 'spkNewNotes'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('spkNewStatus').value = 'opportunity';

  hideCreateSpeaking();
  loadSpeakingView();
}

// ── DETAIL MODAL ─────────────────────────────────────────────
async function showSpeakingDetail(id) {
  editingSpeakingId = id;
  document.getElementById('speakingDetailModal').style.display = 'flex';
  switchSpeakingTab('overview');
  await loadSpeakingDetail();
}

function hideSpeakingDetail() {
  document.getElementById('speakingDetailModal').style.display = 'none';
  editingSpeakingId = null;
  currentSpeakingEngagement = null;
}

const SPEAKING_TAB_SUFFIX = {
  overview: 'Overview', submission: 'Submission', sessions: 'Sessions', prep: 'Prep', travel: 'Travel',
  homeLogistics: 'HomeLogistics', financials: 'Financials', documents: 'Documents', postEvent: 'PostEvent'
};

function switchSpeakingTab(tabName) {
  Object.keys(SPEAKING_TAB_SUFFIX).forEach(t => {
    const suffix = SPEAKING_TAB_SUFFIX[t];
    document.getElementById(`spkTabPanel${suffix}`).classList.toggle('active', t === tabName);
    document.getElementById(`spkTabBtn${suffix}`).classList.toggle('active', t === tabName);
  });
}

async function loadSpeakingDetail() {
  if (!editingSpeakingId) return;

  const [{ data: engagement, error }, { data: submissions }] = await Promise.all([
    ggClient.from('speaking_engagements').select('*').eq('id', editingSpeakingId).single(),
    ggClient.from('speaking_submissions').select('*').eq('speaking_engagement_id', editingSpeakingId).order('submitted_at', { ascending: false })
  ]);

  if (error || !engagement) { alert('Could not load speaking engagement.'); hideSpeakingDetail(); return; }

  currentSpeakingEngagement = engagement;
  currentSpeakingSubmissions = submissions || [];

  document.getElementById('speakingDetailTitle').textContent = engagement.event_name;
  renderSpeakingOverviewTab(engagement);
  renderSpeakingSubmissionsList();
  reloadChecklistPanel('speaking', editingSpeakingId);
  loadSpeakingTravelTab(engagement);
  loadSpeakingHomeLogisticsTab(engagement);
  reloadSpeakingSessions(engagement.event_id);
  loadFinancialsPanel('speaking', engagement.event_id);
  loadDocumentsPanel('speaking', engagement.event_id);
  renderSpeakingPostEventTab(engagement);
}

// ── PREP TAB (checklist) ─────────────────────────────────────
async function addSpeakingChecklistItem() {
  if (!editingSpeakingId) return;
  await addChecklistItem('speaking', editingSpeakingId, 'spkNewChecklistTitle', 'spkNewChecklistDueDate', 'spkNewChecklistOwner');
}

async function generateSpeakingDefaultChecklist() {
  if (!editingSpeakingId) return;
  const btn = document.getElementById('spkGenerateChecklistBtn');
  if (btn) btn.disabled = true;
  await generateDefaultChecklist('speaking', editingSpeakingId);
  await reloadChecklistPanel('speaking', editingSpeakingId);
  if (btn) btn.disabled = false;
}

// ── TRAVEL TAB (guided wizard) ───────────────────────────────
async function loadSpeakingTravelTab(engagement) {
  const wizardArea = document.getElementById('spkTravelWizardArea');
  if (!engagement.event_id) {
    wizardArea.innerHTML = '<p class="empty-hint">Travel planning is available once this engagement is linked to a Calendar event.</p>';
    document.getElementById('spkTravelItemsList').innerHTML = '';
    return;
  }
  wizardArea.innerHTML = '<button class="btn-sm btn-sm-ghost" onclick="showSpeakingTravelWizard()">+ Plan Travel</button>';
  await reloadTravelItems('speaking', engagement.event_id);
}

function showSpeakingTravelWizard() {
  if (!currentSpeakingEngagement || !currentSpeakingEngagement.event_id) return;
  const e = currentSpeakingEngagement;
  const location = [e.venue, e.city, e.region].filter(Boolean).join(', ');
  showTravelWizard('speaking', e.event_id, e.event_start_date, e.event_end_date || e.event_start_date, location);
}

// ── HOME LOGISTICS TAB (childcare / pet care) ────────────────
async function loadSpeakingHomeLogisticsTab(engagement) {
  if (!engagement.event_id) {
    document.getElementById('spkCareArrangementsList').innerHTML = '<p class="empty-hint">Available once this engagement is linked to a Calendar event.</p>';
    return;
  }
  await reloadCareArrangements('speaking', engagement.event_id);
}

async function addSpeakingCareArrangement() {
  if (!currentSpeakingEngagement || !currentSpeakingEngagement.event_id) { alert('Link this engagement to a Calendar event first (set Status to Selected or later).'); return; }
  await addCareArrangement('speaking', currentSpeakingEngagement.event_id);
}

// ── SESSIONS TAB (structured talk records, one engagement can have
// several — e.g. a conference where the same trip covers two
// different sessions) ─────────────────────────────────────────
// Stored as event_itinerary_items rows with item_type
// 'speaking_session', reusing the columns migration-c added
// (speakers/session_type/description/learning_objectives/
// av_requirements) rather than a new table. Kept out of the shared
// admin-engagements.js engine since Training has no Sessions tab.
let currentSpeakingSessions = [];
let editingSpeakingSessionId = null;

async function reloadSpeakingSessions(eventId) {
  const list = document.getElementById('spkSessionsList');
  if (!eventId) {
    currentSpeakingSessions = [];
    list.innerHTML = '<p class="empty-hint">Available once this engagement is linked to a Calendar event.</p>';
    document.getElementById('showAddSpeakingSessionBtn').style.display = 'none';
    return;
  }
  document.getElementById('showAddSpeakingSessionBtn').style.display = 'inline-block';

  const { data, error } = await ggClient.from('event_itinerary_items')
    .select('*').eq('event_id', eventId).eq('item_type', 'speaking_session').order('starts_at', { ascending: true, nullsFirst: false });
  currentSpeakingSessions = error ? [] : (data || []);
  renderSpeakingSessionsList();
}

function renderSpeakingSessionsList() {
  const list = document.getElementById('spkSessionsList');
  if (!currentSpeakingSessions.length) {
    list.innerHTML = '<p class="empty-hint">No sessions added yet.</p>';
    return;
  }
  list.innerHTML = currentSpeakingSessions.map(s => `
    <div class="workshop-card" style="margin-bottom:12px;">
      <div class="wc-title">${escHtml(s.title)}</div>
      <div class="wc-meta">
        ${s.session_type ? `<span class="wc-badge">${escHtml(s.session_type)}</span>` : ''}
        ${s.starts_at ? `<span class="wc-badge">${formatDateTime(s.starts_at)}</span>` : ''}
        ${s.speakers && s.speakers.length ? `<span class="wc-badge">${escHtml(peopleArrayToText(s.speakers))}</span>` : ''}
      </div>
      ${s.description ? `<p style="font-size:13px; color:var(--gg-text); margin-top:8px;">${escHtml(s.description)}</p>` : ''}
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button class="btn-sm btn-sm-ghost" onclick="editSpeakingSession('${s.id}')">Edit</button>
        <button class="btn-sm btn-sm-danger" onclick="deleteSpeakingSession('${s.id}')" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

function showAddSpeakingSession() {
  editingSpeakingSessionId = null;
  resetSpeakingSessionForm();
  document.getElementById('spkSessionCardTitle').textContent = 'Add Session';
  document.getElementById('spkSessionSubmitBtn').textContent = 'Add Session →';
  document.getElementById('addSpeakingSessionCard').style.display = 'block';
  document.getElementById('showAddSpeakingSessionBtn').style.display = 'none';
}
function hideAddSpeakingSession() {
  document.getElementById('addSpeakingSessionCard').style.display = 'none';
  document.getElementById('showAddSpeakingSessionBtn').style.display = 'inline-block';
}
function resetSpeakingSessionForm() {
  ['spkSessionTitle', 'spkSessionType', 'spkSessionDate', 'spkSessionStartTime', 'spkSessionEndTime',
   'spkSessionSpeakers', 'spkSessionDescription', 'spkSessionLearningObjectives', 'spkSessionAvRequirements'].forEach(id => { document.getElementById(id).value = ''; });
}

function editSpeakingSession(sessionId) {
  const s = currentSpeakingSessions.find(i => i.id === sessionId);
  if (!s) return;

  editingSpeakingSessionId = sessionId;
  document.getElementById('spkSessionTitle').value = s.title || '';
  document.getElementById('spkSessionType').value = s.session_type || '';
  document.getElementById('spkSessionDate').value = s.starts_at ? toDateInputValue(new Date(s.starts_at)) : '';
  document.getElementById('spkSessionStartTime').value = s.starts_at ? toTimeInputValue(new Date(s.starts_at)) : '';
  document.getElementById('spkSessionEndTime').value = s.ends_at ? toTimeInputValue(new Date(s.ends_at)) : '';
  document.getElementById('spkSessionSpeakers').value = peopleArrayToText(s.speakers);
  document.getElementById('spkSessionDescription').value = s.description || '';
  document.getElementById('spkSessionLearningObjectives').value = s.learning_objectives || '';
  document.getElementById('spkSessionAvRequirements').value = s.av_requirements || '';

  document.getElementById('spkSessionCardTitle').textContent = 'Edit Session';
  document.getElementById('spkSessionSubmitBtn').textContent = 'Save Session →';
  document.getElementById('addSpeakingSessionCard').style.display = 'block';
  document.getElementById('showAddSpeakingSessionBtn').style.display = 'none';
}

async function saveSpeakingSession() {
  if (!currentSpeakingEngagement || !currentSpeakingEngagement.event_id) return;
  const title = document.getElementById('spkSessionTitle').value.trim();
  if (!title) { alert('Session title is required.'); return; }

  const date = document.getElementById('spkSessionDate').value;
  const startTime = document.getElementById('spkSessionStartTime').value;
  const endTime = document.getElementById('spkSessionEndTime').value;

  const payload = {
    item_type: 'speaking_session',
    title,
    session_type: document.getElementById('spkSessionType').value.trim() || null,
    starts_at: date ? (buildScheduledAt(date, startTime) || new Date(`${date}T00:00:00`).toISOString()) : null,
    ends_at: date && endTime ? buildScheduledAt(date, endTime) : null,
    speakers: textToPeopleArray(document.getElementById('spkSessionSpeakers').value),
    description: document.getElementById('spkSessionDescription').value.trim() || null,
    learning_objectives: document.getElementById('spkSessionLearningObjectives').value.trim() || null,
    av_requirements: document.getElementById('spkSessionAvRequirements').value.trim() || null
  };

  const { error } = editingSpeakingSessionId
    ? await ggClient.from('event_itinerary_items').update(payload).eq('id', editingSpeakingSessionId)
    : await ggClient.from('event_itinerary_items').insert({ ...payload, event_id: currentSpeakingEngagement.event_id });
  if (error) { alert('Could not save session: ' + error.message); return; }

  editingSpeakingSessionId = null;
  hideAddSpeakingSession();
  await reloadSpeakingSessions(currentSpeakingEngagement.event_id);
}

async function deleteSpeakingSession(sessionId) {
  if (!confirm('Delete this session?')) return;
  const { error } = await ggClient.from('event_itinerary_items').delete().eq('id', sessionId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  await reloadSpeakingSessions(currentSpeakingEngagement.event_id);
}

// ── POST-EVENT TAB ────────────────────────────────────────────
function renderSpeakingPostEventTab(engagement) {
  document.getElementById('spkPostAttendeeCount').value = engagement.attendee_count != null ? engagement.attendee_count : '';
  document.getElementById('spkPostRecordingUrl').value = engagement.recording_url || '';
  document.getElementById('spkPostOutcomeNotes').value = engagement.outcome_notes || '';
}

async function saveSpeakingPostEvent() {
  if (!editingSpeakingId) return;
  const attendeeCount = document.getElementById('spkPostAttendeeCount').value;

  const { error } = await ggClient.from('speaking_engagements').update({
    attendee_count: attendeeCount ? parseInt(attendeeCount, 10) : null,
    recording_url: document.getElementById('spkPostRecordingUrl').value.trim() || null,
    outcome_notes: document.getElementById('spkPostOutcomeNotes').value.trim() || null
  }).eq('id', editingSpeakingId);
  if (error) { alert('Could not save: ' + error.message); return; }

  showSavedToast('Saved');
  loadSpeakingDetail();
}

function renderSpeakingOverviewTab(engagement) {
  document.getElementById('spkEditEventName').value = engagement.event_name || '';
  document.getElementById('spkEditOrganization').value = engagement.organization_name || '';
  document.getElementById('spkEditWebsite').value = engagement.event_website || '';
  document.getElementById('spkEditVenue').value = engagement.venue || '';
  document.getElementById('spkEditVenueAddress').value = engagement.venue_address || '';
  document.getElementById('spkEditCity').value = engagement.city || '';
  document.getElementById('spkEditRegion').value = engagement.region || '';
  document.getElementById('spkEditCountry').value = engagement.country || '';
  document.getElementById('spkEditZip').value = engagement.zip_code || '';
  document.getElementById('spkEditEventStartDate').value = engagement.event_start_date || '';
  document.getElementById('spkEditEventEndDate').value = engagement.event_end_date || '';
  document.getElementById('spkEditCfpDeadline').value = engagement.cfp_deadline || '';
  document.getElementById('spkEditDateDiscovered').value = engagement.date_discovered || '';
  document.getElementById('spkEditApplicationUrl').value = engagement.application_url || '';
  document.getElementById('spkEditContactName').value = engagement.contact_name || '';
  document.getElementById('spkEditContactEmail').value = engagement.contact_email || '';
  document.getElementById('spkEditContactPhone').value = engagement.contact_phone || '';
  renderSpeakerPills('spkSpeakerPills', 'spkEditSpeakersValue', peopleArrayToText(engagement.speakers));
  document.getElementById('spkEditRequestedFee').value = engagement.requested_fee != null ? engagement.requested_fee : '';
  document.getElementById('spkEditOfferedFee').value = engagement.offered_fee != null ? engagement.offered_fee : '';
  document.getElementById('spkEditTravelReimbursementLimit').value = engagement.travel_reimbursement_limit != null ? engagement.travel_reimbursement_limit : '';
  document.getElementById('spkEditTravelReimbursementOffered').checked = !!engagement.travel_reimbursement_offered;
  document.getElementById('spkEditStatus').value = engagement.status || 'opportunity';
  document.getElementById('spkEditNotes').value = engagement.notes || '';

  const banner = document.getElementById('spkLinkedEventBanner');
  banner.innerHTML = engagement.event_id
    ? `<p class="field-hint" style="margin-bottom:14px;">Linked to a Calendar event. <a href="#" onclick="hideSpeakingDetail(); showEventDetail('${engagement.event_id}'); return false;">View on Calendar →</a></p>`
    : '';
}

// Shared by both save buttons — reads every Overview field into an
// update payload. Returns null (after alerting) if required fields
// are missing, so callers can bail out without duplicating the check.
function readSpeakingFormPayload() {
  const eventName = document.getElementById('spkEditEventName').value.trim();
  if (!eventName) { alert('Event name is required.'); return null; }

  const requestedFee = document.getElementById('spkEditRequestedFee').value;
  const offeredFee = document.getElementById('spkEditOfferedFee').value;
  const reimbursementLimit = document.getElementById('spkEditTravelReimbursementLimit').value;
  const speakerValue = document.getElementById('spkEditSpeakersValue').value;

  return {
    event_name: eventName,
    organization_name: document.getElementById('spkEditOrganization').value.trim() || null,
    event_website: document.getElementById('spkEditWebsite').value.trim() || null,
    venue: document.getElementById('spkEditVenue').value.trim() || null,
    venue_address: document.getElementById('spkEditVenueAddress').value.trim() || null,
    city: document.getElementById('spkEditCity').value.trim() || null,
    region: document.getElementById('spkEditRegion').value.trim() || null,
    country: document.getElementById('spkEditCountry').value.trim() || null,
    zip_code: document.getElementById('spkEditZip').value.trim() || null,
    event_start_date: document.getElementById('spkEditEventStartDate').value || null,
    event_end_date: document.getElementById('spkEditEventEndDate').value || null,
    cfp_deadline: document.getElementById('spkEditCfpDeadline').value || null,
    date_discovered: document.getElementById('spkEditDateDiscovered').value || null,
    application_url: document.getElementById('spkEditApplicationUrl').value.trim() || null,
    contact_name: document.getElementById('spkEditContactName').value.trim() || null,
    contact_email: document.getElementById('spkEditContactEmail').value.trim() || null,
    contact_phone: document.getElementById('spkEditContactPhone').value.trim() || null,
    speakers: speakerValue ? [speakerValue] : [],
    requested_fee: requestedFee ? parseFloat(requestedFee) : null,
    offered_fee: offeredFee ? parseFloat(offeredFee) : null,
    travel_reimbursement_offered: document.getElementById('spkEditTravelReimbursementOffered').checked,
    travel_reimbursement_limit: reimbursementLimit ? parseFloat(reimbursementLimit) : null,
    status: document.getElementById('spkEditStatus').value,
    notes: document.getElementById('spkEditNotes').value.trim() || null
  };
}

async function saveSpeakingEngagement() {
  if (!editingSpeakingId) return;
  const payload = readSpeakingFormPayload();
  if (!payload) return;

  const { data: updated, error } = await ggClient.from('speaking_engagements').update(payload).eq('id', editingSpeakingId).select().single();
  if (error) { alert('Could not save: ' + error.message); return; }

  if (updated.event_id) await pushSpeakingToEvent(updated);

  const needsEventLink = EVENT_IMPLIED_SPEAKING_STATUSES.has(updated.status) && !updated.event_id;
  showSavedToast(needsEventLink ? 'Saved — use "Save + Add to Calendar" to schedule it' : 'Saved');

  loadSpeakingView();
  loadSpeakingDetail();
}

// Saves the form exactly like saveSpeakingEngagement, then ensures a
// linked Calendar event exists — creating it off the just-saved row
// (never the stale in-memory currentSpeakingEngagement) so the event
// always reflects what's actually on screen, or just re-pushing to an
// already-linked event so this button is always safe to click.
async function saveSpeakingEngagementAndLink() {
  if (!editingSpeakingId) return;
  const payload = readSpeakingFormPayload();
  if (!payload) return;

  const { data: updated, error } = await ggClient.from('speaking_engagements').update(payload).eq('id', editingSpeakingId).select().single();
  if (error) { alert('Could not save: ' + error.message); return; }

  if (updated.event_id) {
    await pushSpeakingToEvent(updated);
    showSavedToast('Saved — Calendar event updated');
    loadCalendarMonth();
    loadSpeakingView();
    loadSpeakingDetail();
    return;
  }

  if (!updated.event_start_date) {
    alert('Add an Event Start Date before adding this to the Calendar.');
    loadSpeakingView();
    loadSpeakingDetail();
    return;
  }

  const location = [updated.venue, updated.city, updated.region].filter(Boolean).join(', ') || null;
  const { data: newEvent, error: evErr } = await ggClient.from('events').insert({
    title: updated.event_name,
    event_type: 'speaking',
    starts_at: new Date(`${updated.event_start_date}T00:00:00`).toISOString(),
    ends_at: updated.event_end_date ? new Date(`${updated.event_end_date}T00:00:00`).toISOString() : null,
    all_day: true,
    location,
    status: mapSpeakingStatusToEventStatus(updated.status),
    income_amount: updated.offered_fee,
    link_url: updated.application_url
  }).select().single();
  if (evErr) { alert('Could not create linked event: ' + evErr.message); return; }

  const { error: updErr } = await ggClient.from('speaking_engagements').update({
    event_id: newEvent.id,
    selected_at: updated.selected_at || new Date().toISOString()
  }).eq('id', editingSpeakingId);
  if (updErr) { alert('Event was created, but the engagement could not be updated: ' + updErr.message); return; }

  await generateDefaultChecklist('speaking', editingSpeakingId);

  showSavedToast('Saved — added to Calendar');
  loadCalendarMonth();
  loadSpeakingView();
  loadSpeakingDetail();
}

async function deleteSpeakingEngagement() {
  if (!editingSpeakingId) return;
  if (!confirm('Delete this speaking engagement? Its submission history will also be deleted. A linked Calendar event, if any, is not deleted.')) return;

  const { error } = await ggClient.from('speaking_engagements').delete().eq('id', editingSpeakingId);
  if (error) { alert('Could not delete: ' + error.message); return; }

  hideSpeakingDetail();
  loadSpeakingView();
}

// ── EVENT SYNC (engagement → linked event, one-way) ─────────
function mapSpeakingStatusToEventStatus(status) {
  if (['selected', 'contracting', 'planning', 'ready'].includes(status)) return 'confirmed';
  if (['completed', 'payment_pending', 'closed'].includes(status)) return 'completed';
  if (['cancelled', 'declined', 'withdrawn'].includes(status)) return 'cancelled';
  return 'planning';
}

async function pushSpeakingToEvent(engagement) {
  const location = [engagement.venue, engagement.city, engagement.region].filter(Boolean).join(', ') || null;
  const payload = {
    title: engagement.event_name,
    location,
    status: mapSpeakingStatusToEventStatus(engagement.status),
    income_amount: engagement.offered_fee,
    link_url: engagement.application_url,
    ends_at: engagement.event_end_date ? new Date(`${engagement.event_end_date}T00:00:00`).toISOString() : null
  };
  if (engagement.event_start_date) {
    payload.starts_at = new Date(`${engagement.event_start_date}T00:00:00`).toISOString();
  }
  const { error } = await ggClient.from('events').update(payload).eq('id', engagement.event_id);
  if (error) console.error('Could not sync linked event:', error.message);
}

// ── SUBMISSION TAB (additive-only historical record) ────────
function renderSpeakingSubmissionsList() {
  const container = document.getElementById('spkSubmissionsList');
  if (!currentSpeakingSubmissions.length) {
    container.innerHTML = '<p class="empty-hint">No submissions logged yet — the text actually submitted to this conference/CFP is preserved here even if the live session details evolve later.</p>';
    return;
  }
  container.innerHTML = currentSpeakingSubmissions.map(sub => `
    <div class="workshop-card" style="margin-bottom:12px;">
      <div class="wc-title">${escHtml(sub.submitted_title || 'Untitled submission')}</div>
      <div class="wc-meta">
        ${sub.submitted_session_type ? `<span class="wc-badge">${escHtml(sub.submitted_session_type)}</span>` : ''}
        ${sub.requested_fee != null ? `<span class="wc-badge">${formatCurrency(sub.requested_fee)}</span>` : ''}
        <span class="wc-badge">Submitted ${formatDate((sub.submitted_at || '').slice(0, 10))}</span>
      </div>
      ${sub.submitted_abstract ? `<p style="font-size:13px; color:var(--gg-text); margin-top:8px;">${escHtml(sub.submitted_abstract)}</p>` : ''}
      ${sub.submitted_speakers && sub.submitted_speakers.length ? `<p class="field-hint">Speaker(s): ${escHtml(peopleArrayToText(sub.submitted_speakers))}</p>` : ''}
    </div>
  `).join('');
}

function showAddSpeakingSubmission() {
  document.getElementById('addSpeakingSubmissionCard').style.display = 'block';
  document.getElementById('showAddSpeakingSubmissionBtn').style.display = 'none';
}
function hideAddSpeakingSubmission() {
  document.getElementById('addSpeakingSubmissionCard').style.display = 'none';
  document.getElementById('showAddSpeakingSubmissionBtn').style.display = 'inline-block';
}

async function saveSpeakingSubmission() {
  if (!editingSpeakingId) return;

  const requestedFee = document.getElementById('spkSubRequestedFee').value;
  const payload = {
    speaking_engagement_id: editingSpeakingId,
    submitted_title: document.getElementById('spkSubTitle').value.trim() || null,
    submitted_session_type: document.getElementById('spkSubSessionType').value.trim() || null,
    submitted_abstract: document.getElementById('spkSubAbstract').value.trim() || null,
    submitted_learning_objectives: document.getElementById('spkSubLearningObjectives').value.trim() || null,
    submitted_bio: document.getElementById('spkSubBio').value.trim() || null,
    submitted_speakers: textToPeopleArray(document.getElementById('spkSubSpeakers').value),
    requested_fee: requestedFee ? parseFloat(requestedFee) : null,
    application_url: document.getElementById('spkSubApplicationUrl').value.trim() || null,
    notes: document.getElementById('spkSubNotes').value.trim() || null
  };

  const { error } = await ggClient.from('speaking_submissions').insert(payload);
  if (error) { alert('Could not save submission: ' + error.message); return; }

  ['spkSubTitle', 'spkSubSessionType', 'spkSubRequestedFee', 'spkSubAbstract', 'spkSubLearningObjectives',
   'spkSubBio', 'spkSubSpeakers', 'spkSubApplicationUrl', 'spkSubNotes'].forEach(id => { document.getElementById(id).value = ''; });

  hideAddSpeakingSubmission();
  loadSpeakingDetail();
}
