// ============================================================
// GUARDIAN GROUP — admin-engagements.js
// Shared helpers for the Speaking and Training engagement modules
// (js/admin-speaking.js, js/admin-training.js): status-badge
// rendering, the checklist planning-progress formula (schema is in
// place from Stage 1's migration; the checklist UI itself ships in
// a later stage), the jsonb array <-> comma-string helpers used for
// speakers/instructors, and the Calendar click-routing coordinator
// that decides whether a clicked event belongs to a Speaking or
// Training engagement or is just a general event.
// Relies on globals defined in admin.js (ggClient, escHtml,
// capWords) and admin-calendar.js (showEventDetail).
// ============================================================

const SPEAKING_STATUS_LABELS = {
  opportunity: 'Opportunity',
  preparing_submission: 'Preparing Submission',
  applied: 'Applied',
  under_review: 'Under Review',
  selected: 'Selected',
  contracting: 'Contracting',
  planning: 'Planning',
  ready: 'Ready',
  completed: 'Completed',
  payment_pending: 'Payment Pending',
  closed: 'Closed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  cancelled: 'Cancelled'
};

const TRAINING_STATUS_LABELS = {
  inquiry: 'Inquiry',
  proposal_sent: 'Proposal Sent',
  contract_pending: 'Contract Pending',
  scheduled: 'Scheduled',
  planning: 'Planning',
  ready: 'Ready',
  completed: 'Completed',
  invoice_pending: 'Invoice Pending',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  cancelled: 'Cancelled'
};

const STATUS_BADGE_TONES = {
  // Speaking
  opportunity: 'neutral', preparing_submission: 'neutral', applied: 'info', under_review: 'info',
  selected: 'open', contracting: 'open', payment_pending: 'info', closed: 'steel',
  declined: 'danger', withdrawn: 'danger',
  // Training
  inquiry: 'neutral', proposal_sent: 'info', contract_pending: 'info', scheduled: 'open', paid: 'steel',
  // Shared by both lifecycles
  planning: 'open', ready: 'open', completed: 'steel', cancelled: 'danger'
};

function renderStatusBadge(statusKey, labelMap) {
  const tone = STATUS_BADGE_TONES[statusKey] || 'neutral';
  const label = (labelMap && labelMap[statusKey]) || capWords(statusKey);
  return `<span class="status-badge tone-${tone}">${escHtml(label)}</span>`;
}

// Planning progress % excludes not_applicable items from the
// denominator entirely, per spec. Returns null (render as "—")
// when there's nothing to measure yet.
function checklistProgressPercent(items) {
  if (!items || !items.length) return null;
  const applicable = items.filter(i => i.status !== 'not_applicable');
  if (!applicable.length) return null;
  const completed = applicable.filter(i => i.status === 'completed').length;
  return Math.round((completed / applicable.length) * 100);
}

// speakers/instructors are stored as jsonb arrays of either plain
// strings or {name, ...} objects — these two helpers move between
// that and the single comma-separated text input the forms use.
function peopleArrayToText(value) {
  if (!Array.isArray(value)) return '';
  return value.map(v => (typeof v === 'string' ? v : (v?.name || ''))).filter(Boolean).join(', ');
}
function textToPeopleArray(text) {
  return (text || '').split(',').map(s => s.trim()).filter(Boolean);
}

// ── CALENDAR CLICK-ROUTING COORDINATOR ─────────────────────────
// Every event chip/row that used to call showEventDetail(id)
// directly now calls this instead. A per-click lookup (not a
// cache) so it can never go stale between calendar loads and
// clicks — it's one indexed select on a small table. If no linked
// Speaking/Training record is found — a historical speaking/
// training-typed event predating this feature (or created before
// those types were removed from the generic New Event dropdown) —
// it offers to adopt the event into a proper engagement record
// instead of opening the old generic Event modal for it.
async function openEventOrEngagement(eventId, eventType) {
  if (eventType === 'speaking') {
    const { data } = await ggClient.from('speaking_engagements').select('id').eq('event_id', eventId).maybeSingle();
    if (data) { showSpeakingDetail(data.id); return; }
    await adoptEventAsEngagement(eventId, 'speaking');
    return;
  } else if (eventType === 'training') {
    const { data } = await ggClient.from('training_engagements').select('id').eq('event_id', eventId).maybeSingle();
    if (data) { showTrainingDetail(data.id); return; }
    await adoptEventAsEngagement(eventId, 'training');
    return;
  }
  showEventDetail(eventId);
}

// ── HISTORICAL EVENT ADOPTION ───────────────────────────────
// Backfills a new speaking_engagements/training_engagements row
// from an existing speaking/training-typed event's own fields,
// links it to that event, and opens the proper planning modal —
// confirmed first, never silent, matching every other place this
// feature links an engagement to an event. Declining (or the event
// genuinely having nothing useful to adopt) falls back to the old
// generic Event modal, so nothing is ever a dead end.
// The event.status → engagement.status mapping is necessarily lossy
// (the event only has 4 coarse states; engagements have many more) —
// it's a reasonable starting guess, reviewable immediately on the
// Overview tab that opens right after.
function adoptEventStatusToSpeaking(status) {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'confirmed') return 'selected';
  return 'planning';
}
function adoptEventStatusToTraining(status) {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'confirmed') return 'scheduled';
  return 'planning';
}

async function adoptEventAsEngagement(eventId, kind) {
  const { data: event, error } = await ggClient.from('events').select('*').eq('id', eventId).single();
  if (error || !event) { showEventDetail(eventId); return; }

  const kindLabel = kind === 'speaking' ? 'Speaking Engagement' : 'Training';
  const ok = confirm(`"${event.title}" isn't linked to a ${kindLabel} record yet. Create one from this event's details now?`);
  if (!ok) { showEventDetail(eventId); return; }

  if (kind === 'speaking') {
    const [city, region] = (event.location || '').split(',').map(s => s.trim());
    const { data: created, error: insErr } = await ggClient.from('speaking_engagements').insert({
      event_id: eventId,
      event_name: event.title,
      city: city || null,
      region: region || null,
      event_start_date: event.starts_at ? toDateInputValue(new Date(event.starts_at)) : null,
      event_end_date: event.ends_at ? toDateInputValue(new Date(event.ends_at)) : null,
      offered_fee: event.income_amount,
      application_url: event.link_url,
      status: adoptEventStatusToSpeaking(event.status),
      notes: event.notes
    }).select('id').single();
    if (insErr) { alert('Could not create the linked Speaking Engagement: ' + insErr.message); showEventDetail(eventId); return; }
    showSpeakingDetail(created.id);
  } else {
    if (!event.company_id) {
      alert('This event has no Client set — add one on its Details tab first (Training records require a client), then click it again.');
      showEventDetail(eventId);
      return;
    }
    const { data: created, error: insErr } = await ggClient.from('training_engagements').insert({
      event_id: eventId,
      company_id: event.company_id,
      title: event.title,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      site_location: event.location,
      status: adoptEventStatusToTraining(event.status),
      notes: event.notes
    }).select('id').single();
    if (insErr) { alert('Could not create the linked Training record: ' + insErr.message); showEventDetail(eventId); return; }
    showTrainingDetail(created.id);
  }
}

// ============================================================
// CHECKLIST ENGINE (Speaking Prep tab + Training Prep tab)
// One table (engagement_checklist_items) serves both; every
// function here is parameterized by `kind` ('speaking'|'training')
// and the parent engagement id rather than hardcoding a table/
// column, so the same engine backs both Prep tabs.
// ============================================================

const SPEAKING_DEFAULT_CHECKLIST_ITEMS = [
  'Contract / speaker agreement received', 'Contract signed', 'Event dates confirmed',
  'Speaking date/time confirmed', 'Travel dates confirmed', 'Travel method determined',
  'Flights booked', 'Hotel booked', 'Rental car booked', 'Childcare arranged', 'Pet care arranged',
  'Bio submitted', 'Headshot submitted', 'Session description approved', 'AV requirements confirmed',
  'Presentation started', 'Presentation complete', 'Slides submitted', 'Presentation rehearsed',
  'Handouts/resources completed', 'QR codes/links tested', 'Speaker materials prepared',
  'Final itinerary reviewed', 'Expenses reviewed', 'Invoice sent', 'Reimbursement submitted',
  'Payment received', 'Post-event follow-up completed'
];

const TRAINING_DEFAULT_CHECKLIST_ITEMS_IN_PERSON = [
  'Agreement signed', 'Training date confirmed', 'Client contact confirmed', 'Location confirmed',
  'Instructor confirmed', 'Attendee count confirmed', 'Site requirements reviewed',
  'PPE requirements confirmed', 'Equipment list confirmed', 'Equipment prepared',
  'Training materials prepared', 'Travel method confirmed', 'Flights booked', 'Hotel booked',
  'Rental car booked', 'Childcare arranged', 'Pet care arranged', 'Materials shipped',
  'Final client confirmation sent', 'Training delivered', 'Attendance recorded',
  'Certificates issued', 'Invoice sent', 'Payment received'
];

const TRAINING_DEFAULT_CHECKLIST_ITEMS_VIRTUAL = [
  'Agreement signed', 'Date/time confirmed', 'Time zone confirmed', 'Client contact confirmed',
  'Instructor confirmed', 'Attendee count confirmed', 'Platform confirmed',
  'Meeting link created/received', 'Presenter access confirmed', 'Tech check completed',
  'Participant materials prepared', 'Participant materials sent', 'Training delivered',
  'Attendance recorded', 'Certificates issued', 'Recording handled', 'Invoice sent', 'Payment received'
];

const CHECKLIST_UI_IDS = {
  speaking: { list: 'spkChecklistList', progress: 'spkPrepProgressLabel', generateBtn: 'spkGenerateChecklistBtn' },
  training: { list: 'trnChecklistList', progress: 'trnPrepProgressLabel', generateBtn: 'trnGenerateChecklistBtn' }
};

function checklistParentColumn(kind) {
  return kind === 'speaking' ? 'speaking_engagement_id' : 'training_engagement_id';
}

async function loadChecklistItems(kind, engagementId) {
  const { data, error } = await ggClient.from('engagement_checklist_items')
    .select('*').eq(checklistParentColumn(kind), engagementId).order('sort_order', { ascending: true });
  return error ? [] : (data || []);
}

// Hardcoded templates, same "fixed JS array, freely editable after" idea
// as the existing survey template (loadSurveyTemplate() in admin.js) —
// no DB-configurable template needed. Re-checks for existing items right
// before inserting (not just relying on the "Generate" button being
// hidden once items exist) so a double-click, or the auto-generate-on-
// link call racing a manual click, can never insert the template twice.
async function generateDefaultChecklist(kind, engagementId, deliveryMethod) {
  const existing = await loadChecklistItems(kind, engagementId);
  if (existing.length > 0) return;

  const titles = kind === 'speaking'
    ? SPEAKING_DEFAULT_CHECKLIST_ITEMS
    : (deliveryMethod === 'virtual' ? TRAINING_DEFAULT_CHECKLIST_ITEMS_VIRTUAL : TRAINING_DEFAULT_CHECKLIST_ITEMS_IN_PERSON);

  const rows = titles.map((title, i) => ({
    [checklistParentColumn(kind)]: engagementId, title, sort_order: i, is_default: true
  }));
  const { error } = await ggClient.from('engagement_checklist_items').insert(rows);
  if (error) console.error('Could not generate default checklist:', error.message);
}

function renderChecklistPanel(kind, engagementId, items) {
  const ids = CHECKLIST_UI_IDS[kind];
  const progress = checklistProgressPercent(items);
  const progressEl = document.getElementById(ids.progress);
  if (progressEl) progressEl.textContent = progress == null ? '—' : `${progress}%`;

  const generateBtn = document.getElementById(ids.generateBtn);
  if (generateBtn) generateBtn.style.display = items.length === 0 ? 'inline-block' : 'none';

  const list = document.getElementById(ids.list);
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<p class="empty-hint">No checklist items yet — generate the default checklist above, or add your own below.</p>';
    return;
  }

  list.innerHTML = items.map(item => {
    const isDone = item.status === 'completed';
    const isNA = item.status === 'not_applicable';
    return `
      <div class="task-row ${isDone || isNA ? 'task-row-done' : ''}">
        <input type="checkbox" ${isDone ? 'checked' : ''} ${isNA ? 'disabled' : ''} onchange="toggleChecklistItemStatus('${item.id}', '${kind}', '${engagementId}', '${item.status}')" />
        <span class="task-row-title" style="${isNA ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escHtml(item.title)}</span>
        <button class="btn-sm btn-sm-ghost" onclick="toggleChecklistItemNA('${item.id}', '${kind}', '${engagementId}', '${item.status}')">${isNA ? 'Applicable' : 'N/A'}</button>
        <input type="date" class="field-input" style="max-width:150px;" value="${item.due_date || ''}" onchange="updateChecklistItemField('${item.id}', '${kind}', '${engagementId}', 'due_date', this.value || null)" />
        <select class="field-input" style="max-width:130px;" onchange="updateChecklistItemField('${item.id}', '${kind}', '${engagementId}', 'owner', this.value)">
          <option value="Unassigned" ${(!item.owner || item.owner === 'Unassigned') ? 'selected' : ''}>Unassigned</option>
          <option value="Dave" ${item.owner === 'Dave' ? 'selected' : ''}>Dave</option>
          <option value="Haley" ${item.owner === 'Haley' ? 'selected' : ''}>Haley</option>
        </select>
        ${item.task_id
          ? '<span class="task-row-owner">✓ Task</span>'
          : (item.due_date ? `<button class="btn-sm btn-sm-ghost" onclick="syncChecklistItemToTask('${item.id}', '${kind}', '${engagementId}')">→ Task</button>` : '')}
        <button class="btn-sm btn-sm-danger" onclick="deleteChecklistItem('${item.id}', '${kind}', '${engagementId}')" title="Delete">🗑️</button>
      </div>
    `;
  }).join('');
}

async function reloadChecklistPanel(kind, engagementId) {
  const items = await loadChecklistItems(kind, engagementId);
  renderChecklistPanel(kind, engagementId, items);
  return items;
}

async function toggleChecklistItemStatus(itemId, kind, engagementId, currentStatus) {
  await updateChecklistItemField(itemId, kind, engagementId, 'status', currentStatus === 'completed' ? 'pending' : 'completed');
}
async function toggleChecklistItemNA(itemId, kind, engagementId, currentStatus) {
  await updateChecklistItemField(itemId, kind, engagementId, 'status', currentStatus === 'not_applicable' ? 'pending' : 'not_applicable');
}

async function updateChecklistItemField(itemId, kind, engagementId, field, value) {
  const { error } = await ggClient.from('engagement_checklist_items').update({ [field]: value }).eq('id', itemId);
  if (error) { alert('Could not save: ' + error.message); return; }
  await reloadChecklistPanel(kind, engagementId);
}

async function deleteChecklistItem(itemId, kind, engagementId) {
  if (!confirm('Delete this checklist item?')) return;
  const { error } = await ggClient.from('engagement_checklist_items').delete().eq('id', itemId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  await reloadChecklistPanel(kind, engagementId);
}

async function addChecklistItem(kind, engagementId, titleInputId, dueDateInputId, ownerSelectId) {
  const title = document.getElementById(titleInputId).value.trim();
  if (!title) { alert('Item text is required.'); return; }

  const items = await loadChecklistItems(kind, engagementId);
  const nextSort = items.length ? Math.max(...items.map(i => i.sort_order || 0)) + 1 : 0;

  const payload = {
    [checklistParentColumn(kind)]: engagementId,
    title,
    due_date: document.getElementById(dueDateInputId).value || null,
    owner: document.getElementById(ownerSelectId).value,
    sort_order: nextSort,
    is_default: false
  };

  const { error } = await ggClient.from('engagement_checklist_items').insert(payload);
  if (error) { alert('Could not add item: ' + error.message); return; }

  document.getElementById(titleInputId).value = '';
  document.getElementById(dueDateInputId).value = '';
  document.getElementById(ownerSelectId).value = 'Unassigned';
  await reloadChecklistPanel(kind, engagementId);
}

// Explicit, one-click sync — never automatic. Once the engagement has a
// linked event, the created task carries that event_id too.
async function syncChecklistItemToTask(itemId, kind, engagementId) {
  const items = await loadChecklistItems(kind, engagementId);
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  const table = kind === 'speaking' ? 'speaking_engagements' : 'training_engagements';
  const { data: engagement } = await ggClient.from(table).select('event_id').eq('id', engagementId).single();

  const { data: task, error: taskErr } = await ggClient.from('tasks').insert({
    title: item.title, due_date: item.due_date, owner: item.owner || 'Unassigned',
    event_id: engagement?.event_id || null, status: 'todo'
  }).select('id').single();
  if (taskErr) { alert('Could not create task: ' + taskErr.message); return; }

  const { error: updErr } = await ggClient.from('engagement_checklist_items').update({ task_id: task.id }).eq('id', itemId);
  if (updErr) { alert('Task was created, but could not be linked: ' + updErr.message); return; }
  await reloadChecklistPanel(kind, engagementId);
}

// ============================================================
// CARE ARRANGEMENTS (childcare / pet care) — keyed to the event,
// since one is only ever created once a real event exists.
// ============================================================

const CARE_UI_IDS = { speaking: { list: 'spkCareArrangementsList' }, training: { list: 'trnCareArrangementsList' } };
const CARE_STATUS_LABELS = { needed: 'Needed', arranging: 'Arranging', confirmed: 'Confirmed', not_needed: 'Not Needed', completed: 'Completed' };
const CARE_TYPE_LABELS = { childcare: 'Childcare', petcare: 'Pet Care' };

async function loadCareArrangements(eventId) {
  if (!eventId) return [];
  const { data, error } = await ggClient.from('event_care_arrangements').select('*').eq('event_id', eventId).order('created_at', { ascending: true });
  return error ? [] : (data || []);
}

function renderCareArrangementsList(kind, eventId, items) {
  const list = document.getElementById(CARE_UI_IDS[kind].list);
  if (!list) return;
  if (!items.length) { list.innerHTML = '<p class="empty-hint">No childcare or pet care arrangements logged.</p>'; return; }

  list.innerHTML = items.map(item => `
    <div class="task-row">
      <span class="task-row-owner">${escHtml(CARE_TYPE_LABELS[item.care_type] || item.care_type)}</span>
      <span class="task-row-title">${escHtml(item.provider || 'Provider TBD')}</span>
      <span class="task-row-due">${item.starts_at ? formatDate(item.starts_at.slice(0, 10)) : '—'}${item.ends_at ? ' – ' + formatDate(item.ends_at.slice(0, 10)) : ''}</span>
      <select class="field-input" style="max-width:130px;" onchange="updateCareArrangementField('${item.id}', '${kind}', '${eventId}', 'status', this.value)">
        ${Object.entries(CARE_STATUS_LABELS).map(([val, label]) => `<option value="${val}" ${item.status === val ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <span class="task-row-due">${item.cost != null ? formatCurrency(item.cost) : '—'}</span>
      ${item.cost != null ? `<button class="btn-sm btn-sm-ghost" onclick="logCareArrangementAsExpense('${item.id}', '${eventId}', this)">+ Log as Expense</button>` : ''}
      <button class="btn-sm btn-sm-danger" onclick="deleteCareArrangement('${item.id}', '${kind}', '${eventId}')" title="Delete">🗑️</button>
    </div>
  `).join('');
}

async function reloadCareArrangements(kind, eventId) {
  const items = await loadCareArrangements(eventId);
  renderCareArrangementsList(kind, eventId, items);
  return items;
}

async function addCareArrangement(kind, eventId) {
  const prefix = kind === 'speaking' ? 'spkNewCare' : 'trnNewCare';
  const startDate = document.getElementById(`${prefix}StartDate`).value;
  const endDate = document.getElementById(`${prefix}EndDate`).value;
  const cost = document.getElementById(`${prefix}Cost`).value;

  const payload = {
    event_id: eventId,
    care_type: document.getElementById(`${prefix}Type`).value,
    provider: document.getElementById(`${prefix}Provider`).value.trim() || null,
    starts_at: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null,
    ends_at: endDate ? new Date(`${endDate}T00:00:00`).toISOString() : null,
    cost: cost ? parseFloat(cost) : null,
    notes: document.getElementById(`${prefix}Notes`).value.trim() || null
  };

  const { error } = await ggClient.from('event_care_arrangements').insert(payload);
  if (error) { alert('Could not add care arrangement: ' + error.message); return; }

  [`${prefix}Provider`, `${prefix}StartDate`, `${prefix}EndDate`, `${prefix}Cost`, `${prefix}Notes`].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById(`${prefix}Type`).value = 'childcare';
  await reloadCareArrangements(kind, eventId);
}

async function updateCareArrangementField(itemId, kind, eventId, field, value) {
  const { error } = await ggClient.from('event_care_arrangements').update({ [field]: value }).eq('id', itemId);
  if (error) { alert('Could not save: ' + error.message); return; }
  await reloadCareArrangements(kind, eventId);
}

async function deleteCareArrangement(itemId, kind, eventId) {
  if (!confirm('Delete this care arrangement?')) return;
  const { error } = await ggClient.from('event_care_arrangements').delete().eq('id', itemId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  await reloadCareArrangements(kind, eventId);
}

// Explicit, one-click action — never automatic, so a cost logged here
// never silently becomes a second financial record. The button
// disables itself after use as a soft guard against an accidental
// double-click; reloading the page resets that (matching how nothing
// else on this table tracks "already logged" either — there's no
// schema field for it, since the spec only asked to avoid *silent*
// duplication, not to make it structurally impossible).
async function logCareArrangementAsExpense(itemId, eventId, btnEl) {
  const items = await loadCareArrangements(eventId);
  const item = items.find(i => i.id === itemId);
  if (!item || item.cost == null) return;

  const { error } = await ggClient.from('event_expenses').insert({
    event_id: eventId,
    category: item.care_type === 'petcare' ? 'pet_care' : 'childcare',
    description: `${CARE_TYPE_LABELS[item.care_type] || 'Care'} — ${item.provider || 'Provider TBD'}`,
    amount: item.cost,
    status: 'planned',
    incurred_on: item.starts_at ? item.starts_at.slice(0, 10) : null
  });
  if (error) { alert('Could not log expense: ' + error.message); return; }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Logged ✓'; }
  alert('Logged as an expense on this event — see the Spending tab on the linked Calendar event.');
}

// ============================================================
// GUIDED TRAVEL WIZARD + travel-item quick-edit — built entirely
// on the existing event_itinerary_items table, no new schema. The
// wizard creates a few sensibly-titled stub rows (dates guessed
// from the engagement, everything else left blank) rather than
// inventing costs/confirmation numbers — the quick-edit table below
// it, or the full Itinerary tab on the linked event, is where those
// get filled in.
// ============================================================

const TRAVEL_ITEM_TYPES = ['driving_to', 'driving_home', 'departing_flight', 'return_flight', 'hotel', 'car_rental'];
const TRAVEL_UI_IDS = { speaking: { wizard: 'spkTravelWizardArea', list: 'spkTravelItemsList' }, training: { wizard: 'trnTravelWizardArea', list: 'trnTravelItemsList' } };
let travelWizardState = null;

async function loadTravelItems(eventId) {
  if (!eventId) return [];
  const { data, error } = await ggClient.from('event_itinerary_items')
    .select('*').eq('event_id', eventId).in('item_type', TRAVEL_ITEM_TYPES).order('starts_at', { ascending: true, nullsFirst: false });
  return error ? [] : (data || []);
}

function renderTravelItemsList(kind, eventId, items) {
  const list = document.getElementById(TRAVEL_UI_IDS[kind].list);
  if (!list) return;

  const openFullEditor = `hide${kind === 'speaking' ? 'Speaking' : 'Training'}Detail(); showEventDetail('${eventId}'); switchEventTab('itinerary'); return false;`;

  if (!items.length) {
    list.innerHTML = `<p class="empty-hint" style="margin-top:12px;">No travel legs yet. Use "+ Plan Travel" above, or <a href="#" onclick="${openFullEditor}">open the full Itinerary editor →</a></p>`;
    return;
  }

  list.innerHTML = `
    <div class="responses-table-wrap" style="margin-top:12px;">
      <table class="responses-table">
        <thead><tr><th>Type</th><th>Title</th><th>Date</th><th>Provider</th><th>Confirmation #</th><th>Cost</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${escHtml(ITINERARY_ITEM_TYPE_LABELS[item.item_type] || item.item_type)}</td>
              <td><input type="text" class="field-input" value="${escHtml(item.title)}" onchange="updateTravelItemField('${item.id}', '${kind}', '${eventId}', 'title', this.value)" /></td>
              <td><input type="date" class="field-input" value="${item.starts_at ? toDateInputValue(new Date(item.starts_at)) : ''}" onchange="updateTravelItemField('${item.id}', '${kind}', '${eventId}', 'starts_at', this.value ? new Date(this.value + 'T00:00:00').toISOString() : null)" /></td>
              <td><input type="text" class="field-input" value="${escHtml(item.provider || '')}" onchange="updateTravelItemField('${item.id}', '${kind}', '${eventId}', 'provider', this.value.trim() || null)" /></td>
              <td><input type="text" class="field-input" value="${escHtml(item.confirmation_number || '')}" onchange="updateTravelItemField('${item.id}', '${kind}', '${eventId}', 'confirmation_number', this.value.trim() || null)" /></td>
              <td><input type="number" class="field-input" style="max-width:100px;" value="${item.cost != null ? item.cost : ''}" onchange="updateTravelItemField('${item.id}', '${kind}', '${eventId}', 'cost', this.value ? parseFloat(this.value) : null)" /></td>
              <td>
                <select class="field-input" onchange="updateTravelItemField('${item.id}', '${kind}', '${eventId}', 'status', this.value)">
                  <option value="planned" ${item.status === 'planned' ? 'selected' : ''}>Planned</option>
                  <option value="booked" ${item.status === 'booked' ? 'selected' : ''}>Booked</option>
                  <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
              </td>
              <td><button class="btn-sm btn-sm-danger" onclick="deleteTravelItem('${item.id}', '${kind}', '${eventId}')" title="Delete">🗑️</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p class="field-hint" style="margin-top:8px;"><a href="#" onclick="${openFullEditor}">Open full Itinerary editor →</a> for addresses, income, or invoice linking.</p>
  `;
}

async function reloadTravelItems(kind, eventId) {
  const items = await loadTravelItems(eventId);
  renderTravelItemsList(kind, eventId, items);
  return items;
}

async function updateTravelItemField(itemId, kind, eventId, field, value) {
  const { error } = await ggClient.from('event_itinerary_items').update({ [field]: value }).eq('id', itemId);
  if (error) { alert('Could not save: ' + error.message); return; }
  await reloadTravelItems(kind, eventId);
}

async function deleteTravelItem(itemId, kind, eventId) {
  if (!confirm('Delete this travel item?')) return;
  const { error } = await ggClient.from('event_itinerary_items').delete().eq('id', itemId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  await reloadTravelItems(kind, eventId);
}

// showSpeakingTravelWizard()/showTrainingTravelWizard() (in their own
// files, where the engagement's date/location fields are known) call
// this with normalized values so this file never needs to know
// speaking_engagements' vs training_engagements' different column names.
function showTravelWizard(kind, eventId, startDate, endDate, location) {
  travelWizardState = { kind, eventId, startDate: startDate || null, endDate: endDate || null, location: location || '' };
  const area = document.getElementById(TRAVEL_UI_IDS[kind].wizard);
  area.innerHTML = `
    <div class="create-form-card" style="border-top-color:var(--gg-steel); padding:20px;">
      <h3 class="card-title" style="font-size:15px; margin-bottom:10px;">Plan Travel</h3>
      <p style="font-size:13px; color:var(--gg-muted); margin-bottom:12px;">Travel required?</p>
      <div style="display:flex; gap:10px;">
        <button class="btn-sm" style="background:var(--gg-mid); color:white;" onclick="travelWizardMethodStep()">Yes</button>
        <button class="btn-sm btn-sm-ghost" onclick="hideTravelWizard('${kind}')">No</button>
      </div>
    </div>
  `;
}

function travelWizardMethodStep() {
  if (!travelWizardState) return;
  const area = document.getElementById(TRAVEL_UI_IDS[travelWizardState.kind].wizard);
  area.innerHTML = `
    <div class="create-form-card" style="border-top-color:var(--gg-steel); padding:20px;">
      <h3 class="card-title" style="font-size:15px; margin-bottom:10px;">Plan Travel</h3>
      <p style="font-size:13px; color:var(--gg-muted); margin-bottom:12px;">How are you getting there?</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn-sm" style="background:var(--gg-mid); color:white;" onclick="runTravelWizard('flying')">Flying</button>
        <button class="btn-sm" style="background:var(--gg-mid); color:white;" onclick="runTravelWizard('driving')">Driving</button>
        <button class="btn-sm btn-sm-ghost" onclick="runTravelWizard('other')">Other</button>
        <button class="btn-sm btn-sm-ghost" onclick="hideTravelWizard('${travelWizardState.kind}')">Cancel</button>
      </div>
    </div>
  `;
}

function hideTravelWizard(kind) {
  travelWizardState = null;
  const area = document.getElementById(TRAVEL_UI_IDS[kind].wizard);
  const opener = kind === 'speaking' ? 'showSpeakingTravelWizard' : 'showTrainingTravelWizard';
  if (area) area.innerHTML = `<button class="btn-sm btn-sm-ghost" onclick="${opener}()">+ Plan Travel</button>`;
}

async function runTravelWizard(method) {
  if (!travelWizardState) return;
  const { kind, eventId, startDate, endDate, location } = travelWizardState;

  const rows = [];
  if (method === 'flying') {
    rows.push({ item_type: 'departing_flight', title: `Departing Flight${location ? ' — ' + location : ''}`, starts_at: startDate });
    rows.push({ item_type: 'return_flight', title: `Return Flight${location ? ' — ' + location : ''}`, starts_at: endDate });
    rows.push({ item_type: 'hotel', title: `Hotel${location ? ' — ' + location : ''}`, starts_at: startDate });
    rows.push({ item_type: 'car_rental', title: 'Rental Car', starts_at: startDate });
  } else if (method === 'driving') {
    rows.push({ item_type: 'driving_to', title: `Driving To${location ? ' — ' + location : ''}`, starts_at: startDate });
    rows.push({ item_type: 'driving_home', title: 'Driving Home', starts_at: endDate });
    rows.push({ item_type: 'hotel', title: `Hotel${location ? ' — ' + location : ''}`, starts_at: startDate });
  } else {
    rows.push({ item_type: 'other', title: `Travel${location ? ' — ' + location : ''}`, starts_at: startDate });
  }

  const payload = rows.map(r => ({
    event_id: eventId, item_type: r.item_type, title: r.title,
    starts_at: r.starts_at ? new Date(`${r.starts_at}T00:00:00`).toISOString() : null,
    status: 'planned'
  }));

  const { error } = await ggClient.from('event_itinerary_items').insert(payload);
  if (error) { alert('Could not create travel items: ' + error.message); return; }

  hideTravelWizard(kind);
  await reloadTravelItems(kind, eventId);
}

// ============================================================
// SAVE TOAST — a lightweight "Saved" confirmation for actions that
// used to give no feedback beyond the modal just staying open.
// One shared element, reused/restarted on every call.
// ============================================================
function showSavedToast(message) {
  let toast = document.getElementById('ggToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ggToast';
    toast.className = 'gg-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message || 'Saved';
  toast.classList.remove('gg-toast-show');
  void toast.offsetWidth; // restart the fade animation if a toast is already showing
  toast.classList.add('gg-toast-show');
  clearTimeout(showSavedToast._timer);
  showSavedToast._timer = setTimeout(() => toast.classList.remove('gg-toast-show'), 2200);
}

// ============================================================
// SPEAKER PILL SELECTOR (Speaking Overview tab) — a fixed set of
// four presenter arrangements, single-select (click again to
// clear). Stored as a one-element speakers jsonb array so the
// column shape doesn't change from what the schema already has.
// ============================================================
const SPEAKER_PILL_OPTIONS = ['Dave', 'Haley', 'Both - Presenting Separately', 'Both - Presenting Together'];

function renderSpeakerPills(containerId, hiddenInputId, selectedValue) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = SPEAKER_PILL_OPTIONS.map(opt => `
    <button type="button" class="pill-btn ${opt === selectedValue ? 'active' : ''}" onclick="selectSpeakerPill(this, '${hiddenInputId}')">${escHtml(opt)}</button>
  `).join('');
  const hidden = document.getElementById(hiddenInputId);
  if (hidden) hidden.value = selectedValue || '';
}

function selectSpeakerPill(btn, hiddenInputId) {
  const wasActive = btn.classList.contains('active');
  Array.from(btn.parentElement.children).forEach(el => el.classList.remove('active'));
  if (!wasActive) btn.classList.add('active');
  document.getElementById(hiddenInputId).value = wasActive ? '' : btn.textContent;
}

// ============================================================
// ADDRESS BOOK CONTACT PICKER — a small modal for filling a
// Name/Email/Phone trio from an existing participants row instead
// of retyping it. Read-only lookup; picking a contact does not
// link the record, it just copies the three values in, so the
// fields stay freely editable afterward.
// ============================================================
let contactPickerTarget = null;
let contactPickerAllRows = null;

async function openContactPicker(nameFieldId, emailFieldId, phoneFieldId) {
  contactPickerTarget = { nameFieldId, emailFieldId, phoneFieldId };
  document.getElementById('contactPickerSearch').value = '';
  document.getElementById('contactPickerModal').style.display = 'flex';

  if (!contactPickerAllRows) {
    const { data, error } = await ggClient
      .from('participants').select('id, full_name, email, phone, companies!company_id(name)').order('full_name');
    contactPickerAllRows = error ? [] : (data || []);
  }
  renderContactPickerResults('');
  document.getElementById('contactPickerSearch').focus();
}

function closeContactPicker() {
  document.getElementById('contactPickerModal').style.display = 'none';
  contactPickerTarget = null;
}

function searchContactPicker() {
  renderContactPickerResults(document.getElementById('contactPickerSearch').value);
}

function renderContactPickerResults(term) {
  const results = document.getElementById('contactPickerResults');
  const rows = contactPickerAllRows || [];
  const q = term.trim().toLowerCase();
  const filtered = !q ? rows : rows.filter(p =>
    (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
  );
  if (!filtered.length) { results.innerHTML = '<p class="empty-hint">No matches.</p>'; return; }
  results.innerHTML = filtered.slice(0, 25).map(p => `
    <div class="task-row" style="cursor:pointer;" onclick="pickContactFromPicker('${p.id}')">
      <span class="task-row-title">${escHtml(p.full_name || '(no name)')}${p.companies?.name ? ` <span class="task-row-owner">— ${escHtml(p.companies.name)}</span>` : ''}</span>
      <span style="font-size:12px; color:var(--gg-muted);">${escHtml(p.email || '')}</span>
    </div>
  `).join('');
}

function pickContactFromPicker(participantId) {
  const p = (contactPickerAllRows || []).find(r => r.id === participantId);
  if (!p || !contactPickerTarget) return;
  document.getElementById(contactPickerTarget.nameFieldId).value = p.full_name || '';
  document.getElementById(contactPickerTarget.emailFieldId).value = p.email || '';
  document.getElementById(contactPickerTarget.phoneFieldId).value = p.phone || '';
  closeContactPicker();
}

// ============================================================
// FINANCIALS TAB — reads the SAME event_expenses rows the linked
// event's own Spending tab manages, with an inline reimbursement-
// status quick-edit. Adding a brand-new expense is done on that
// full Spending tab (jump-out link below) rather than duplicating
// a second create form + file-upload flow here.
// ============================================================
const FINANCIALS_UI_IDS = {
  speaking: { stats: 'spkFinancialsStats', list: 'spkFinancialsExpensesList' },
  training: { stats: 'trnFinancialsStats', list: 'trnFinancialsExpensesList' }
};
const REIMBURSEMENT_STATUS_OPTIONS = ['not_submitted', 'submitted', 'reimbursed', 'denied'];

function jumpToEventTab(kind, eventId, tabName) {
  const hideFn = kind === 'speaking' ? 'hideSpeakingDetail' : 'hideTrainingDetail';
  return `${hideFn}(); showEventDetail('${eventId}'); switchEventTab('${tabName}'); return false;`;
}

async function loadFinancialsPanel(kind, eventId) {
  const ids = FINANCIALS_UI_IDS[kind];
  if (!eventId) {
    document.getElementById(ids.stats).innerHTML = '';
    document.getElementById(ids.list).innerHTML = '<p class="empty-hint">Financials are tracked on the linked Calendar event once this engagement is linked.</p>';
    return;
  }

  const [{ data: event }, { data: expenses }] = await Promise.all([
    ggClient.from('events').select('income_amount').eq('id', eventId).single(),
    ggClient.from('event_expenses').select('*').eq('event_id', eventId).order('incurred_on', { ascending: false })
  ]);
  renderFinancialsPanel(kind, eventId, event, expenses || []);
}

function renderFinancialsPanel(kind, eventId, event, expenses) {
  const ids = FINANCIALS_UI_IDS[kind];
  const income = Number(event?.income_amount) || 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pendingReimbursement = expenses
    .filter(e => e.reimbursable && e.reimbursement_status === 'submitted')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  document.getElementById(ids.stats).innerHTML = `
    <div class="stat-card"><div class="stat-value">${formatCurrency(income)}</div><div class="stat-label">Income</div></div>
    <div class="stat-card"><div class="stat-value">${formatCurrency(totalExpenses)}</div><div class="stat-label">Total Expenses</div></div>
    <div class="stat-card"><div class="stat-value">${formatCurrency(income - totalExpenses)}</div><div class="stat-label">Net</div></div>
    <div class="stat-card"><div class="stat-value">${formatCurrency(pendingReimbursement)}</div><div class="stat-label">Reimbursement Pending</div></div>
  `;

  const list = document.getElementById(ids.list);
  const jumpLink = jumpToEventTab(kind, eventId, 'spending');
  if (!expenses.length) {
    list.innerHTML = `<p class="empty-hint">No expenses logged yet. <a href="#" onclick="${jumpLink}">Open the full Spending tab to add one →</a></p>`;
    return;
  }

  list.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead><tr><th>Category</th><th>Description</th><th>Vendor</th><th>Amount</th><th>Reimbursement</th></tr></thead>
        <tbody>
          ${expenses.map(exp => `
            <tr>
              <td>${escHtml(EXPENSE_CATEGORY_LABELS[exp.category] || exp.category)}</td>
              <td>${escHtml(exp.description)}</td>
              <td>${escHtml(exp.vendor || '—')}</td>
              <td>${formatCurrency(exp.amount)}</td>
              <td>
                ${exp.reimbursable
                  ? `<select class="field-input" style="max-width:150px;" onchange="updateExpenseReimbursementStatus('${exp.id}', '${kind}', '${eventId}', this.value)">
                      ${REIMBURSEMENT_STATUS_OPTIONS.map(s => `<option value="${s}" ${exp.reimbursement_status === s ? 'selected' : ''}>${capWords(s)}</option>`).join('')}
                     </select>`
                  : '<span class="field-hint">Not reimbursable</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p class="field-hint" style="margin-top:10px;"><a href="#" onclick="${jumpLink}">+ Add an expense on the full Spending tab →</a></p>
  `;
}

async function updateExpenseReimbursementStatus(expenseId, kind, eventId, value) {
  const { error } = await ggClient.from('event_expenses').update({ reimbursement_status: value }).eq('id', expenseId);
  if (error) { alert('Could not save: ' + error.message); return; }
  await loadFinancialsPanel(kind, eventId);
}

// ============================================================
// DOCUMENTS TAB — same event_documents rows the linked event's
// own Documents tab manages. Uploading is done there (jump-out
// link) rather than duplicating the storage-upload flow here;
// this tab is view + delete only.
// ============================================================
const DOCUMENTS_UI_IDS = { speaking: 'spkDocumentsList', training: 'trnDocumentsList' };

async function loadDocumentsPanel(kind, eventId) {
  const listEl = document.getElementById(DOCUMENTS_UI_IDS[kind]);
  if (!eventId) { listEl.innerHTML = '<p class="empty-hint">Documents are stored on the linked Calendar event once this engagement is linked.</p>'; return; }

  const { data, error } = await ggClient.from('event_documents').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  renderDocumentsPanel(kind, eventId, error ? [] : (data || []));
}

function renderDocumentsPanel(kind, eventId, documents) {
  const listEl = document.getElementById(DOCUMENTS_UI_IDS[kind]);
  const jumpLink = jumpToEventTab(kind, eventId, 'documents');

  if (!documents.length) {
    listEl.innerHTML = `<p class="empty-hint">No documents uploaded yet. <a href="#" onclick="${jumpLink}">Open the full Documents tab to upload →</a></p>`;
    return;
  }

  listEl.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead><tr><th>File</th><th>Size</th><th>Uploaded</th><th>Notes</th><th></th></tr></thead>
        <tbody>
          ${documents.map(doc => `
            <tr>
              <td>${escHtml(doc.file_name)}</td>
              <td>${formatFileSize(doc.file_size)}</td>
              <td>${escHtml((doc.created_at || '').slice(0, 10))}</td>
              <td>${escHtml(doc.notes || '—')}</td>
              <td>
                <button class="btn-sm btn-sm-ghost" onclick="viewEventDocument('${escHtml(doc.storage_path)}')">View</button>
                <button class="btn-sm btn-sm-danger" onclick="deleteEngagementDocument('${doc.id}', '${escHtml(doc.storage_path)}', '${kind}', '${eventId}')" title="Delete">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p class="field-hint" style="margin-top:10px;"><a href="#" onclick="${jumpLink}">+ Upload another document on the full Documents tab →</a></p>
  `;
}

async function deleteEngagementDocument(docId, storagePath, kind, eventId) {
  if (!confirm('Delete this document? This cannot be undone.')) return;
  await ggClient.storage.from('event-documents').remove([storagePath]);
  const { error } = await ggClient.from('event_documents').delete().eq('id', docId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  await loadDocumentsPanel(kind, eventId);
}
