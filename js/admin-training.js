// ============================================================
// GUARDIAN GROUP — admin-training.js
// Handles the Training Engagement lifecycle: Inquiry → Proposal →
// Contract → Scheduled → ... → Paid. A training_engagements row
// always belongs to a client (company_id) from the start. Moving
// its status to 'scheduled' creates (or reuses, never duplicates)
// a linked `events` row so it joins the shared Calendar/itinerary/
// expenses/documents/tasks spine. The engagement stays the source
// of truth for title/dates/location/status; every save pushes
// those fields onto the linked event — edits made directly on the
// event never flow back. The In-Person/Virtual delivery-method
// toggle only hides the irrelevant field group; switching methods
// never clears already-entered values on either side.
// Relies on globals defined in admin.js (ggClient, escHtml,
// formatCurrency, formatDate, todayIsoDate, buildScheduledAt),
// admin-calendar.js (showEventDetail, loadCalendarMonth,
// populateEventSelectOptions, fillCompanySelect, handleClient
// SelectChange, toDateInputValue, toTimeInputValue), and admin-
// engagements.js (TRAINING_STATUS_LABELS, renderStatusBadge).
// ============================================================

let allTrainingCache = [];
let editingTrainingId = null;
let currentTrainingEngagement = null;

// ── LIST VIEW ────────────────────────────────────────────────
async function loadTrainingView() {
  const tbody = document.getElementById('trainingTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

  const { data, error } = await ggClient.from('training_engagements').select('*, companies!company_id(name)').order('starts_at', { ascending: true, nullsFirst: false });
  if (error) { tbody.innerHTML = `<tr><td colspan="6">Error: ${escHtml(error.message)}</td></tr>`; return; }

  allTrainingCache = data || [];
  await renderTrainingStats();
  renderTrainingTable();
}

async function renderTrainingStats() {
  const statsEl = document.getElementById('trainingStats');
  if (!statsEl) return;
  const todayStr = todayIsoDate();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const horizonStr = toDateInputValue(horizon);

  const upcoming = allTrainingCache.filter(e => e.starts_at && e.starts_at.slice(0, 10) >= todayStr && e.status !== 'cancelled').length;
  const inPerson = allTrainingCache.filter(e => e.delivery_method === 'in_person' && e.status !== 'cancelled').length;
  const virtual = allTrainingCache.filter(e => e.delivery_method === 'virtual' && e.status !== 'cancelled').length;
  const paymentPending = allTrainingCache.filter(e => ['invoice_pending', 'payment_pending'].includes(e.status)).length;

  // No dedicated fee field on training_engagements — expected revenue
  // is whatever's set on the linked event's income_amount, so it's
  // summed with one extra query rather than being in the cached list.
  const linkedEventIds = allTrainingCache.map(e => e.event_id).filter(Boolean);
  const [{ data: linkedEvents }, { count: prepDue }, travelResult] = await Promise.all([
    linkedEventIds.length
      ? ggClient.from('events').select('income_amount').in('id', linkedEventIds)
      : Promise.resolve({ data: [] }),
    ggClient.from('engagement_checklist_items').select('id', { count: 'exact', head: true })
      .not('training_engagement_id', 'is', null).eq('status', 'pending').lte('due_date', horizonStr),
    linkedEventIds.length
      ? ggClient.from('event_itinerary_items').select('id', { count: 'exact', head: true })
          .in('event_id', linkedEventIds).in('item_type', TRAVEL_ITEM_TYPES).eq('status', 'planned')
      : Promise.resolve({ count: 0 })
  ]);
  const expectedRevenue = (linkedEvents || []).reduce((sum, e) => sum + (Number(e.income_amount) || 0), 0);

  statsEl.innerHTML = `
    <div class="stat-card accent">
      <div class="stat-value">${upcoming}</div>
      <div class="stat-label">Upcoming Trainings</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${inPerson}</div>
      <div class="stat-label">In-Person</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${virtual}</div>
      <div class="stat-label">Virtual</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(expectedRevenue)}</div>
      <div class="stat-label">Expected Revenue</div>
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

function renderTrainingTable() {
  const tbody = document.getElementById('trainingTableBody');
  if (!tbody) return;

  const statusFilter = document.getElementById('trainingStatusFilter').value;
  const deliveryFilter = document.getElementById('trainingDeliveryFilter').value;
  const timeframeFilter = document.getElementById('trainingTimeframeFilter').value;
  const q = document.getElementById('trainingSearchInput').value.trim().toLowerCase();
  const todayStr = todayIsoDate();

  let rows = allTrainingCache;
  if (statusFilter !== 'all') rows = rows.filter(e => e.status === statusFilter);
  if (deliveryFilter !== 'all') rows = rows.filter(e => e.delivery_method === deliveryFilter);
  if (timeframeFilter === 'upcoming') rows = rows.filter(e => e.starts_at && e.starts_at.slice(0, 10) >= todayStr);
  if (timeframeFilter === 'past') rows = rows.filter(e => e.starts_at && e.starts_at.slice(0, 10) < todayStr);
  if (q) {
    rows = rows.filter(e =>
      (e.companies?.name || '').toLowerCase().includes(q) ||
      (e.title || '').toLowerCase().includes(q) ||
      peopleArrayToText(e.instructors).toLowerCase().includes(q)
    );
  }

  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6">No training engagements match.</td></tr>'; return; }

  tbody.innerHTML = rows.map(e => {
    const dates = e.starts_at
      ? formatDateTime(e.starts_at) + (e.ends_at ? ' – ' + formatDateTime(e.ends_at) : '')
      : '—';
    return `
      <tr class="client-list-row" onclick="showTrainingDetail('${e.id}')">
        <td>${escHtml(e.companies?.name || '—')}</td>
        <td>${escHtml(e.title)}</td>
        <td>${e.delivery_method === 'virtual' ? 'Virtual' : 'In-Person'}</td>
        <td>${escHtml(dates)}</td>
        <td>${escHtml(peopleArrayToText(e.instructors) || '—')}</td>
        <td>${renderStatusBadge(e.status, TRAINING_STATUS_LABELS)}</td>
      </tr>
    `;
  }).join('');
}

// ── CREATE ───────────────────────────────────────────────────
function showCreateTraining() {
  document.getElementById('createTrainingModal').style.display = 'flex';
  populateEventSelectOptions('trnNewCompany');
}
function hideCreateTraining() {
  document.getElementById('createTrainingModal').style.display = 'none';
}

async function handleTrainingCompanySelectChange(selectEl, participantSelectId) {
  if (selectEl.value === '__new__') {
    await handleClientSelectChange(selectEl);
  }
  await loadTrainingContactOptions(selectEl.value, participantSelectId);
}

async function loadTrainingContactOptions(companyId, participantSelectId) {
  const select = document.getElementById(participantSelectId);
  if (!select) return;
  if (!companyId) { select.innerHTML = '<option value="">— None —</option>'; return; }

  const { data, error } = await ggClient.from('participants').select('id, full_name').eq('company_id', companyId).order('full_name');
  const value = select.value;
  select.innerHTML = '<option value="">— None —</option>' + (error ? '' : (data || []).map(p => `<option value="${p.id}">${escHtml(p.full_name)}</option>`).join(''));
  select.value = value;
}

async function createTrainingEngagement() {
  const companyId = document.getElementById('trnNewCompany').value;
  const title = document.getElementById('trnNewTitle').value.trim();
  if (!companyId || companyId === '__new__') { alert('Client is required.'); return; }
  if (!title) { alert('Training title is required.'); return; }

  const startDate = document.getElementById('trnNewStartDate').value;
  const startTime = document.getElementById('trnNewStartTime').value;
  const endDate = document.getElementById('trnNewEndDate').value;
  const endTime = document.getElementById('trnNewEndTime').value;
  const attendeeCount = document.getElementById('trnNewAttendeeCount').value;

  const payload = {
    company_id: companyId,
    contact_participant_id: document.getElementById('trnNewContactParticipant').value || null,
    title,
    training_type: document.getElementById('trnNewTrainingType').value.trim() || null,
    delivery_method: document.getElementById('trnNewDeliveryMethod').value,
    starts_at: startDate ? (buildScheduledAt(startDate, startTime) || new Date(`${startDate}T00:00:00`).toISOString()) : null,
    ends_at: endDate ? (buildScheduledAt(endDate, endTime) || new Date(`${endDate}T00:00:00`).toISOString()) : null,
    attendee_count: attendeeCount ? parseInt(attendeeCount, 10) : null,
    description: document.getElementById('trnNewDescription').value.trim() || null,
    notes: document.getElementById('trnNewNotes').value.trim() || null
  };

  const { error } = await ggClient.from('training_engagements').insert(payload);
  if (error) { alert('Could not add training engagement: ' + error.message); return; }

  ['trnNewTitle', 'trnNewTrainingType', 'trnNewStartDate', 'trnNewStartTime', 'trnNewEndDate', 'trnNewEndTime',
   'trnNewAttendeeCount', 'trnNewDescription', 'trnNewNotes'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('trnNewCompany').value = '';
  document.getElementById('trnNewContactParticipant').innerHTML = '<option value="">— None —</option>';
  document.getElementById('trnNewDeliveryMethod').value = 'in_person';

  hideCreateTraining();
  loadTrainingView();
}

// ── DETAIL MODAL ─────────────────────────────────────────────
async function showTrainingDetail(id) {
  editingTrainingId = id;
  document.getElementById('trainingDetailModal').style.display = 'flex';
  await populateEventSelectOptions('trnEditCompany');
  switchTrainingTab('overview');
  await loadTrainingDetail();
}

function hideTrainingDetail() {
  document.getElementById('trainingDetailModal').style.display = 'none';
  editingTrainingId = null;
  currentTrainingEngagement = null;
}

const TRAINING_TAB_SUFFIX = {
  overview: 'Overview', delivery: 'Delivery', prep: 'Prep', travel: 'Travel',
  financials: 'Financials', documents: 'Documents', completion: 'Completion'
};

function switchTrainingTab(tabName) {
  Object.keys(TRAINING_TAB_SUFFIX).forEach(t => {
    const suffix = TRAINING_TAB_SUFFIX[t];
    document.getElementById(`trnTabPanel${suffix}`).classList.toggle('active', t === tabName);
    document.getElementById(`trnTabBtn${suffix}`).classList.toggle('active', t === tabName);
  });
}

// Virtual trainings have no Travel tab at all — not just an empty one.
function updateTrainingTravelTabVisibility() {
  const isVirtual = document.getElementById('trnEditDeliveryMethod').value === 'virtual';
  const travelBtn = document.getElementById('trnTabBtnTravel');
  travelBtn.style.display = isVirtual ? 'none' : '';
  if (isVirtual && travelBtn.classList.contains('active')) switchTrainingTab('overview');
}

async function loadTrainingDetail() {
  if (!editingTrainingId) return;

  const { data: engagement, error } = await ggClient.from('training_engagements').select('*').eq('id', editingTrainingId).single();
  if (error || !engagement) { alert('Could not load training engagement.'); hideTrainingDetail(); return; }

  currentTrainingEngagement = engagement;
  document.getElementById('trainingDetailTitle').textContent = engagement.title;
  await loadTrainingContactOptions(engagement.company_id, 'trnEditContactParticipant');
  renderTrainingOverviewTab(engagement);
  renderTrainingDeliveryTab(engagement);
  reloadChecklistPanel('training', editingTrainingId);
  loadTrainingTravelTab(engagement);
  loadFinancialsPanel('training', engagement.event_id);
  loadDocumentsPanel('training', engagement.event_id);
  renderTrainingCompletionTab(engagement);
}

// ── PREP TAB (checklist) ─────────────────────────────────────
async function addTrainingChecklistItem() {
  if (!editingTrainingId) return;
  await addChecklistItem('training', editingTrainingId, 'trnNewChecklistTitle', 'trnNewChecklistDueDate', 'trnNewChecklistOwner');
}

async function generateTrainingDefaultChecklist() {
  if (!editingTrainingId || !currentTrainingEngagement) return;
  const btn = document.getElementById('trnGenerateChecklistBtn');
  if (btn) btn.disabled = true;
  await generateDefaultChecklist('training', editingTrainingId, currentTrainingEngagement.delivery_method);
  await reloadChecklistPanel('training', editingTrainingId);
  if (btn) btn.disabled = false;
}

// ── TRAVEL TAB (guided wizard + care arrangements — In-Person only) ──
async function loadTrainingTravelTab(engagement) {
  const wizardArea = document.getElementById('trnTravelWizardArea');
  if (!engagement.event_id) {
    wizardArea.innerHTML = '<p class="empty-hint">Travel planning is available once this engagement is linked to a Calendar event.</p>';
    document.getElementById('trnTravelItemsList').innerHTML = '';
    document.getElementById('trnCareArrangementsList').innerHTML = '';
    return;
  }
  wizardArea.innerHTML = '<button class="btn-sm btn-sm-ghost" onclick="showTrainingTravelWizard()">+ Plan Travel</button>';
  await reloadTravelItems('training', engagement.event_id);
  await reloadCareArrangements('training', engagement.event_id);
}

function showTrainingTravelWizard() {
  if (!currentTrainingEngagement || !currentTrainingEngagement.event_id) return;
  const e = currentTrainingEngagement;
  const startDate = e.starts_at ? e.starts_at.slice(0, 10) : null;
  const endDate = e.ends_at ? e.ends_at.slice(0, 10) : startDate;
  showTravelWizard('training', e.event_id, startDate, endDate, e.site_location || '');
}

async function addTrainingCareArrangement() {
  if (!currentTrainingEngagement || !currentTrainingEngagement.event_id) { alert('Link this engagement to a Calendar event first (set Status to Scheduled or later).'); return; }
  await addCareArrangement('training', currentTrainingEngagement.event_id);
}

// ── COMPLETION TAB ────────────────────────────────────────────
function renderTrainingCompletionTab(engagement) {
  document.getElementById('trnPostAttendeeCount').value = engagement.actual_attendee_count != null ? engagement.actual_attendee_count : '';
  document.getElementById('trnPostOutcomeNotes').value = engagement.outcome_notes || '';
}

async function saveTrainingCompletion() {
  if (!editingTrainingId) return;
  const attendeeCount = document.getElementById('trnPostAttendeeCount').value;

  const { error } = await ggClient.from('training_engagements').update({
    actual_attendee_count: attendeeCount ? parseInt(attendeeCount, 10) : null,
    outcome_notes: document.getElementById('trnPostOutcomeNotes').value.trim() || null
  }).eq('id', editingTrainingId);
  if (error) { alert('Could not save: ' + error.message); return; }

  showSavedToast('Saved');
  loadTrainingDetail();
}

function renderTrainingOverviewTab(engagement) {
  document.getElementById('trnEditCompany').value = engagement.company_id || '';
  document.getElementById('trnEditContactParticipant').value = engagement.contact_participant_id || '';
  document.getElementById('trnEditTitle').value = engagement.title || '';
  document.getElementById('trnEditTrainingType').value = engagement.training_type || '';
  document.getElementById('trnEditInstructors').value = peopleArrayToText(engagement.instructors);
  document.getElementById('trnEditStatus').value = engagement.status || 'inquiry';
  document.getElementById('trnEditStartDate').value = engagement.starts_at ? toDateInputValue(new Date(engagement.starts_at)) : '';
  document.getElementById('trnEditStartTime').value = engagement.starts_at ? toTimeInputValue(new Date(engagement.starts_at)) : '';
  document.getElementById('trnEditEndDate').value = engagement.ends_at ? toDateInputValue(new Date(engagement.ends_at)) : '';
  document.getElementById('trnEditEndTime').value = engagement.ends_at ? toTimeInputValue(new Date(engagement.ends_at)) : '';
  document.getElementById('trnEditAttendeeCount').value = engagement.attendee_count != null ? engagement.attendee_count : '';
  document.getElementById('trnEditDescription').value = engagement.description || '';
  document.getElementById('trnEditNotes').value = engagement.notes || '';

  const banner = document.getElementById('trnLinkedEventBanner');
  banner.innerHTML = engagement.event_id
    ? `<p class="field-hint" style="margin-bottom:14px;">Linked to a Calendar event. <a href="#" onclick="hideTrainingDetail(); showEventDetail('${engagement.event_id}'); return false;">View on Calendar →</a></p>`
    : '';
}

function renderTrainingDeliveryTab(engagement) {
  document.getElementById('trnEditDeliveryMethod').value = engagement.delivery_method || 'in_person';
  document.getElementById('trnEditTimeZone').value = engagement.time_zone || '';
  document.getElementById('trnEditSiteLocation').value = engagement.site_location || '';
  document.getElementById('trnEditSiteAddress').value = engagement.site_address || '';
  document.getElementById('trnEditOnsiteContactName').value = engagement.onsite_contact_name || '';
  document.getElementById('trnEditOnsiteContactPhone').value = engagement.onsite_contact_phone || '';
  document.getElementById('trnEditSiteAccessNotes').value = engagement.site_access_notes || '';
  document.getElementById('trnEditPpeRequirements').value = engagement.ppe_requirements || '';
  document.getElementById('trnEditEquipmentRequirements').value = engagement.equipment_requirements || '';
  document.getElementById('trnEditMaterialsRequirements').value = engagement.materials_requirements || '';
  document.getElementById('trnEditVirtualPlatform').value = engagement.virtual_platform || '';
  document.getElementById('trnEditVirtualMeetingLink').value = engagement.virtual_meeting_link || '';
  document.getElementById('trnEditVirtualMeetingId').value = engagement.virtual_meeting_id || '';
  document.getElementById('trnEditVirtualPasscode').value = engagement.virtual_passcode || '';
  document.getElementById('trnEditVirtualHost').value = engagement.virtual_host || '';
  document.getElementById('trnEditTechnicalContact').value = engagement.technical_contact || '';
  document.getElementById('trnEditTechCheckRequired').checked = !!engagement.tech_check_required;
  document.getElementById('trnEditTechCheckDate').value = engagement.tech_check_at ? toDateInputValue(new Date(engagement.tech_check_at)) : '';
  document.getElementById('trnEditTechCheckTime').value = engagement.tech_check_at ? toTimeInputValue(new Date(engagement.tech_check_at)) : '';
  document.getElementById('trnEditRecordingAllowed').checked = !!engagement.recording_allowed;
  document.getElementById('trnEditRecordingRequired').checked = !!engagement.recording_required;

  updateTrainingDeliveryFields();
}

// In-Person/Virtual toggle only hides the irrelevant group — it never
// clears the hidden side's values, so switching back and forth is safe.
function updateTrainingDeliveryFields() {
  const showInPerson = document.getElementById('trnEditDeliveryMethod').value === 'in_person';
  document.querySelectorAll('.trn-inperson-field').forEach(el => { el.style.display = showInPerson ? '' : 'none'; });
  document.querySelectorAll('.trn-virtual-field').forEach(el => { el.style.display = showInPerson ? 'none' : ''; });
  updateTrainingTravelTabVisibility();
}

// Shared by both save buttons — reads every Overview/Delivery field
// into an update payload. Returns null (after alerting) if required
// fields are missing, so callers can bail out without duplicating
// the check.
function readTrainingFormPayload() {
  const companyId = document.getElementById('trnEditCompany').value;
  const title = document.getElementById('trnEditTitle').value.trim();
  if (!companyId || companyId === '__new__') { alert('Client is required.'); return null; }
  if (!title) { alert('Training title is required.'); return null; }

  const startDate = document.getElementById('trnEditStartDate').value;
  const startTime = document.getElementById('trnEditStartTime').value;
  const endDate = document.getElementById('trnEditEndDate').value;
  const endTime = document.getElementById('trnEditEndTime').value;
  const attendeeCount = document.getElementById('trnEditAttendeeCount').value;
  const techCheckDate = document.getElementById('trnEditTechCheckDate').value;
  const techCheckTime = document.getElementById('trnEditTechCheckTime').value;

  return {
    company_id: companyId,
    contact_participant_id: document.getElementById('trnEditContactParticipant').value || null,
    title,
    training_type: document.getElementById('trnEditTrainingType').value.trim() || null,
    instructors: textToPeopleArray(document.getElementById('trnEditInstructors').value),
    status: document.getElementById('trnEditStatus').value,
    starts_at: startDate ? (buildScheduledAt(startDate, startTime) || new Date(`${startDate}T00:00:00`).toISOString()) : null,
    ends_at: endDate ? (buildScheduledAt(endDate, endTime) || new Date(`${endDate}T00:00:00`).toISOString()) : null,
    attendee_count: attendeeCount ? parseInt(attendeeCount, 10) : null,
    description: document.getElementById('trnEditDescription').value.trim() || null,
    notes: document.getElementById('trnEditNotes').value.trim() || null,
    delivery_method: document.getElementById('trnEditDeliveryMethod').value,
    time_zone: document.getElementById('trnEditTimeZone').value.trim() || null,
    site_location: document.getElementById('trnEditSiteLocation').value.trim() || null,
    site_address: document.getElementById('trnEditSiteAddress').value.trim() || null,
    onsite_contact_name: document.getElementById('trnEditOnsiteContactName').value.trim() || null,
    onsite_contact_phone: document.getElementById('trnEditOnsiteContactPhone').value.trim() || null,
    site_access_notes: document.getElementById('trnEditSiteAccessNotes').value.trim() || null,
    ppe_requirements: document.getElementById('trnEditPpeRequirements').value.trim() || null,
    equipment_requirements: document.getElementById('trnEditEquipmentRequirements').value.trim() || null,
    materials_requirements: document.getElementById('trnEditMaterialsRequirements').value.trim() || null,
    virtual_platform: document.getElementById('trnEditVirtualPlatform').value.trim() || null,
    virtual_meeting_link: document.getElementById('trnEditVirtualMeetingLink').value.trim() || null,
    virtual_meeting_id: document.getElementById('trnEditVirtualMeetingId').value.trim() || null,
    virtual_passcode: document.getElementById('trnEditVirtualPasscode').value.trim() || null,
    virtual_host: document.getElementById('trnEditVirtualHost').value.trim() || null,
    technical_contact: document.getElementById('trnEditTechnicalContact').value.trim() || null,
    tech_check_required: document.getElementById('trnEditTechCheckRequired').checked,
    tech_check_at: techCheckDate ? (buildScheduledAt(techCheckDate, techCheckTime) || new Date(`${techCheckDate}T00:00:00`).toISOString()) : null,
    recording_allowed: document.getElementById('trnEditRecordingAllowed').checked,
    recording_required: document.getElementById('trnEditRecordingRequired').checked
  };
}

async function saveTrainingEngagement() {
  if (!editingTrainingId) return;
  const payload = readTrainingFormPayload();
  if (!payload) return;

  const { data: updated, error } = await ggClient.from('training_engagements').update(payload).eq('id', editingTrainingId).select().single();
  if (error) { alert('Could not save: ' + error.message); return; }

  if (updated.event_id) await pushTrainingToEvent(updated);

  showSavedToast(updated.status === 'scheduled' && !updated.event_id ? 'Saved — use "Save + Add to Calendar" to schedule it' : 'Saved');

  loadTrainingView();
  loadTrainingDetail();
}

// Saves the form exactly like saveTrainingEngagement, then ensures a
// linked Calendar event exists — creating it off the just-saved row
// (never the stale in-memory currentTrainingEngagement) so the event
// always reflects what's actually on screen, or just re-pushing to an
// already-linked event so this button is always safe to click.
async function saveTrainingEngagementAndLink() {
  if (!editingTrainingId) return;
  const payload = readTrainingFormPayload();
  if (!payload) return;

  const { data: updated, error } = await ggClient.from('training_engagements').update(payload).eq('id', editingTrainingId).select().single();
  if (error) { alert('Could not save: ' + error.message); return; }

  if (updated.event_id) {
    await pushTrainingToEvent(updated);
    showSavedToast('Saved — Calendar event updated');
    loadCalendarMonth();
    loadTrainingView();
    loadTrainingDetail();
    return;
  }

  if (!updated.starts_at) {
    alert('Add a Start Date before adding this to the Calendar.');
    loadTrainingView();
    loadTrainingDetail();
    return;
  }

  const location = updated.delivery_method === 'in_person' ? (updated.site_location || null) : null;
  const { data: newEvent, error: evErr } = await ggClient.from('events').insert({
    title: updated.title,
    event_type: 'training',
    company_id: updated.company_id,
    starts_at: updated.starts_at,
    ends_at: updated.ends_at || null,
    all_day: true,
    location,
    status: mapTrainingStatusToEventStatus(updated.status)
  }).select().single();
  if (evErr) { alert('Could not create linked event: ' + evErr.message); return; }

  const { error: updErr } = await ggClient.from('training_engagements').update({
    event_id: newEvent.id
  }).eq('id', editingTrainingId);
  if (updErr) { alert('Event was created, but the engagement could not be updated: ' + updErr.message); return; }

  await generateDefaultChecklist('training', editingTrainingId, updated.delivery_method);

  showSavedToast('Saved — added to Calendar');
  loadCalendarMonth();
  loadTrainingView();
  loadTrainingDetail();
}

async function deleteTrainingEngagement() {
  if (!editingTrainingId) return;
  if (!confirm('Delete this training engagement? A linked Calendar event, if any, is not deleted.')) return;

  const { error } = await ggClient.from('training_engagements').delete().eq('id', editingTrainingId);
  if (error) { alert('Could not delete: ' + error.message); return; }

  hideTrainingDetail();
  loadTrainingView();
}

// ── EVENT SYNC (engagement → linked event, one-way) ─────────
function mapTrainingStatusToEventStatus(status) {
  if (['scheduled', 'planning', 'ready'].includes(status)) return 'confirmed';
  if (['completed', 'invoice_pending', 'payment_pending', 'paid'].includes(status)) return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'planning';
}

async function pushTrainingToEvent(engagement) {
  const location = engagement.delivery_method === 'in_person' ? (engagement.site_location || null) : null;
  const payload = {
    title: engagement.title,
    company_id: engagement.company_id,
    location,
    status: mapTrainingStatusToEventStatus(engagement.status),
    ends_at: engagement.ends_at || null
  };
  if (engagement.starts_at) payload.starts_at = engagement.starts_at;
  const { error } = await ggClient.from('events').update(payload).eq('id', engagement.event_id);
  if (error) console.error('Could not sync linked event:', error.message);
}

