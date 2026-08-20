// ============================================================
// GUARDIAN GROUP — admin-calendar.js
// Handles: calendar month grid, events, per-event travel items
// and expenses. Relies on globals defined in admin.js: ggClient,
// escHtml, formatCurrency, formatDate, buildScheduledAt,
// handleModalOverlayClick.
// ============================================================

let calendarViewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarEventsCache = [];
let currentEventId = null;
let currentEventTab = 'details';
let cachedCompaniesForEvents = null;
let cachedWorkshopsForEvents = null;

const EVENT_TYPE_LABELS = { workshop: 'Workshop', travel: 'Travel', meeting: 'Meeting', other: 'Other' };
const TRAVEL_ITEM_TYPE_LABELS = { flight: 'Flight', hotel: 'Hotel', car_rental: 'Car Rental', other: 'Other' };
const EXPENSE_CATEGORY_LABELS = { travel: 'Travel', lodging: 'Lodging', meals: 'Meals', materials: 'Materials', venue: 'Venue', other: 'Other' };

// ── MONTH GRID ────────────────────────────────────────────────
async function loadCalendarMonth() {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '<p class="empty-hint">Loading...</p>';

  const monthStart = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 42);

  const { data, error } = await ggClient
    .from('events')
    .select('id, title, event_type, starts_at, ends_at, all_day')
    .gte('starts_at', gridStart.toISOString())
    .lt('starts_at', gridEnd.toISOString())
    .order('starts_at', { ascending: true });

  calendarEventsCache = error ? [] : (data || []);
  renderCalendarGrid();
}

function renderCalendarGrid() {
  const grid = document.getElementById('calendarGrid');
  const label = document.getElementById('calendarMonthLabel');
  const monthStart = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1);
  label.textContent = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const eventsByDay = {};
  calendarEventsCache.forEach(ev => {
    const key = new Date(ev.starts_at).toDateString();
    if (!eventsByDay[key]) eventsByDay[key] = [];
    eventsByDay[key].push(ev);
  });

  const todayKey = new Date().toDateString();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let html = dayNames.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

  const cellDate = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    const key = cellDate.toDateString();
    const isOutside = cellDate.getMonth() !== monthStart.getMonth();
    const isToday = key === todayKey;
    const dayEvents = eventsByDay[key] || [];

    html += `
      <div class="calendar-day-cell ${isOutside ? 'outside-month' : ''} ${isToday ? 'is-today' : ''}">
        <div class="calendar-day-number">${cellDate.getDate()}</div>
        ${dayEvents.map(ev => renderEventChip(ev)).join('')}
      </div>
    `;
    cellDate.setDate(cellDate.getDate() + 1);
  }

  grid.innerHTML = html;
}

function renderEventChip(ev) {
  const time = ev.all_day ? '' : new Date(ev.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' ';
  return `<div class="calendar-event-chip event-type-${escHtml(ev.event_type)}" onclick="showEventDetail('${ev.id}')" title="${escHtml(ev.title)}">${time}${escHtml(ev.title)}</div>`;
}

function calendarPrevMonth() {
  calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
  loadCalendarMonth();
}
function calendarNextMonth() {
  calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
  loadCalendarMonth();
}
function calendarGoToday() {
  calendarViewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  loadCalendarMonth();
}

// ── EVENT SELECT OPTIONS (shared by create form + edit tab) ───
async function populateEventSelectOptions(companySelectId, workshopSelectId) {
  if (!cachedCompaniesForEvents) {
    const { data } = await ggClient.from('companies').select('id, name').order('name', { ascending: true });
    cachedCompaniesForEvents = data || [];
  }
  if (!cachedWorkshopsForEvents) {
    const { data } = await ggClient.from('workshops').select('id, title, workshop_date').order('workshop_date', { ascending: false });
    cachedWorkshopsForEvents = data || [];
  }

  const companySelect = document.getElementById(companySelectId);
  const companyValue = companySelect.value;
  companySelect.innerHTML = '<option value="">— None —</option>' +
    cachedCompaniesForEvents.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
  companySelect.value = companyValue;

  const workshopSelect = document.getElementById(workshopSelectId);
  const workshopValue = workshopSelect.value;
  workshopSelect.innerHTML = '<option value="">— None —</option>' +
    cachedWorkshopsForEvents.map(w => `<option value="${w.id}">${escHtml(w.title)}${w.workshop_date ? ' — ' + formatDate(w.workshop_date) : ''}</option>`).join('');
  workshopSelect.value = workshopValue;
}

// ── CREATE EVENT ────────────────────────────────────────────────
function showCreateEvent() {
  document.getElementById('createEventCard').style.display = 'block';
  populateEventSelectOptions('newEventCompany', 'newEventWorkshop');
}
function hideCreateEvent() {
  document.getElementById('createEventCard').style.display = 'none';
}

async function createEvent() {
  const title = document.getElementById('newEventTitle').value.trim();
  const startDate = document.getElementById('newEventStartDate').value;
  if (!title || !startDate) {
    alert('Event title and start date are required.');
    return;
  }

  const startTime = document.getElementById('newEventStartTime').value;
  const endDate = document.getElementById('newEventEndDate').value;
  const endTime = document.getElementById('newEventEndTime').value;
  const budget = document.getElementById('newEventBudget').value;

  const payload = {
    title,
    event_type: document.getElementById('newEventType').value,
    starts_at: buildScheduledAt(startDate, startTime) || new Date(`${startDate}T00:00:00`).toISOString(),
    ends_at: endDate ? (buildScheduledAt(endDate, endTime) || new Date(`${endDate}T00:00:00`).toISOString()) : null,
    all_day: document.getElementById('newEventAllDay').checked,
    location: document.getElementById('newEventLocation').value.trim() || null,
    company_id: document.getElementById('newEventCompany').value || null,
    workshop_id: document.getElementById('newEventWorkshop').value || null,
    budget_amount: budget ? parseFloat(budget) : null,
    notes: document.getElementById('newEventNotes').value.trim() || null
  };

  const { error } = await ggClient.from('events').insert(payload);
  if (error) { alert('Could not create event: ' + error.message); return; }

  ['newEventTitle', 'newEventStartDate', 'newEventStartTime', 'newEventEndDate', 'newEventEndTime', 'newEventLocation', 'newEventBudget', 'newEventNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('newEventAllDay').checked = false;
  document.getElementById('newEventType').value = 'other';
  document.getElementById('newEventCompany').value = '';
  document.getElementById('newEventWorkshop').value = '';

  hideCreateEvent();
  loadCalendarMonth();
}

// ── EVENT DETAIL MODAL ──────────────────────────────────────────
async function showEventDetail(eventId) {
  currentEventId = eventId;
  document.getElementById('eventDetailModal').style.display = 'flex';
  await populateEventSelectOptions('editEventCompany', 'editEventWorkshop');
  switchEventTab('details');
  loadEventDetail();
}

function hideEventDetail() {
  document.getElementById('eventDetailModal').style.display = 'none';
  currentEventId = null;
}

function switchEventTab(tabName) {
  currentEventTab = tabName;
  const tabs = { details: 'Details', travel: 'Travel', spending: 'Spending' };
  Object.keys(tabs).forEach(t => {
    document.getElementById(`eventTabPanel${tabs[t]}`).classList.toggle('active', t === tabName);
    document.getElementById(`eventTabBtn${tabs[t]}`).classList.toggle('active', t === tabName);
  });
}

async function loadEventDetail() {
  if (!currentEventId) return;

  const [{ data: event, error }, { data: travelItems }, { data: expenses }] = await Promise.all([
    ggClient.from('events').select('*').eq('id', currentEventId).single(),
    ggClient.from('event_travel_items').select('*').eq('event_id', currentEventId).order('departs_at', { ascending: true, nullsFirst: false }),
    ggClient.from('event_expenses').select('*').eq('event_id', currentEventId).order('incurred_on', { ascending: true, nullsFirst: false })
  ]);

  if (error || !event) {
    alert('Could not load event.');
    hideEventDetail();
    return;
  }

  document.getElementById('eventDetailTitle').textContent = event.title;
  renderEventDetailsTab(event);
  renderEventTravelTab(travelItems || []);
  renderEventSpendingTab(event, expenses || []);
}

function renderEventDetailsTab(event) {
  document.getElementById('editEventTitle').value = event.title || '';
  document.getElementById('editEventType').value = event.event_type || 'other';
  document.getElementById('editEventCompany').value = event.company_id || '';
  document.getElementById('editEventWorkshop').value = event.workshop_id || '';
  document.getElementById('editEventLocation').value = event.location || '';
  document.getElementById('editEventBudget').value = event.budget_amount != null ? event.budget_amount : '';
  document.getElementById('editEventAllDay').checked = !!event.all_day;
  document.getElementById('editEventNotes').value = event.notes || '';

  const starts = new Date(event.starts_at);
  document.getElementById('editEventStartDate').value = toDateInputValue(starts);
  document.getElementById('editEventStartTime').value = event.all_day ? '' : toTimeInputValue(starts);

  if (event.ends_at) {
    const ends = new Date(event.ends_at);
    document.getElementById('editEventEndDate').value = toDateInputValue(ends);
    document.getElementById('editEventEndTime').value = event.all_day ? '' : toTimeInputValue(ends);
  } else {
    document.getElementById('editEventEndDate').value = '';
    document.getElementById('editEventEndTime').value = '';
  }
}

async function saveEventDetails() {
  if (!currentEventId) return;

  const title = document.getElementById('editEventTitle').value.trim();
  const startDate = document.getElementById('editEventStartDate').value;
  if (!title || !startDate) {
    alert('Event title and start date are required.');
    return;
  }

  const startTime = document.getElementById('editEventStartTime').value;
  const endDate = document.getElementById('editEventEndDate').value;
  const endTime = document.getElementById('editEventEndTime').value;
  const budget = document.getElementById('editEventBudget').value;

  const payload = {
    title,
    event_type: document.getElementById('editEventType').value,
    starts_at: buildScheduledAt(startDate, startTime) || new Date(`${startDate}T00:00:00`).toISOString(),
    ends_at: endDate ? (buildScheduledAt(endDate, endTime) || new Date(`${endDate}T00:00:00`).toISOString()) : null,
    all_day: document.getElementById('editEventAllDay').checked,
    location: document.getElementById('editEventLocation').value.trim() || null,
    company_id: document.getElementById('editEventCompany').value || null,
    workshop_id: document.getElementById('editEventWorkshop').value || null,
    budget_amount: budget ? parseFloat(budget) : null,
    notes: document.getElementById('editEventNotes').value.trim() || null
  };

  const { error } = await ggClient.from('events').update(payload).eq('id', currentEventId);
  if (error) { alert('Could not save event: ' + error.message); return; }

  loadCalendarMonth();
  loadEventDetail();
}

async function deleteEvent(eventId) {
  if (!eventId) return;
  if (!confirm('Delete this event? This also deletes its travel items and expenses. This cannot be undone.')) return;

  const { error } = await ggClient.from('events').delete().eq('id', eventId);
  if (error) { alert('Could not delete event: ' + error.message); return; }

  hideEventDetail();
  loadCalendarMonth();
}

// ── TRAVEL TAB ────────────────────────────────────────────────
function renderEventTravelTab(items) {
  const container = document.getElementById('eventTravelList');
  if (!items.length) {
    container.innerHTML = '<p class="empty-hint">No travel planned yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead>
          <tr><th>Type</th><th>Description</th><th>Provider</th><th>Departs</th><th>Arrives</th><th>Cost</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${escHtml(TRAVEL_ITEM_TYPE_LABELS[item.item_type] || item.item_type)}</td>
              <td>${escHtml(item.description)}${item.confirmation_number ? `<br><span class="field-hint">Conf# ${escHtml(item.confirmation_number)}</span>` : ''}</td>
              <td>${escHtml(item.provider || '—')}</td>
              <td>${item.departs_at ? formatDateTime(item.departs_at) : '—'}</td>
              <td>${item.arrives_at ? formatDateTime(item.arrives_at) : '—'}</td>
              <td>${item.cost != null ? formatCurrency(item.cost) : '—'}</td>
              <td>
                <select class="attendance-status-select" onchange="updateTravelItemField('${item.id}', 'status', this.value)">
                  <option value="planned" ${item.status === 'planned' ? 'selected' : ''}>Planned</option>
                  <option value="booked" ${item.status === 'booked' ? 'selected' : ''}>Booked</option>
                  <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
              </td>
              <td><button class="btn-sm btn-sm-danger" onclick="deleteTravelItem('${item.id}')">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showAddTravelItem() {
  document.getElementById('addTravelItemCard').style.display = 'block';
  document.getElementById('showAddTravelItemBtn').style.display = 'none';
}
function hideAddTravelItem() {
  document.getElementById('addTravelItemCard').style.display = 'none';
  document.getElementById('showAddTravelItemBtn').style.display = 'inline-block';
}

async function addTravelItem() {
  const description = document.getElementById('travelItemDescription').value.trim();
  if (!description) { alert('Description is required.'); return; }

  const departsDate = document.getElementById('travelItemDepartsDate').value;
  const departsTime = document.getElementById('travelItemDepartsTime').value;
  const arrivesDate = document.getElementById('travelItemArrivesDate').value;
  const arrivesTime = document.getElementById('travelItemArrivesTime').value;
  const cost = document.getElementById('travelItemCost').value;

  const payload = {
    event_id: currentEventId,
    item_type: document.getElementById('travelItemType').value,
    description,
    provider: document.getElementById('travelItemProvider').value.trim() || null,
    confirmation_number: document.getElementById('travelItemConfirmation').value.trim() || null,
    departs_at: departsDate ? (buildScheduledAt(departsDate, departsTime) || new Date(`${departsDate}T00:00:00`).toISOString()) : null,
    arrives_at: arrivesDate ? (buildScheduledAt(arrivesDate, arrivesTime) || new Date(`${arrivesDate}T00:00:00`).toISOString()) : null,
    cost: cost ? parseFloat(cost) : null,
    status: document.getElementById('travelItemStatus').value,
    notes: document.getElementById('travelItemNotes').value.trim() || null
  };

  const { error } = await ggClient.from('event_travel_items').insert(payload);
  if (error) { alert('Could not add travel item: ' + error.message); return; }

  ['travelItemDescription', 'travelItemProvider', 'travelItemConfirmation', 'travelItemDepartsDate', 'travelItemDepartsTime', 'travelItemArrivesDate', 'travelItemArrivesTime', 'travelItemCost', 'travelItemNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('travelItemType').value = 'flight';
  document.getElementById('travelItemStatus').value = 'planned';

  hideAddTravelItem();
  loadEventDetail();
}

async function updateTravelItemField(itemId, field, value) {
  const { error } = await ggClient.from('event_travel_items').update({ [field]: value }).eq('id', itemId);
  if (error) { alert('Could not save: ' + error.message); }
  loadEventDetail();
}

async function deleteTravelItem(itemId) {
  if (!confirm('Delete this travel item?')) return;
  const { error } = await ggClient.from('event_travel_items').delete().eq('id', itemId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  loadEventDetail();
}

// ── SPENDING TAB ──────────────────────────────────────────────
function renderEventSpendingTab(event, expenses) {
  const totalSpend = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const budget = event.budget_amount != null ? parseFloat(event.budget_amount) : null;

  let statsHtml = `
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(totalSpend)}</div>
      <div class="stat-label">Actual Spend</div>
    </div>
  `;
  if (budget != null) {
    const remaining = budget - totalSpend;
    statsHtml = `
      <div class="stat-card">
        <div class="stat-value">${formatCurrency(budget)}</div>
        <div class="stat-label">Budget</div>
      </div>
      ${statsHtml}
      <div class="stat-card ${remaining < 0 ? 'over-budget' : ''}">
        <div class="stat-value">${formatCurrency(remaining)}</div>
        <div class="stat-label">Remaining</div>
      </div>
    `;
  }
  document.getElementById('eventSpendingStats').innerHTML = statsHtml;

  const container = document.getElementById('eventExpensesList');
  if (!expenses.length) {
    container.innerHTML = '<p class="empty-hint">No expenses logged yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead>
          <tr><th>Category</th><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          ${expenses.map(exp => `
            <tr>
              <td>${escHtml(EXPENSE_CATEGORY_LABELS[exp.category] || exp.category)}</td>
              <td>${escHtml(exp.description)}</td>
              <td>${exp.incurred_on ? formatDate(exp.incurred_on) : '—'}</td>
              <td>${formatCurrency(exp.amount)}</td>
              <td>
                <select class="attendance-status-select" onchange="updateExpenseField('${exp.id}', 'status', this.value)">
                  <option value="planned" ${exp.status === 'planned' ? 'selected' : ''}>Planned</option>
                  <option value="paid" ${exp.status === 'paid' ? 'selected' : ''}>Paid</option>
                  <option value="reimbursed" ${exp.status === 'reimbursed' ? 'selected' : ''}>Reimbursed</option>
                </select>
              </td>
              <td><button class="btn-sm btn-sm-danger" onclick="deleteExpense('${exp.id}')">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showAddExpense() {
  document.getElementById('addExpenseCard').style.display = 'block';
  document.getElementById('showAddExpenseBtn').style.display = 'none';
}
function hideAddExpense() {
  document.getElementById('addExpenseCard').style.display = 'none';
  document.getElementById('showAddExpenseBtn').style.display = 'inline-block';
}

async function addExpense() {
  const description = document.getElementById('expenseDescription').value.trim();
  const amount = document.getElementById('expenseAmount').value;
  if (!description || !amount) { alert('Description and amount are required.'); return; }

  const payload = {
    event_id: currentEventId,
    category: document.getElementById('expenseCategory').value,
    description,
    amount: parseFloat(amount),
    status: document.getElementById('expenseStatus').value,
    incurred_on: document.getElementById('expenseIncurredOn').value || null
  };

  const { error } = await ggClient.from('event_expenses').insert(payload);
  if (error) { alert('Could not add expense: ' + error.message); return; }

  document.getElementById('expenseDescription').value = '';
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseIncurredOn').value = '';
  document.getElementById('expenseCategory').value = 'other';
  document.getElementById('expenseStatus').value = 'planned';

  hideAddExpense();
  loadEventDetail();
}

async function updateExpenseField(expenseId, field, value) {
  const { error } = await ggClient.from('event_expenses').update({ [field]: value }).eq('id', expenseId);
  if (error) { alert('Could not save: ' + error.message); }
  loadEventDetail();
}

async function deleteExpense(expenseId) {
  if (!confirm('Delete this expense?')) return;
  const { error } = await ggClient.from('event_expenses').delete().eq('id', expenseId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  loadEventDetail();
}

// ── UTILS ─────────────────────────────────────────────────────
function toDateInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
