// ============================================================
// GUARDIAN GROUP — admin-calendar.js
// Handles: calendar month grid, events, a unified itinerary
// (travel logistics + trip content in one table, fields shown
// depend on Type), expenses, and document attachments. Relies on
// globals defined in admin.js: ggClient, escHtml, formatCurrency,
// formatDate, formatFileSize, buildScheduledAt,
// handleModalOverlayClick.
// ============================================================

let calendarViewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calendarEventsCache = [];
let calendarTasksCache = [];
let calendarShowTasks = true;
let allTasksCache = [];
let cachedEventsForTasks = null;
let editingTaskId = null;
let currentEventId = null;
let currentEventTab = 'details';
let cachedCompaniesForEvents = null;
let cachedInvoicesForEvents = null;
let editingItineraryItemId = null;
let currentItineraryItems = [];
let currentExpenses = [];
let currentEventDocuments = [];

const EVENT_TYPE_LABELS = { workshop: 'Workshop', travel: 'Travel', meeting: 'Meeting', speaking: 'Speaking Engagement', training: 'Training', other: 'Other' };
const EVENT_STATUS_LABELS = {
  application_sent: 'Application Sent',
  application_denied: 'Application Denied',
  planning: 'Planning',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed'
};
const EXPENSE_CATEGORY_LABELS = { travel: 'Travel', lodging: 'Lodging', meals: 'Meals', materials: 'Materials', venue: 'Venue', other: 'Other' };
const ITINERARY_ITEM_TYPE_LABELS = {
  driving_to: 'Driving To',
  driving_home: 'Driving Home',
  departing_flight: 'Departing Flight',
  return_flight: 'Return Flight',
  hotel: 'Hotel',
  car_rental: 'Car Rental',
  speaking_session: 'Speaking Session',
  training_session: 'Training Session',
  other: 'Other'
};
// Which extra field groups show on the itinerary item form/table, based on Type.
// "other" shows both, since it's the catch-all and could be either kind of item.
const LOGISTICS_TYPES = new Set(['driving_to', 'driving_home', 'departing_flight', 'return_flight', 'hotel', 'car_rental']);
const SESSION_TYPES = new Set(['speaking_session', 'training_session']);

// Flips any 'confirmed' event whose end date (or start date, if no
// end date) has passed into 'completed'. Only runs when someone has
// the Calendar view open — not a background job — so a status only
// flips over the next time the dashboard is opened after the event ends.
async function autoCompletePastConfirmedEvents() {
  const { error } = await ggClient.rpc('auto_complete_confirmed_events');
  if (error) console.error('Could not auto-complete past confirmed events:', error.message);
}

// ── MONTH GRID ────────────────────────────────────────────────
async function loadCalendarMonth() {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '<p class="empty-hint">Loading...</p>';

  const monthStart = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 42);

  const gridStartIso = gridStart.toISOString();
  const gridEndIso = gridEnd.toISOString();

  // An event is visible on this grid if it starts before the grid
  // ends, AND either its end date reaches into the grid, or (for
  // events with no end date) it starts within the grid.
  const [{ data, error }, { data: taskData }] = await Promise.all([
    ggClient
      .from('events')
      .select('id, title, event_type, status, starts_at, ends_at, all_day')
      .lt('starts_at', gridEndIso)
      .or(`ends_at.gte.${gridStartIso},and(ends_at.is.null,starts_at.gte.${gridStartIso})`)
      .order('starts_at', { ascending: true }),
    ggClient
      .from('tasks')
      .select('id, title, due_date, status')
      .gte('due_date', toDateInputValue(gridStart))
      .lt('due_date', toDateInputValue(gridEnd))
      .order('due_date', { ascending: true })
  ]);

  calendarEventsCache = error ? [] : (data || []);
  calendarTasksCache = taskData || [];
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
    const start = new Date(ev.starts_at);
    const end = ev.ends_at ? new Date(ev.ends_at) : start;
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= lastDay) {
      const key = cursor.toDateString();
      if (!eventsByDay[key]) eventsByDay[key] = [];
      eventsByDay[key].push(ev);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const tasksByDay = {};
  calendarTasksCache.forEach(task => {
    if (!task.due_date) return;
    const key = new Date(task.due_date + 'T00:00:00').toDateString();
    if (!tasksByDay[key]) tasksByDay[key] = [];
    tasksByDay[key].push(task);
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
    const dayTasks = tasksByDay[key] || [];

    html += `
      <div class="calendar-day-cell ${isOutside ? 'outside-month' : ''} ${isToday ? 'is-today' : ''}">
        <div class="calendar-day-number">${cellDate.getDate()}</div>
        ${dayEvents.map(ev => renderEventChip(ev)).join('')}
        ${calendarShowTasks ? dayTasks.map(task => renderTaskChip(task)).join('') : ''}
      </div>
    `;
    cellDate.setDate(cellDate.getDate() + 1);
  }

  grid.innerHTML = html;
}

function renderTaskChip(task) {
  const isDone = task.status === 'done';
  const isOverdue = !isDone && task.due_date && task.due_date < toDateInputValue(new Date());
  const cls = isDone ? 'task-done' : (isOverdue ? 'task-overdue' : '');
  return `<div class="calendar-task-chip ${cls}" onclick="editTask('${task.id}')" title="${escHtml(task.title)}">${isDone ? '✓ ' : '☐ '}${escHtml(task.title)}</div>`;
}

// Status takes priority over event type for chip color: completed
// events go gray, cancelled/denied ones go light red, and
// application-sent/planning ones go warm yellow regardless of type.
// Only 'confirmed' (or any other status) falls through to the
// per-event-type color.
function eventChipColorClass(ev) {
  if (ev.status === 'completed') return 'status-completed';
  if (ev.status === 'cancelled' || ev.status === 'application_denied') return 'status-dead';
  if (ev.status === 'application_sent' || ev.status === 'planning') return 'status-pending';
  return `event-type-${ev.event_type}`;
}

function renderEventChip(ev) {
  const time = ev.all_day ? '' : new Date(ev.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' ';
  return `<div class="calendar-event-chip ${eventChipColorClass(ev)}" onclick="showEventDetail('${ev.id}')" title="${escHtml(ev.title)}">${time}${escHtml(ev.title)}</div>`;
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

function toggleCalendarTasks(checked) {
  calendarShowTasks = checked;
  renderCalendarGrid();
}

// ── EVENTS LIST ───────────────────────────────────────────────
let allEventsListCache = [];

async function loadEventsListTable() {
  const tbody = document.getElementById('eventsListTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7">Loading…</td></tr>';

  const { data, error } = await ggClient
    .from('events')
    .select('id, title, event_type, status, starts_at, ends_at, location, company_id, companies!company_id(name)')
    .order('starts_at', { ascending: true });

  if (error) { tbody.innerHTML = `<tr><td colspan="7">Error: ${escHtml(error.message)}</td></tr>`; return; }

  allEventsListCache = data || [];
  renderEventsListTable();
}

function renderEventsListTable() {
  const tbody = document.getElementById('eventsListTableBody');
  if (!tbody) return;

  const statusFilter = document.getElementById('eventsStatusFilter').value;
  const filtered = statusFilter === 'all' ? allEventsListCache : allEventsListCache.filter(ev => ev.status === statusFilter);

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7">No events match.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(ev => `
    <tr class="client-list-row" onclick="showEventDetail('${ev.id}')">
      <td>${escHtml(ev.title)}</td>
      <td>${escHtml(EVENT_TYPE_LABELS[ev.event_type] || ev.event_type)}</td>
      <td><span class="reg-card-status-badge">${escHtml(EVENT_STATUS_LABELS[ev.status] || ev.status)}</span></td>
      <td>${ev.starts_at ? formatDate(toDateInputValue(new Date(ev.starts_at))) : '—'}</td>
      <td>${ev.ends_at ? formatDate(toDateInputValue(new Date(ev.ends_at))) : '—'}</td>
      <td>${escHtml(ev.location || '—')}</td>
      <td>${escHtml(ev.companies?.name || '—')}</td>
    </tr>
  `).join('');
}

// ── TASKS ─────────────────────────────────────────────────────
async function populateTaskEventSelect() {
  if (!cachedEventsForTasks) {
    const { data } = await ggClient.from('events').select('id, title, starts_at').order('starts_at', { ascending: false }).limit(100);
    cachedEventsForTasks = data || [];
  }
  const select = document.getElementById('newTaskEvent');
  const value = select.value;
  select.innerHTML = '<option value="">— None —</option>' +
    cachedEventsForTasks.map(ev => `<option value="${ev.id}">${escHtml(ev.title)}</option>`).join('');
  select.value = value;
}

function showCreateTask() {
  editingTaskId = null;
  document.getElementById('createTaskCardTitle').textContent = 'Create New Task';
  document.getElementById('taskSubmitBtn').textContent = 'Create Task →';
  document.getElementById('newTaskTitle').value = '';
  document.getElementById('newTaskDueDate').value = '';
  document.getElementById('newTaskOwner').value = 'Unassigned';
  document.getElementById('newTaskEvent').value = '';
  document.getElementById('newTaskLink').value = '';
  document.getElementById('newTaskNotes').value = '';
  populateTaskEventSelect();
  document.getElementById('createTaskCard').style.display = 'block';
}
function hideCreateTask() {
  editingTaskId = null;
  document.getElementById('createTaskCard').style.display = 'none';
}

// Ensures the Tasks view (which hosts the task form) is on screen
// before opening it — task rows can also be clicked from the Dashboard
// or from a task chip on the Calendar's month grid.
function ensureTasksViewActive() {
  const tasksNavBtn = document.querySelector('.nav-subitem[data-view="tasks"]');
  if (tasksNavBtn && !tasksNavBtn.classList.contains('active')) {
    setView('tasks', tasksNavBtn);
  }
}

// "+ New Task" on the Calendar view — jumps to Tasks (which hosts the
// form) and opens it, same as clicking a task chip on the month grid.
function showCreateTaskFromCalendar() {
  ensureTasksViewActive();
  showCreateTask();
}

async function editTask(taskId) {
  ensureTasksViewActive();
  await populateTaskEventSelect();

  // Cached rows (from the month grid, dashboard, or task list) are the
  // lightweight shape (id, title, due_date, status) — fetch the full row.
  const { data, error } = await ggClient.from('tasks').select('*').eq('id', taskId).single();
  if (error || !data) { alert('Could not load task.'); return; }
  populateEditTaskForm(data);
}

function populateEditTaskForm(task) {
  editingTaskId = task.id;
  document.getElementById('createTaskCardTitle').textContent = 'Edit Task';
  document.getElementById('taskSubmitBtn').textContent = 'Save Changes →';
  document.getElementById('newTaskTitle').value = task.title || '';
  document.getElementById('newTaskDueDate').value = task.due_date || '';
  document.getElementById('newTaskOwner').value = task.owner || 'Unassigned';
  document.getElementById('newTaskEvent').value = task.event_id || '';
  document.getElementById('newTaskLink').value = task.link_url || '';
  document.getElementById('newTaskNotes').value = task.notes || '';
  document.getElementById('createTaskCard').style.display = 'block';
  document.getElementById('createTaskCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveTask() {
  const title = document.getElementById('newTaskTitle').value.trim();
  if (!title) { alert('Task title is required.'); return; }

  const payload = {
    title,
    due_date: document.getElementById('newTaskDueDate').value || null,
    owner: document.getElementById('newTaskOwner').value,
    event_id: document.getElementById('newTaskEvent').value || null,
    link_url: document.getElementById('newTaskLink').value.trim() || null,
    notes: document.getElementById('newTaskNotes').value.trim() || null
  };

  const { error } = editingTaskId
    ? await ggClient.from('tasks').update(payload).eq('id', editingTaskId)
    : await ggClient.from('tasks').insert({ ...payload, status: 'todo' });
  if (error) { alert('Could not save task: ' + error.message); return; }

  hideCreateTask();
  loadCalendarMonth();
  loadTaskList();
}

async function toggleTaskStatus(taskId, currentStatus) {
  const newStatus = currentStatus === 'done' ? 'todo' : 'done';
  const { error } = await ggClient.from('tasks').update({ status: newStatus }).eq('id', taskId);
  if (error) { alert('Could not update task: ' + error.message); return; }
  loadCalendarMonth();
  loadTaskList();
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;
  const { error } = await ggClient.from('tasks').delete().eq('id', taskId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  loadCalendarMonth();
  loadTaskList();
}

async function loadTaskList() {
  const { data, error } = await ggClient
    .from('tasks')
    .select('id, title, due_date, status, owner, event_id, link_url')
    .order('due_date', { ascending: true, nullsFirst: false });

  allTasksCache = error ? [] : (data || []);
  renderTaskList();
  renderDashboardTaskList();
}

function buildTaskRowsHtml(tasks) {
  const todayStr = toDateInputValue(new Date());
  const eventTitleById = Object.fromEntries((cachedEventsForTasks || []).map(ev => [ev.id, ev.title]));

  return tasks.map(task => {
    const isDone = task.status === 'done';
    const isOverdue = !isDone && task.due_date && task.due_date < todayStr;
    const eventTitle = task.event_id ? (eventTitleById[task.event_id] || null) : null;
    return `
      <div class="task-row ${isDone ? 'task-row-done' : ''}">
        <input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTaskStatus('${task.id}', '${task.status}')" />
        <span class="task-row-title" onclick="editTask('${task.id}')" style="cursor:pointer;">${escHtml(task.title)}</span>
        ${task.owner && task.owner !== 'Unassigned' ? `<span class="task-row-owner">${escHtml(task.owner)}</span>` : ''}
        ${eventTitle ? `<span class="task-row-event">${escHtml(eventTitle)}</span>` : ''}
        ${task.link_url ? `<a class="task-row-link" href="${escHtml(task.link_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 Link</a>` : ''}
        <span class="task-row-due ${isOverdue ? 'task-row-overdue' : ''}">${task.due_date ? formatDate(task.due_date) : 'No due date'}</span>
        <button class="btn-sm btn-sm-danger" onclick="deleteTask('${task.id}')">Delete</button>
      </div>
    `;
  }).join('');
}

function renderTaskList() {
  const container = document.getElementById('taskListContainer');
  if (!container) return;

  const showCompleted = document.getElementById('taskShowCompleted').checked;
  const tasks = allTasksCache.filter(t => showCompleted || t.status !== 'done');
  container.innerHTML = tasks.length ? buildTaskRowsHtml(tasks) : '<p class="empty-hint">No tasks yet.</p>';
}

function renderDashboardTaskList() {
  const container = document.getElementById('dashboardTaskList');
  if (!container) return;

  const checkbox = document.getElementById('dashboardTaskShowCompleted');
  const showCompleted = checkbox && checkbox.checked;
  const tasks = allTasksCache.filter(t => showCompleted || t.status !== 'done').slice(0, 8);
  container.innerHTML = tasks.length ? buildTaskRowsHtml(tasks) : '<p class="empty-hint">No tasks yet.</p>';
}

// ── EVENT SELECT OPTIONS (shared by create form + edit tab) ───
async function populateEventSelectOptions(companySelectId) {
  if (!cachedCompaniesForEvents) {
    const { data } = await ggClient.from('companies').select('id, name').order('name', { ascending: true });
    cachedCompaniesForEvents = data || [];
  }
  fillCompanySelect(companySelectId);
}

function fillCompanySelect(selectId) {
  const select = document.getElementById(selectId);
  const value = select.value;
  select.innerHTML = '<option value="">— None —</option>' +
    cachedCompaniesForEvents.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('') +
    '<option value="__new__">+ Create New Client</option>';
  select.value = value;
}

// Any Client <select> that offers "+ Create New Client" wires its
// onchange here — prompts for a name, creates a minimal companies
// row, refreshes every Client select on screen, and selects it.
async function handleClientSelectChange(selectEl) {
  if (selectEl.value !== '__new__') return;

  const name = prompt('New client name:');
  if (!name || !name.trim()) { selectEl.value = ''; return; }

  const { data, error } = await ggClient.from('companies').insert({ name: name.trim() }).select('id, name').single();
  if (error) { alert('Could not create client: ' + error.message); selectEl.value = ''; return; }

  cachedCompaniesForEvents = [...(cachedCompaniesForEvents || []), data].sort((a, b) => a.name.localeCompare(b.name));
  ['newEventCompany', 'editEventCompany', 'itineraryItemCompany'].forEach(id => {
    if (document.getElementById(id)) fillCompanySelect(id);
  });
  selectEl.value = data.id;
}

// ── ITINERARY FORM SELECT OPTIONS (Client + Invoice) ───────────
async function populateItineraryFormSelects() {
  if (!cachedCompaniesForEvents) {
    const { data } = await ggClient.from('companies').select('id, name').order('name', { ascending: true });
    cachedCompaniesForEvents = data || [];
  }
  fillCompanySelect('itineraryItemCompany');

  if (!cachedInvoicesForEvents) {
    const { data } = await ggClient
      .from('documents')
      .select('id, doc_number, client_name, total')
      .eq('doc_type', 'invoice')
      .order('doc_number', { ascending: false });
    cachedInvoicesForEvents = data || [];
  }
  fillInvoiceSelect();
}

function fillInvoiceSelect() {
  const select = document.getElementById('itineraryItemInvoice');
  const value = select.value;
  select.innerHTML = '<option value="">— None —</option>' +
    cachedInvoicesForEvents.map(inv =>
      `<option value="${inv.id}">${escHtml(inv.doc_number)}${inv.client_name ? ' — ' + escHtml(inv.client_name) : ''} (${formatCurrency(inv.total)})</option>`
    ).join('') +
    '<option value="__new__">+ Create Invoice</option>';
  select.value = value;
}

// "+ Create Invoice" in the Linked Invoice dropdown — asks for the
// bare minimum (client name, description, amount), assigns a real
// doc_number via the same RPC the Quote/Invoice/Receipt tool uses,
// and creates a draft invoice you can flesh out there later.
async function handleInvoiceSelectChange(selectEl) {
  if (selectEl.value !== '__new__') return;

  const clientName = prompt('Client name for this invoice:');
  if (!clientName || !clientName.trim()) { selectEl.value = ''; return; }

  const description = prompt('What is this invoice for?') || 'Services rendered';
  const amountStr = prompt('Amount (USD):');
  const amount = parseFloat(amountStr);
  if (!amountStr || isNaN(amount) || amount <= 0) { alert('A valid amount is required.'); selectEl.value = ''; return; }

  const { data: docNumber, error: numErr } = await ggClient.rpc('next_doc_number', { p_type: 'invoice' });
  if (numErr) { alert('Could not create invoice: ' + numErr.message); selectEl.value = ''; return; }

  const payload = {
    doc_type: 'invoice',
    doc_number: docNumber,
    status: 'draft',
    client_name: clientName.trim(),
    company_id: document.getElementById('itineraryItemCompany').value || null,
    doc_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    due_terms: 'Net 14',
    items: [{ id: 1, date: '', description: description.trim(), type: 'flat', qty: '1', rate: String(amount) }],
    discount_type: '$',
    discount_value: 0,
    subtotal: amount,
    discount_amount: 0,
    total: amount,
    amount_paid: 0,
    balance: amount
  };

  const { data, error } = await ggClient.from('documents').insert(payload).select('id, doc_number, client_name, total').single();
  if (error) { alert('Could not create invoice: ' + error.message); selectEl.value = ''; return; }

  cachedInvoicesForEvents = [data, ...(cachedInvoicesForEvents || [])];
  fillInvoiceSelect();
  selectEl.value = data.id;
}

// ── CREATE EVENT ────────────────────────────────────────────────
function showCreateEvent() {
  document.getElementById('createEventCard').style.display = 'block';
  populateEventSelectOptions('newEventCompany');
}
function hideCreateEvent() {
  document.getElementById('createEventCard').style.display = 'none';
}

async function createCalendarEvent() {
  const title = document.getElementById('newEventTitle').value.trim();
  const startDate = document.getElementById('newEventStartDate').value;
  if (!title || !startDate) {
    alert('Event title and start date are required.');
    return;
  }

  const endDate = document.getElementById('newEventEndDate').value;
  const budget = document.getElementById('newEventBudget').value;

  const payload = {
    title,
    event_type: document.getElementById('newEventType').value,
    status: document.getElementById('newEventStatus').value,
    starts_at: new Date(`${startDate}T00:00:00`).toISOString(),
    ends_at: endDate ? new Date(`${endDate}T00:00:00`).toISOString() : null,
    all_day: true,
    location: document.getElementById('newEventLocation').value.trim() || null,
    company_id: document.getElementById('newEventCompany').value || null,
    budget_amount: budget ? parseFloat(budget) : null,
    link_url: document.getElementById('newEventLink').value.trim() || null,
    notes: document.getElementById('newEventNotes').value.trim() || null
  };

  const { error } = await ggClient.from('events').insert(payload);
  if (error) { alert('Could not create event: ' + error.message); return; }

  ['newEventTitle', 'newEventStartDate', 'newEventEndDate', 'newEventLocation', 'newEventBudget', 'newEventLink', 'newEventNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('newEventType').value = 'other';
  document.getElementById('newEventStatus').value = 'planning';
  document.getElementById('newEventCompany').value = '';

  hideCreateEvent();
  loadCalendarMonth();
}

// ── EVENT DETAIL MODAL ──────────────────────────────────────────
async function showEventDetail(eventId) {
  currentEventId = eventId;
  document.getElementById('eventDetailModal').style.display = 'flex';
  await populateEventSelectOptions('editEventCompany');
  await populateItineraryFormSelects();
  switchEventTab('details');
  loadEventDetail();
}

function hideEventDetail() {
  document.getElementById('eventDetailModal').style.display = 'none';
  currentEventId = null;
}

function switchEventTab(tabName) {
  currentEventTab = tabName;
  const tabs = { details: 'Details', itinerary: 'Itinerary', spending: 'Spending', documents: 'Documents' };
  Object.keys(tabs).forEach(t => {
    document.getElementById(`eventTabPanel${tabs[t]}`).classList.toggle('active', t === tabName);
    document.getElementById(`eventTabBtn${tabs[t]}`).classList.toggle('active', t === tabName);
  });
}

async function loadEventDetail() {
  if (!currentEventId) return;

  const [{ data: event, error }, { data: expenses }, { data: itineraryItems }, { data: documents }] = await Promise.all([
    ggClient.from('events').select('*').eq('id', currentEventId).single(),
    ggClient.from('event_expenses').select('*').eq('event_id', currentEventId).order('incurred_on', { ascending: true, nullsFirst: false }),
    ggClient.from('event_itinerary_items').select('*').eq('event_id', currentEventId).order('starts_at', { ascending: true, nullsFirst: false }),
    ggClient.from('event_documents').select('*').eq('event_id', currentEventId).order('created_at', { ascending: false })
  ]);

  if (error || !event) {
    alert('Could not load event.');
    hideEventDetail();
    return;
  }

  currentItineraryItems = itineraryItems || [];
  currentExpenses = expenses || [];
  currentEventDocuments = documents || [];

  document.getElementById('eventDetailTitle').textContent = event.title;
  renderEventDetailsTab(event);
  renderEventItineraryTab(currentItineraryItems, currentEventDocuments);
  renderEventSpendingTab(event, currentExpenses, currentItineraryItems);
  renderEventDocumentsTab(currentEventDocuments, currentItineraryItems, currentExpenses);
  populateEventDocLinkOptions(currentItineraryItems, currentExpenses);
}

function renderEventDetailsTab(event) {
  document.getElementById('editEventTitle').value = event.title || '';
  document.getElementById('editEventType').value = event.event_type || 'other';
  document.getElementById('editEventStatus').value = event.status || 'planning';
  document.getElementById('editEventCompany').value = event.company_id || '';
  document.getElementById('editEventLocation').value = event.location || '';
  document.getElementById('editEventBudget').value = event.budget_amount != null ? event.budget_amount : '';
  document.getElementById('editEventLink').value = event.link_url || '';
  document.getElementById('editEventNotes').value = event.notes || '';

  document.getElementById('editEventStartDate').value = toDateInputValue(new Date(event.starts_at));
  document.getElementById('editEventEndDate').value = event.ends_at ? toDateInputValue(new Date(event.ends_at)) : '';
}

async function saveEventDetails() {
  if (!currentEventId) return;

  const title = document.getElementById('editEventTitle').value.trim();
  const startDate = document.getElementById('editEventStartDate').value;
  if (!title || !startDate) {
    alert('Event title and start date are required.');
    return;
  }

  const endDate = document.getElementById('editEventEndDate').value;
  const budget = document.getElementById('editEventBudget').value;

  const payload = {
    title,
    event_type: document.getElementById('editEventType').value,
    status: document.getElementById('editEventStatus').value,
    starts_at: new Date(`${startDate}T00:00:00`).toISOString(),
    ends_at: endDate ? new Date(`${endDate}T00:00:00`).toISOString() : null,
    all_day: true,
    location: document.getElementById('editEventLocation').value.trim() || null,
    company_id: document.getElementById('editEventCompany').value || null,
    budget_amount: budget ? parseFloat(budget) : null,
    link_url: document.getElementById('editEventLink').value.trim() || null,
    notes: document.getElementById('editEventNotes').value.trim() || null
  };

  const { error } = await ggClient.from('events').update(payload).eq('id', currentEventId);
  if (error) { alert('Could not save event: ' + error.message); return; }

  loadCalendarMonth();
  loadEventDetail();
}

async function deleteEvent(eventId) {
  if (!eventId) return;
  if (!confirm('Delete this event? This also deletes its itinerary items and expenses. This cannot be undone.')) return;

  const { error } = await ggClient.from('events').delete().eq('id', eventId);
  if (error) { alert('Could not delete event: ' + error.message); return; }

  hideEventDetail();
  loadCalendarMonth();
}

// ── ITINERARY TAB (travel logistics + trip content, unified) ──
function updateItineraryFormFieldsForType() {
  const type = document.getElementById('itineraryItemType').value;
  const showLogistics = LOGISTICS_TYPES.has(type) || type === 'other';
  const showSession = SESSION_TYPES.has(type) || type === 'other';
  document.querySelectorAll('.itin-logistics-field').forEach(el => { el.style.display = showLogistics ? '' : 'none'; });
  document.querySelectorAll('.itin-session-field').forEach(el => { el.style.display = showSession ? '' : 'none'; });
}

function toggleItineraryAddressFields() {
  const el = document.getElementById('itineraryAddressFields');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function applyItineraryAddress() {
  const parts = [
    document.getElementById('itineraryAddrStreet').value.trim(),
    document.getElementById('itineraryAddrCity').value.trim(),
    [document.getElementById('itineraryAddrRegion').value.trim(), document.getElementById('itineraryAddrPostal').value.trim()].filter(Boolean).join(' '),
    document.getElementById('itineraryAddrCountry').value.trim()
  ].filter(Boolean);
  document.getElementById('itineraryItemLocation').value = parts.join(', ');
  document.getElementById('itineraryAddressFields').style.display = 'none';
}

function renderEventItineraryTab(items, documents) {
  const container = document.getElementById('eventItineraryList');
  if (!items.length) {
    container.innerHTML = '<p class="empty-hint">No itinerary items yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead>
          <tr><th>Type</th><th>Title</th><th>Starts</th><th>Ends</th><th>Cost</th><th>Status</th><th>Income</th><th></th></tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const docCount = (documents || []).filter(d => d.itinerary_item_id === item.id).length;
            const isLogistics = LOGISTICS_TYPES.has(item.item_type);
            return `
            <tr>
              <td>${escHtml(ITINERARY_ITEM_TYPE_LABELS[item.item_type] || item.item_type)}</td>
              <td>${escHtml(item.title)}${item.link_url ? ` <a href="${escHtml(item.link_url)}" target="_blank" rel="noopener" title="Open link">🔗</a>` : ''}${item.confirmation_number ? `<br><span class="field-hint">Conf# ${escHtml(item.confirmation_number)}</span>` : ''}</td>
              <td>${item.starts_at ? formatDateTime(item.starts_at) : '—'}</td>
              <td>${item.ends_at ? formatDateTime(item.ends_at) : '—'}</td>
              <td>${item.cost != null ? formatCurrency(item.cost) : '—'}</td>
              <td>
                ${isLogistics ? `
                  <select class="attendance-status-select" onchange="updateItineraryItemField('${item.id}', 'status', this.value)">
                    <option value="planned" ${item.status === 'planned' ? 'selected' : ''}>Planned</option>
                    <option value="booked" ${item.status === 'booked' ? 'selected' : ''}>Booked</option>
                    <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                  </select>
                ` : '—'}
              </td>
              <td>${item.income_amount != null ? formatCurrency(item.income_amount) : '—'}${item.income_source ? `<br><span class="field-hint">${escHtml(item.income_source)}</span>` : ''}</td>
              <td>
                <button class="btn-sm btn-sm-ghost" onclick="editItineraryItem('${item.id}')">Edit</button>
                <button class="btn-sm btn-sm-ghost" onclick="openDocumentsForItineraryItem('${item.id}')">Docs${docCount ? ' (' + docCount + ')' : ''}</button>
                <button class="btn-sm btn-sm-danger" onclick="deleteItineraryItem('${item.id}')">Delete</button>
              </td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function resetItineraryForm() {
  ['itineraryItemTitle', 'itineraryItemStartDate', 'itineraryItemStartTime', 'itineraryItemEndDate', 'itineraryItemEndTime',
   'itineraryItemLocation', 'itineraryItemProvider', 'itineraryItemConfirmation', 'itineraryItemCost', 'itineraryItemIncome', 'itineraryItemIncomeSource', 'itineraryItemLink', 'itineraryItemNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('itineraryItemType').value = 'other';
  document.getElementById('itineraryItemStatus').value = 'planned';
  document.getElementById('itineraryItemCompany').value = '';
  document.getElementById('itineraryItemInvoice').value = '';
  document.getElementById('itineraryAddressFields').style.display = 'none';
  ['itineraryAddrStreet', 'itineraryAddrCity', 'itineraryAddrRegion', 'itineraryAddrPostal', 'itineraryAddrCountry'].forEach(id => {
    document.getElementById(id).value = '';
  });
  updateItineraryFormFieldsForType();
}

function showAddItineraryItem() {
  editingItineraryItemId = null;
  resetItineraryForm();
  document.getElementById('addItineraryItemCardTitle').textContent = 'Add Itinerary Item';
  document.getElementById('itineraryItemSubmitBtn').textContent = 'Add Itinerary Item →';
  document.getElementById('addItineraryItemCard').style.display = 'block';
  document.getElementById('showAddItineraryItemBtn').style.display = 'none';
}
function hideAddItineraryItem() {
  document.getElementById('addItineraryItemCard').style.display = 'none';
  document.getElementById('showAddItineraryItemBtn').style.display = 'inline-block';
}

function editItineraryItem(itemId) {
  const item = currentItineraryItems.find(i => i.id === itemId);
  if (!item) return;

  editingItineraryItemId = itemId;
  document.getElementById('itineraryItemType').value = item.item_type || 'other';
  document.getElementById('itineraryItemTitle').value = item.title || '';
  document.getElementById('itineraryItemStartDate').value = item.starts_at ? toDateInputValue(new Date(item.starts_at)) : '';
  document.getElementById('itineraryItemStartTime').value = item.starts_at ? toTimeInputValue(new Date(item.starts_at)) : '';
  document.getElementById('itineraryItemEndDate').value = item.ends_at ? toDateInputValue(new Date(item.ends_at)) : '';
  document.getElementById('itineraryItemEndTime').value = item.ends_at ? toTimeInputValue(new Date(item.ends_at)) : '';
  document.getElementById('itineraryItemLocation').value = item.location || '';
  document.getElementById('itineraryItemProvider').value = item.provider || '';
  document.getElementById('itineraryItemConfirmation').value = item.confirmation_number || '';
  document.getElementById('itineraryItemCost').value = item.cost != null ? item.cost : '';
  document.getElementById('itineraryItemStatus').value = item.status || 'planned';
  document.getElementById('itineraryItemCompany').value = item.company_id || '';
  document.getElementById('itineraryItemIncome').value = item.income_amount != null ? item.income_amount : '';
  document.getElementById('itineraryItemIncomeSource').value = item.income_source || '';
  document.getElementById('itineraryItemInvoice').value = item.invoice_id || '';
  document.getElementById('itineraryItemLink').value = item.link_url || '';
  document.getElementById('itineraryItemNotes').value = item.notes || '';
  document.getElementById('itineraryAddressFields').style.display = 'none';

  updateItineraryFormFieldsForType();

  document.getElementById('addItineraryItemCardTitle').textContent = 'Edit Itinerary Item';
  document.getElementById('itineraryItemSubmitBtn').textContent = 'Save Changes →';
  document.getElementById('addItineraryItemCard').style.display = 'block';
  document.getElementById('showAddItineraryItemBtn').style.display = 'none';
}

async function saveItineraryItem() {
  const title = document.getElementById('itineraryItemTitle').value.trim();
  if (!title) { alert('Title is required.'); return; }

  const startDate = document.getElementById('itineraryItemStartDate').value;
  const startTime = document.getElementById('itineraryItemStartTime').value;
  const endDate = document.getElementById('itineraryItemEndDate').value;
  const endTime = document.getElementById('itineraryItemEndTime').value;
  const cost = document.getElementById('itineraryItemCost').value;
  const income = document.getElementById('itineraryItemIncome').value;

  const payload = {
    item_type: document.getElementById('itineraryItemType').value,
    title,
    starts_at: startDate ? (buildScheduledAt(startDate, startTime) || new Date(`${startDate}T00:00:00`).toISOString()) : null,
    ends_at: endDate ? (buildScheduledAt(endDate, endTime) || new Date(`${endDate}T00:00:00`).toISOString()) : null,
    location: document.getElementById('itineraryItemLocation').value.trim() || null,
    provider: document.getElementById('itineraryItemProvider').value.trim() || null,
    confirmation_number: document.getElementById('itineraryItemConfirmation').value.trim() || null,
    cost: cost ? parseFloat(cost) : null,
    status: document.getElementById('itineraryItemStatus').value,
    company_id: document.getElementById('itineraryItemCompany').value || null,
    income_amount: income ? parseFloat(income) : null,
    income_source: document.getElementById('itineraryItemIncomeSource').value.trim() || null,
    invoice_id: document.getElementById('itineraryItemInvoice').value || null,
    link_url: document.getElementById('itineraryItemLink').value.trim() || null,
    notes: document.getElementById('itineraryItemNotes').value.trim() || null
  };

  const { error } = editingItineraryItemId
    ? await ggClient.from('event_itinerary_items').update(payload).eq('id', editingItineraryItemId)
    : await ggClient.from('event_itinerary_items').insert({ ...payload, event_id: currentEventId });
  if (error) { alert('Could not save itinerary item: ' + error.message); return; }

  editingItineraryItemId = null;
  hideAddItineraryItem();
  loadEventDetail();
}

async function updateItineraryItemField(itemId, field, value) {
  const { error } = await ggClient.from('event_itinerary_items').update({ [field]: value }).eq('id', itemId);
  if (error) { alert('Could not save: ' + error.message); }
  loadEventDetail();
}

async function deleteItineraryItem(itemId) {
  if (!confirm('Delete this itinerary item?')) return;
  const { error } = await ggClient.from('event_itinerary_items').delete().eq('id', itemId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  loadEventDetail();
}

// ── SPENDING TAB ──────────────────────────────────────────────
function renderEventSpendingTab(event, expenses, itineraryItems) {
  const bookedItems = (itineraryItems || []).filter(item => item.status === 'booked' && item.cost != null && parseFloat(item.cost) > 0);
  const bookedTotal = bookedItems.reduce((sum, item) => sum + parseFloat(item.cost), 0);
  const totalSpend = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) + bookedTotal;
  const totalIncome = (itineraryItems || []).reduce((sum, item) => sum + (parseFloat(item.income_amount) || 0), 0);
  const budget = event.budget_amount != null ? parseFloat(event.budget_amount) : null;

  let statsHtml = `
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(totalIncome)}</div>
      <div class="stat-label">Income</div>
    </div>
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
  if (!expenses.length && !bookedItems.length) {
    container.innerHTML = '<p class="empty-hint">No expenses logged yet.</p>';
    return;
  }

  const expenseRowsHtml = expenses.map(exp => `
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
      <td>
        <button class="btn-sm btn-sm-ghost" onclick="openDocumentsForExpense('${exp.id}')">Docs</button>
        <button class="btn-sm btn-sm-danger" onclick="deleteExpense('${exp.id}')">Delete</button>
      </td>
    </tr>
  `).join('');

  const bookedRowsHtml = bookedItems.map(item => `
    <tr>
      <td>${escHtml(ITINERARY_ITEM_TYPE_LABELS[item.item_type] || item.item_type)} (Booked)</td>
      <td>${escHtml(item.title)} <span class="field-hint">via Itinerary</span></td>
      <td>${item.starts_at ? formatDateTime(item.starts_at) : '—'}</td>
      <td>${formatCurrency(item.cost)}</td>
      <td>Booked</td>
      <td class="field-hint">Edit on Itinerary</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead>
          <tr><th>Category</th><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          ${expenseRowsHtml}${bookedRowsHtml}
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

  const { data, error } = await ggClient.from('event_expenses').insert(payload).select().single();
  if (error) { alert('Could not add expense: ' + error.message); return; }

  const fileInput = document.getElementById('expenseDocFile');
  const file = fileInput.files[0];
  if (file) {
    const path = `${currentEventId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await ggClient.storage.from('event-documents').upload(path, file);
    if (upErr) {
      alert('Expense was saved, but the document upload failed: ' + upErr.message);
    } else {
      const { error: docErr } = await ggClient.from('event_documents').insert({
        event_id: currentEventId, expense_id: data.id, file_name: file.name, storage_path: path, file_size: file.size
      });
      if (docErr) alert('Expense was saved, but the document record failed to save: ' + docErr.message);
    }
  }

  document.getElementById('expenseDescription').value = '';
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseIncurredOn').value = '';
  document.getElementById('expenseCategory').value = 'other';
  document.getElementById('expenseStatus').value = 'planned';
  fileInput.value = '';

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

// ── DOCUMENTS TAB ─────────────────────────────────────────────
function populateEventDocLinkOptions(itineraryItems, expenses) {
  const select = document.getElementById('eventDocLinkTo');
  const value = select.value;
  const itinOptions = (itineraryItems || []).map(item => `<option value="i:${item.id}">🧭 ${escHtml(item.title)}</option>`).join('');
  const expenseOptions = (expenses || []).map(e => `<option value="e:${e.id}">💵 ${escHtml(e.description)}</option>`).join('');
  select.innerHTML = `<option value="">— General (not linked) —</option>${itinOptions}${expenseOptions}`;
  select.value = value;
}

function openDocumentsForItineraryItem(itineraryItemId) {
  switchEventTab('documents');
  document.getElementById('eventDocLinkTo').value = 'i:' + itineraryItemId;
}

function openDocumentsForExpense(expenseId) {
  switchEventTab('documents');
  document.getElementById('eventDocLinkTo').value = 'e:' + expenseId;
}

function renderEventDocumentsTab(documents, itineraryItems, expenses) {
  const container = document.getElementById('eventDocumentsList');
  if (!documents.length) {
    container.innerHTML = '<p class="empty-hint">No documents uploaded yet.</p>';
    return;
  }

  const itinById = Object.fromEntries((itineraryItems || []).map(item => [item.id, item.title]));
  const expenseById = Object.fromEntries((expenses || []).map(e => [e.id, e.description]));

  container.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead>
          <tr><th>File</th><th>Size</th><th>Uploaded</th><th>Linked To</th><th>Notes</th><th></th></tr>
        </thead>
        <tbody>
          ${documents.map(doc => {
            const linkedLabel = doc.itinerary_item_id ? ('🧭 ' + escHtml(itinById[doc.itinerary_item_id] || 'Itinerary item'))
              : doc.expense_id ? ('💵 ' + escHtml(expenseById[doc.expense_id] || 'Expense'))
              : 'General';
            return `
            <tr>
              <td>${escHtml(doc.file_name)}</td>
              <td>${formatFileSize(doc.file_size)}</td>
              <td>${escHtml((doc.created_at || '').slice(0, 10))}</td>
              <td>${linkedLabel}</td>
              <td>${escHtml(doc.notes || '—')}</td>
              <td>
                <button class="btn-sm btn-sm-ghost" onclick="viewEventDocument('${escHtml(doc.storage_path)}')">View</button>
                <button class="btn-sm btn-sm-danger" onclick="deleteEventDocument('${doc.id}', '${escHtml(doc.storage_path)}')">Delete</button>
              </td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function uploadEventDocument() {
  const fileInput = document.getElementById('eventDocFile');
  const file = fileInput.files[0];
  if (!file) { alert('Choose a file first.'); return; }

  const linkValue = document.getElementById('eventDocLinkTo').value;
  const notes = document.getElementById('eventDocNotes').value.trim() || null;
  const itineraryItemId = linkValue.startsWith('i:') ? linkValue.slice(2) : null;
  const expenseId = linkValue.startsWith('e:') ? linkValue.slice(2) : null;

  const path = `${currentEventId}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await ggClient.storage.from('event-documents').upload(path, file);
  if (upErr) { alert('Upload failed: ' + upErr.message); return; }

  const { error: insErr } = await ggClient.from('event_documents').insert({
    event_id: currentEventId,
    itinerary_item_id: itineraryItemId,
    expense_id: expenseId,
    file_name: file.name,
    storage_path: path,
    file_size: file.size,
    notes
  });
  if (insErr) { alert('Could not save document record: ' + insErr.message); return; }

  document.getElementById('eventDocFile').value = '';
  document.getElementById('eventDocNotes').value = '';
  document.getElementById('eventDocLinkTo').value = '';
  loadEventDetail();
}

async function viewEventDocument(path) {
  const { data, error } = await ggClient.storage.from('event-documents').createSignedUrl(path, 300);
  if (error || !data) { alert('Could not open file: ' + (error ? error.message : 'unknown error')); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

async function deleteEventDocument(id, path) {
  if (!confirm('Delete this document? This cannot be undone.')) return;
  await ggClient.storage.from('event-documents').remove([path]);
  const { error } = await ggClient.from('event_documents').delete().eq('id', id);
  if (error) { alert('Could not delete: ' + error.message); return; }
  loadEventDetail();
}

// ── UTILS ─────────────────────────────────────────────────────
function toDateInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function toTimeInputValue(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
