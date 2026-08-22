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
  loadDashboardView();
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

  const viewsWithWorkshopBar = ['overview', 'responses', 'registrants', 'survey-builder'];
  document.getElementById('workshopTopBar').style.display = viewsWithWorkshopBar.includes(viewName) ? 'flex' : 'none';

  const parentGroup = btn.closest('.nav-group');
  if (parentGroup) {
    parentGroup.classList.add('expanded');
    parentGroup.querySelector('.nav-group-toggle').classList.add('active');
  }

  if (viewName === 'survey-builder') loadSurveyBuilder();
  if (viewName === 'registrants') loadRegistrants();
  if (viewName === 'clients') loadCompanies();
  if (viewName === 'address-book') loadAddressBook();
  if (viewName === 'calendar') autoCompletePastConfirmedEvents().then(loadCalendarMonth);
  if (viewName === 'events') loadEventsListTable();
  if (viewName === 'tasks') loadTaskList();
  if (viewName === 'quotes') loadQuoteToolFrame();
  if (viewName === 'dashboard') loadDashboardView();
  if (viewName === 'financial-overview') loadFinancialOverview();
  if (viewName === 'expenses') loadExpenses();
  if (viewName === 'income') loadIncomeView();
}

// ── DASHBOARD ─────────────────────────────────────────────────
function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatEventWhen(ev) {
  const d = new Date(ev.starts_at);
  if (isNaN(d.getTime())) return '';
  const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (ev.all_day) return dateLabel;
  return `${dateLabel} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

async function loadDashboardView() {
  const statsEl = document.getElementById('dashboardStats');
  const eventsEl = document.getElementById('dashboardUpcomingEvents');
  if (!statsEl || !eventsEl) return;

  const [{ data: invoices }, { data: events }] = await Promise.all([
    ggClient.from('documents').select('id,doc_number,client_name,status,total,balance,doc_date,due_date,date_paid').eq('doc_type', 'invoice'),
    ggClient.from('events').select('id,title,event_type,starts_at,all_day,location')
      .gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(8)
  ]);

  renderDashboardStats(invoices || []);
  renderDashboardEvents(events || []);
  loadTaskList();
}

function renderDashboardStats(invoices, targetId) {
  const statsEl = document.getElementById(targetId || 'dashboardStats');
  if (!statsEl) return;
  const todayStr = todayIsoDate();
  const in7Str = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const monthStartStr = todayStr.slice(0, 7) + '-01';

  const open = { count: 0, sum: 0 };
  const pastDue = { count: 0, sum: 0 };
  const dueSoon = { count: 0, sum: 0 };
  const paidThisMonth = { count: 0, sum: 0 };

  invoices.forEach(inv => {
    const balance = Number(inv.balance) || 0;
    if (inv.status === 'paid') {
      // date_paid is only populated going forward — older paid invoices
      // fall back to doc_date so they still show up somewhere sensible.
      const paidStr = inv.date_paid || inv.doc_date;
      const paidDate = paidStr ? new Date(paidStr) : null;
      if (paidDate && !isNaN(paidDate.getTime())) {
        const paidIso = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}-${String(paidDate.getDate()).padStart(2, '0')}`;
        if (paidIso >= monthStartStr) {
          paidThisMonth.count++;
          paidThisMonth.sum += Number(inv.total) || 0;
        }
      }
      return;
    }
    open.count++;
    open.sum += balance;
    if (inv.due_date && inv.due_date < todayStr) {
      pastDue.count++;
      pastDue.sum += balance;
    } else if (inv.due_date && inv.due_date >= todayStr && inv.due_date <= in7Str) {
      dueSoon.count++;
      dueSoon.sum += balance;
    }
  });

  const cards = [
    { label: 'Open Invoices', ...open, sub: 'outstanding', accent: '', link: "openFinancialList('invoice')" },
    { label: 'Past Due', ...pastDue, sub: 'overdue', accent: pastDue.count ? 'accent-danger' : '', link: "openFinancialList('invoice', null, 'past_due')" },
    { label: 'Due Within 7 Days', ...dueSoon, sub: 'coming due', accent: '', link: "openFinancialList('invoice')" },
    { label: 'Paid This Month', ...paidThisMonth, sub: 'received', accent: 'accent', link: "openFinancialList('invoice', null, 'paid')" }
  ];

  statsEl.innerHTML = cards.map(c => `
    <div class="stat-card ${c.accent} clickable" onclick="${c.link}">
      <div class="stat-value">${formatCurrency(c.sum)}</div>
      <div class="stat-label">${escHtml(c.label)}</div>
      <div class="stat-sub">${c.count} ${escHtml(c.sub)}</div>
    </div>
  `).join('');
}

function renderDashboardEvents(events) {
  const eventsEl = document.getElementById('dashboardUpcomingEvents');
  if (!events.length) {
    eventsEl.innerHTML = '<p class="empty-hint">Nothing on the calendar yet.</p>';
    return;
  }
  eventsEl.innerHTML = events.map(ev => `
    <div class="dashboard-event-row" onclick="showEventDetail('${ev.id}')">
      <div class="dashboard-event-main">
        <div class="dashboard-event-title">${escHtml(ev.title)}</div>
        <div class="dashboard-event-meta">${formatEventWhen(ev)}${ev.location ? ' · ' + escHtml(ev.location) : ''}</div>
      </div>
      <span class="calendar-event-chip event-type-${escHtml(ev.event_type || 'other')}">${escHtml(EVENT_TYPE_LABELS[ev.event_type] || 'Other')}</span>
    </div>
  `).join('');
}

// ── QUOTE / INVOICE / RECEIPT TOOL (embedded) ──────────────────
function loadQuoteToolFrame() {
  const frame = document.getElementById('quoteToolFrame');
  if (frame.src === 'about:blank' || !frame.src) frame.src = frame.dataset.src;
}

function openQuoteDocument(docId) {
  setView('quotes', document.querySelector('[data-view="quotes"]'));
  const frame = document.getElementById('quoteToolFrame');
  frame.src = '../quote-tool/index.html?doc=' + encodeURIComponent(docId);
}

function openFinancialList(type, btn, status) {
  setView('quotes', btn || document.getElementById('financialNavToggle'));
  const frame = document.getElementById('quoteToolFrame');
  let src = '../quote-tool/index.html?view=list&type=' + encodeURIComponent(type);
  if (status) src += '&status=' + encodeURIComponent(status);
  frame.src = src;
}

let financialAllDocs = [];
let financialDocsFilter = { search: '', type: 'all', status: 'all' };

async function loadFinancialOverview() {
  const statsEl = document.getElementById('financialOverviewStats');
  if (!statsEl) return;
  const { data } = await ggClient.from('documents')
    .select('id,doc_type,doc_number,client_name,status,total,balance,doc_date,due_date,date_paid,company_id')
    .order('created_at', { ascending: false });
  financialAllDocs = data || [];
  renderDashboardStats(financialAllDocs.filter(d => d.doc_type === 'invoice'), 'financialOverviewStats');
  renderFinancialDocsTable();
  loadFinancialExpenseStats();
}

async function loadFinancialExpenseStats() {
  const statsEl = document.getElementById('financialExpenseStats');
  if (!statsEl) return;

  const { data, error } = await ggClient.from('expenses').select('amount, incurred_on');
  if (error) { statsEl.innerHTML = ''; return; }

  const todayStr = todayIsoDate();
  const monthStartStr = todayStr.slice(0, 7) + '-01';
  const yearStartStr = todayStr.slice(0, 4) + '-01-01';

  let mtd = 0, ytd = 0;
  (data || []).forEach(exp => {
    const amount = Number(exp.amount) || 0;
    const incurredOn = exp.incurred_on || '';
    if (incurredOn >= yearStartStr) ytd += amount;
    if (incurredOn >= monthStartStr) mtd += amount;
  });

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(mtd)}</div>
      <div class="stat-label">Expenses (MTD)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(ytd)}</div>
      <div class="stat-label">Expenses (YTD)</div>
    </div>
  `;
}

// ── EXPENSE TRACKER (general business expenses) ─────────────────
const GENERAL_EXPENSE_CATEGORY_LABELS = {
  software: 'Software', office: 'Office Supplies', marketing: 'Marketing', insurance: 'Insurance',
  professional_services: 'Professional Services', travel: 'Travel', meals: 'Meals', equipment: 'Equipment', other: 'Other'
};
let allExpensesCache = [];

async function loadExpenses() {
  const tbody = document.getElementById('expensesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

  const { data, error } = await ggClient.from('expenses').select('*').order('incurred_on', { ascending: false });
  if (error) { tbody.innerHTML = `<tr><td colspan="6">Error: ${escHtml(error.message)}</td></tr>`; return; }

  allExpensesCache = data || [];
  renderExpensesTable();
}

function renderExpensesTable() {
  const tbody = document.getElementById('expensesTableBody');
  if (!tbody) return;
  if (!allExpensesCache.length) { tbody.innerHTML = '<tr><td colspan="6">No expenses logged yet.</td></tr>'; return; }

  tbody.innerHTML = allExpensesCache.map(exp => `
    <tr>
      <td>${escHtml(GENERAL_EXPENSE_CATEGORY_LABELS[exp.category] || exp.category)}</td>
      <td>${escHtml(exp.description)}</td>
      <td>${exp.incurred_on ? formatDate(exp.incurred_on) : '—'}</td>
      <td>${formatCurrency(exp.amount)}</td>
      <td>${escHtml(exp.notes || '—')}</td>
      <td><button class="btn-sm btn-sm-danger" onclick="deleteGeneralExpense('${exp.id}')">Delete</button></td>
    </tr>
  `).join('');
}

function showCreateExpense() {
  document.getElementById('createExpenseCard').style.display = 'block';
}
function hideCreateExpense() {
  document.getElementById('createExpenseCard').style.display = 'none';
}

async function createExpense() {
  const description = document.getElementById('expNewDescription').value.trim();
  const amount = document.getElementById('expNewAmount').value;
  if (!description || !amount) { alert('Description and amount are required.'); return; }

  const payload = {
    category: document.getElementById('expNewCategory').value,
    description,
    amount: parseFloat(amount),
    incurred_on: document.getElementById('expNewDate').value || todayIsoDate(),
    notes: document.getElementById('expNewNotes').value.trim() || null
  };

  const { error } = await ggClient.from('expenses').insert(payload);
  if (error) { alert('Could not add expense: ' + error.message); return; }

  document.getElementById('expNewDescription').value = '';
  document.getElementById('expNewAmount').value = '';
  document.getElementById('expNewDate').value = '';
  document.getElementById('expNewNotes').value = '';
  document.getElementById('expNewCategory').value = 'other';

  hideCreateExpense();
  loadExpenses();
  loadFinancialExpenseStats();
}

async function deleteGeneralExpense(expenseId) {
  if (!confirm('Delete this expense?')) return;
  const { error } = await ggClient.from('expenses').delete().eq('id', expenseId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  loadExpenses();
  loadFinancialExpenseStats();
}

// ── INCOME (open invoices + event/itinerary income + manual log) ────
const INCOME_CATEGORY_LABELS = {
  speaking: 'Speaking', training: 'Training', retainer: 'Retainer', grant: 'Grant', consulting: 'Consulting', other: 'Other'
};
let allIncomeCache = [];       // manual `income` table rows only
let allIncomeRollupItems = []; // normalized items from every source, for the combined table/stats

function capWords(str) {
  return (str || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function loadIncomeView() {
  const tbody = document.getElementById('incomeTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

  const [{ data: invoices }, { data: events }, { data: itineraryItems }, { data: manual, error }] = await Promise.all([
    ggClient.from('documents').select('id, doc_number, client_name, status, balance, due_date').eq('doc_type', 'invoice').gt('balance', 0),
    ggClient.from('events').select('id, title, status, starts_at, income_amount').not('income_amount', 'is', null),
    ggClient.from('event_itinerary_items').select('id, title, income_amount, income_source, starts_at, event_id, events!event_id(title, status)').not('income_amount', 'is', null),
    ggClient.from('income').select('*').order('expected_on', { ascending: true })
  ]);

  if (error) { tbody.innerHTML = `<tr><td colspan="6">Error: ${escHtml(error.message)}</td></tr>`; return; }

  allIncomeCache = manual || [];

  const items = [];

  (invoices || []).forEach(inv => {
    items.push({
      source: 'invoice',
      sourceLabel: 'Invoice',
      description: inv.doc_number ? `${inv.doc_number} — ${inv.client_name || 'Unnamed client'}` : (inv.client_name || 'Unnamed client'),
      expectedOn: inv.due_date || null,
      amount: Number(inv.balance) || 0,
      status: 'expected',
      statusLabel: capWords(inv.status),
      onClick: `openQuoteDocument('${inv.id}')`
    });
  });

  (events || []).forEach(ev => {
    if (ev.status === 'cancelled') return;
    items.push({
      source: 'event',
      sourceLabel: 'Event',
      description: ev.title,
      expectedOn: ev.starts_at ? ev.starts_at.slice(0, 10) : null,
      amount: Number(ev.income_amount) || 0,
      status: 'expected',
      statusLabel: 'Expected',
      onClick: `showEventDetail('${ev.id}')`
    });
  });

  (itineraryItems || []).forEach(item => {
    if (item.events?.status === 'cancelled') return;
    items.push({
      source: 'event',
      sourceLabel: 'Itinerary',
      description: item.income_source ? `${item.title} — ${item.income_source}` : item.title,
      expectedOn: item.starts_at ? item.starts_at.slice(0, 10) : null,
      amount: Number(item.income_amount) || 0,
      status: 'expected',
      statusLabel: 'Expected',
      onClick: `showEventDetail('${item.event_id}')`
    });
  });

  allIncomeCache.forEach(inc => {
    items.push({
      id: inc.id,
      source: 'manual',
      sourceLabel: INCOME_CATEGORY_LABELS[inc.category] || 'Other',
      description: inc.description,
      expectedOn: inc.expected_on,
      amount: Number(inc.amount) || 0,
      status: inc.status,
      statusLabel: inc.status === 'received' ? 'Received' : 'Expected',
      manual: true
    });
  });

  items.sort((a, b) => (a.expectedOn || '9999-99-99') < (b.expectedOn || '9999-99-99') ? -1 : 1);

  allIncomeRollupItems = items;
  renderIncomeStats();
  renderIncomeTable();
}

function renderIncomeStats() {
  const statsEl = document.getElementById('incomeStats');
  if (!statsEl) return;

  const items = allIncomeRollupItems;
  const totalExpected = items.filter(it => it.status !== 'received').reduce((sum, it) => sum + it.amount, 0);
  const fromInvoices = items.filter(it => it.source === 'invoice').reduce((sum, it) => sum + it.amount, 0);
  const fromEvents = items.filter(it => it.source === 'event').reduce((sum, it) => sum + it.amount, 0);
  const manualExpected = items.filter(it => it.source === 'manual' && it.status !== 'received').reduce((sum, it) => sum + it.amount, 0);

  statsEl.innerHTML = `
    <div class="stat-card accent">
      <div class="stat-value">${formatCurrency(totalExpected)}</div>
      <div class="stat-label">Total Expected Income</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(fromInvoices)}</div>
      <div class="stat-label">From Open Invoices</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(fromEvents)}</div>
      <div class="stat-label">From Events &amp; Itinerary</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(manualExpected)}</div>
      <div class="stat-label">Manually Logged</div>
    </div>
  `;
}

function renderIncomeTable() {
  const tbody = document.getElementById('incomeTableBody');
  if (!tbody) return;

  const sourceFilter = document.getElementById('incomeSourceFilter').value;
  const showReceived = document.getElementById('incomeShowReceived').checked;

  let items = allIncomeRollupItems;
  if (sourceFilter !== 'all') items = items.filter(it => it.source === sourceFilter);
  if (!showReceived) items = items.filter(it => it.status !== 'received');

  if (!items.length) { tbody.innerHTML = '<tr><td colspan="6">No expected income to show.</td></tr>'; return; }

  tbody.innerHTML = items.map(it => `
    <tr>
      <td>${escHtml(it.sourceLabel)}</td>
      <td>${escHtml(it.description || '—')}</td>
      <td>${it.expectedOn ? formatDate(it.expectedOn) : '—'}</td>
      <td>${formatCurrency(it.amount)}</td>
      <td>${escHtml(it.statusLabel)}</td>
      <td>
        ${it.manual
          ? `<button class="btn-sm btn-sm-ghost" onclick="toggleIncomeStatus('${it.id}', '${it.status}')">${it.status === 'received' ? 'Mark Expected' : 'Mark Received'}</button>
             <button class="btn-sm btn-sm-danger" onclick="deleteIncome('${it.id}')">Delete</button>`
          : (it.onClick ? `<button class="btn-sm btn-sm-ghost" onclick="${it.onClick}">View</button>` : '')}
      </td>
    </tr>
  `).join('');
}

function showCreateIncome() {
  document.getElementById('createIncomeCard').style.display = 'block';
}
function hideCreateIncome() {
  document.getElementById('createIncomeCard').style.display = 'none';
}

async function createIncome() {
  const description = document.getElementById('incNewDescription').value.trim();
  const amount = document.getElementById('incNewAmount').value;
  if (!description || !amount) { alert('Description and amount are required.'); return; }

  const payload = {
    category: document.getElementById('incNewCategory').value,
    description,
    amount: parseFloat(amount),
    expected_on: document.getElementById('incNewDate').value || todayIsoDate(),
    notes: document.getElementById('incNewNotes').value.trim() || null
  };

  const { error } = await ggClient.from('income').insert(payload);
  if (error) { alert('Could not add income: ' + error.message); return; }

  document.getElementById('incNewDescription').value = '';
  document.getElementById('incNewAmount').value = '';
  document.getElementById('incNewDate').value = '';
  document.getElementById('incNewNotes').value = '';
  document.getElementById('incNewCategory').value = 'other';

  hideCreateIncome();
  loadIncomeView();
}

async function toggleIncomeStatus(incomeId, currentStatus) {
  const newStatus = currentStatus === 'received' ? 'expected' : 'received';
  const { error } = await ggClient.from('income').update({ status: newStatus }).eq('id', incomeId);
  if (error) { alert('Could not update: ' + error.message); return; }
  loadIncomeView();
}

async function deleteIncome(incomeId) {
  if (!confirm('Delete this income entry?')) return;
  const { error } = await ggClient.from('income').delete().eq('id', incomeId);
  if (error) { alert('Could not delete: ' + error.message); return; }
  loadIncomeView();
}

function financialDocsSearchInput(value) {
  financialDocsFilter.search = value;
  renderFinancialDocsTable();
}
function setFinancialDocsFilter(field, value) {
  financialDocsFilter[field] = value;
  renderFinancialDocsTable();
}

function renderFinancialDocsTable() {
  const tbody = document.getElementById('financialDocsTableBody');
  if (!tbody) return;
  const todayStr = todayIsoDate();
  const q = financialDocsFilter.search.trim().toLowerCase();

  const filtered = financialAllDocs.filter(d => {
    if (financialDocsFilter.type !== 'all' && d.doc_type !== financialDocsFilter.type) return false;
    if (financialDocsFilter.status === 'past_due') {
      if (!(d.due_date && d.due_date < todayStr && d.status !== 'paid')) return false;
    } else if (financialDocsFilter.status !== 'all' && d.status !== financialDocsFilter.status) {
      return false;
    }
    if (q && !((d.doc_number || '').toLowerCase().includes(q) || (d.client_name || '').toLowerCase().includes(q))) return false;
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6">No documents match.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(d => {
    const pastDue = d.due_date && d.due_date < todayStr && d.status !== 'paid';
    const dateLabel = d.doc_type === 'invoice' && d.due_date ? d.due_date : (d.doc_date || '—');
    return `
      <tr class="client-list-row" onclick="openQuoteDocument('${escHtml(d.id)}')">
        <td>${escHtml(d.doc_number)}</td>
        <td>${escHtml(d.doc_type)}</td>
        <td>${escHtml(d.client_name || '—')}</td>
        <td><span class="reg-card-status-badge">${escHtml(pastDue ? 'Past Due' : d.status)}</span></td>
        <td>${formatCurrency(d.total)}</td>
        <td>${escHtml(dateLabel)}</td>
      </tr>
    `;
  }).join('');
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
  } else if (event.target === document.getElementById('eventDetailModal')) {
    hideEventDetail();
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount || 0);
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
                <td>${membership ? (membership.max_seats === null ? 'Unlimited' : `${activeCount} / ${membership.max_seats}`) : '—'}</td>
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

async function showCreateCompany() {
  document.getElementById('createCompanyCard').style.display = 'block';
  await loadAllCompaniesForSelect();
  const container = document.getElementById('newCompanyContacts');
  container.innerHTML = '';
  Object.keys(contactPhonesState).forEach(k => { if (k.startsWith('nc-')) delete contactPhonesState[k]; });
  newCompanyContactRowCounter = 0;
  addNewCompanyContactRow();
}
function hideCreateCompany() {
  document.getElementById('createCompanyCard').style.display = 'none';
}

let allCompaniesForSelect = [];
async function loadAllCompaniesForSelect() {
  const { data } = await ggClient.from('companies').select('id, name').order('name', { ascending: true });
  allCompaniesForSelect = data || [];
}

let newCompanyContactRowCounter = 0;

function newCompanyContactRowTpl(rowKey) {
  const companyOptions = allCompaniesForSelect.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
  return `
    <div class="contact-row" data-contact-key="${rowKey}">
      <button type="button" class="contact-row-remove" title="Remove contact" onclick="removeNewCompanyContactRow(this, '${rowKey}')">&times;</button>
      <div class="fields-grid">
        <div class="field-group half">
          <label class="field-label">Full Name</label>
          <input type="text" class="field-input" data-field="name" placeholder="Jane Smith" />
        </div>
        <div class="field-group half">
          <label class="field-label">Company</label>
          <select class="field-input" data-field="company">
            <option value="">— This Client —</option>
            ${companyOptions}
          </select>
        </div>
        <div class="field-group half">
          <label class="field-label">Email</label>
          <input type="email" class="field-input" data-field="email" placeholder="jane@acme.com" />
        </div>
        <div class="field-group half">
          <label class="field-label">Title</label>
          <input type="text" class="field-input" data-field="title" placeholder="Safety Manager" />
        </div>
        <div class="field-group full">
          <label class="field-label">Phone Numbers</label>
          <div id="phoneRows_${rowKey}">${renderPhoneRowsFor(rowKey)}</div>
          <button type="button" class="btn-sm btn-sm-ghost" onclick="addContactPhoneRow('${rowKey}')">+ Add Phone Number</button>
        </div>
        <div class="field-group full">
          <label class="field-label">Notes</label>
          <textarea class="field-input" rows="2" data-field="notes"></textarea>
        </div>
      </div>
    </div>`;
}

function addNewCompanyContactRow() {
  const container = document.getElementById('newCompanyContacts');
  const rowKey = 'nc-' + (++newCompanyContactRowCounter);
  container.insertAdjacentHTML('beforeend', newCompanyContactRowTpl(rowKey));
  updateNewCompanyContactRowChrome();
}

function removeNewCompanyContactRow(btn, rowKey) {
  const rows = document.querySelectorAll('#newCompanyContacts .contact-row');
  if (rows.length <= 1) return;
  btn.closest('.contact-row').remove();
  delete contactPhonesState[rowKey];
  updateNewCompanyContactRowChrome();
}

function updateNewCompanyContactRowChrome() {
  const rows = document.querySelectorAll('#newCompanyContacts .contact-row');
  rows.forEach(row => {
    const removeBtn = row.querySelector('.contact-row-remove');
    if (removeBtn) removeBtn.style.display = rows.length > 1 ? '' : 'none';
  });
}

function readNewCompanyContactRows() {
  return Array.from(document.querySelectorAll('#newCompanyContacts .contact-row')).map(row => {
    const rowKey = row.dataset.contactKey;
    const phones = (contactPhonesState[rowKey] || []).filter(p => p.number && p.number.trim());
    return {
      name: row.querySelector('[data-field="name"]').value.trim(),
      companyId: row.querySelector('[data-field="company"]').value || null,
      email: row.querySelector('[data-field="email"]').value.trim() || null,
      phones,
      title: row.querySelector('[data-field="title"]').value.trim() || null,
      notes: row.querySelector('[data-field="notes"]').value.trim() || null
    };
  }).filter(c => c.name || c.email || c.phones.length || c.title || c.notes);
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

  const rawContacts = readNewCompanyContactRows();
  for (const c of rawContacts) {
    if (!c.name && (c.email || c.phones.length || c.title || c.notes)) {
      alert('Each contact needs a full name.');
      return;
    }
  }
  const contacts = rawContacts.filter(c => c.name);
  // The primary contact is the first row still linked to the client being
  // created (blank Company select) — a row explicitly linked to a
  // different, existing company is just filed there instead.
  const primaryIndex = contacts.findIndex(c => !c.companyId);
  const primary = primaryIndex > -1 ? contacts[primaryIndex] : null;
  const others = contacts.filter((_, i) => i !== primaryIndex);

  const { data: co, error } = await ggClient
    .from('companies')
    .insert({
      name,
      contact_name: primary ? primary.name : null,
      contact_email: primary ? primary.email : null,
      billing_address: document.getElementById('newCompanyBillingAddress').value.trim() || null,
    })
    .select()
    .single();

  if (error) { alert('Error creating client: ' + error.message); return; }

  let contactErr = null;
  if (primary) {
    const { data: inserted, error: err } = await ggClient.from('participants')
      .insert({
        full_name: primary.name,
        company_id: co.id,
        email: primary.email,
        phone: primary.phones[0]?.number || null,
        phones: primary.phones,
        title: primary.title,
        notes: primary.notes
      })
      .select('id')
      .single();
    contactErr = err;
    if (!err && inserted) {
      await ggClient.from('companies').update({ primary_contact_participant_id: inserted.id }).eq('id', co.id);
    }
  }

  if (!contactErr && others.length) {
    const { error: err } = await ggClient.from('participants').insert(others.map(c => ({
      full_name: c.name,
      company_id: c.companyId || co.id,
      email: c.email,
      phone: c.phones[0]?.number || null,
      phones: c.phones,
      title: c.title,
      notes: c.notes
    })));
    contactErr = contactErr || err;
  }

  if (contactErr) {
    alert(/duplicate key|unique/i.test(contactErr.message)
      ? 'Client created, but one of those contact emails is already on file for someone else — link them from the Address Book instead.'
      : 'Client created, but saving contacts failed: ' + contactErr.message);
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
  document.getElementById('newCompanyContacts').innerHTML = '';
  Object.keys(contactPhonesState).forEach(k => { if (k.startsWith('nc-')) delete contactPhonesState[k]; });
  newCompanyContactRowCounter = 0;
  addNewCompanyContactRow();
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
  setView('clients', document.getElementById('clientsNavToggle'));
}

let currentPrimaryContactId = null;
const PHONE_TYPES = ['Office', 'Work Cell', 'Personal Cell'];

// Keyed phone-row editor shared by the company Primary Contact editor,
// Address Book add/edit contact, and each New Client contact row.
// contactPhonesState[key] holds that editor's array of {type, number}.
let contactPhonesState = {};

function renderPhoneRowsFor(key) {
  const phones = contactPhonesState[key] || [];
  if (phones.length === 0) {
    return '<p class="empty-hint" style="margin:8px 0;">No phone numbers yet.</p>';
  }
  return phones.map((p, i) => `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
      <select class="field-input" style="max-width:140px;" onchange="contactPhonesState['${key}'][${i}].type = this.value">
        ${PHONE_TYPES.map(t => `<option value="${t}" ${p.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <input type="text" class="field-input" value="${escHtml(p.number || '')}" placeholder="(555) 555-5555" oninput="contactPhonesState['${key}'][${i}].number = this.value" />
      <button type="button" class="btn-sm btn-sm-danger" onclick="removeContactPhoneRow('${key}', ${i})">×</button>
    </div>
  `).join('');
}

function addContactPhoneRow(key) {
  if (!contactPhonesState[key]) contactPhonesState[key] = [];
  contactPhonesState[key].push({ type: 'Office', number: '' });
  document.getElementById('phoneRows_' + key).innerHTML = renderPhoneRowsFor(key);
}

function removeContactPhoneRow(key, index) {
  contactPhonesState[key].splice(index, 1);
  document.getElementById('phoneRows_' + key).innerHTML = renderPhoneRowsFor(key);
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

  contactPhonesState['company'] = (company.phones || []).map(p => ({ ...p }));
  currentPrimaryContactId = company.primary_contact_participant_id || null;

  const members = roster || [];
  const activeCount = members.filter(m => m.is_active && m.auth_user_id).length;
  const memberIds = members.map(m => m.id);

  const [{ data: attendanceRows }, { data: invoiceRows }, { data: clientDocRows }] = await Promise.all([
    memberIds.length
      ? ggClient.from('attendance').select('id, participant_id, status, certificate_issued, workshop:workshop_id(title)').in('participant_id', memberIds)
      : Promise.resolve({ data: [] }),
    ggClient.from('documents').select('id, doc_type, doc_number, status, total, doc_date, due_date').eq('company_id', companyId).order('created_at', { ascending: false }),
    ggClient.from('client_documents').select('id, document_id, file_name, storage_path, file_size, created_at').eq('company_id', companyId).order('created_at', { ascending: false })
  ]);

  const rosterById = {};
  members.forEach(m => { rosterById[m.id] = m; });

  const membershipPanel = membership ? `
    <div class="builder-card" style="margin-top:12px;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span class="client-code-chip">${escHtml(membership.client_code)}</span>
        <button class="btn-sm btn-sm-ghost" onclick="copyClientCode('${escHtml(membership.client_code)}')">Copy</button>
        <button class="btn-sm btn-sm-ghost" onclick="regenerateClientCode('${company.id}')">Regenerate</button>
        <span class="seat-badge">${membership.max_seats === null ? 'Unlimited' : `${activeCount} / ${membership.max_seats} active`}</span>
      </div>
      <div class="fields-grid" style="margin-top:12px;">
        <div class="field-group half">
          <label class="field-label">Membership Tier</label>
          <select class="field-input" onchange="updateMembershipField('${company.id}', 'membership_tier', this.value)">
            <option value="">None</option>
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

  const invoiceRowsHtml = (invoiceRows || []).map(d => {
    const isPastDue = d.due_date && d.due_date < todayIsoDate() && d.status !== 'paid';
    const dateLabel = d.doc_type === 'invoice' && d.due_date ? d.due_date : (d.doc_date || '—');
    return `
    <tr>
      <td>${escHtml(d.doc_number)}</td>
      <td>${escHtml(d.doc_type)}</td>
      <td><span class="reg-card-status-badge">${escHtml(isPastDue ? 'Past Due' : d.status)}</span></td>
      <td>${formatCurrency(d.total)}</td>
      <td>${escHtml(dateLabel)}</td>
      <td><button type="button" class="btn-sm btn-sm-ghost" onclick="openQuoteDocument('${escHtml(d.id)}')">View →</button></td>
    </tr>
  `;
  }).join('');

  const invoiceOptionsHtml = (invoiceRows || []).map(d => `<option value="${escHtml(d.id)}">${escHtml(d.doc_number)} (${escHtml(d.doc_type)})</option>`).join('');
  const clientDocRowsHtml = (clientDocRows || []).map(doc => {
    const linked = doc.document_id ? (invoiceRows || []).find(d => d.id === doc.document_id) : null;
    return `
    <tr>
      <td>${escHtml(doc.file_name)}</td>
      <td>${formatFileSize(doc.file_size)}</td>
      <td>${escHtml((doc.created_at || '').slice(0, 10))}</td>
      <td>${linked ? escHtml(linked.doc_number) : '—'}</td>
      <td>
        <button type="button" class="btn-sm btn-sm-ghost" onclick="viewClientDocument('${escHtml(doc.storage_path)}')">View</button>
        <button type="button" class="btn-sm btn-sm-danger" onclick="deleteClientDocument('${escHtml(doc.id)}', '${escHtml(doc.storage_path)}')">Delete</button>
      </td>
    </tr>
  `;
  }).join('');

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
        <div id="phoneRows_company">${renderPhoneRowsFor('company')}</div>
        <button type="button" class="btn-sm btn-sm-ghost" onclick="addContactPhoneRow('company')">+ Add Phone Number</button>
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

    <div class="dashboard-section-header" style="margin-top:24px;">
      <div class="detail-section-title" style="margin:0;">Company Roster</div>
      <button class="btn-sm btn-sm-ghost" onclick="showAddRosterContact('${company.id}')">+ Create New Contact</button>
    </div>
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
        <thead><tr><th>Number</th><th>Type</th><th>Status</th><th>Total</th><th>Due</th><th></th></tr></thead>
        <tbody>${invoiceRowsHtml || '<tr><td colspan="6">No invoices yet.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="detail-section-title">Documents</div>
    <p class="view-sub" style="margin-top:-8px;">Signed operating agreements and other files for this client.</p>
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead><tr><th>File</th><th>Size</th><th>Uploaded</th><th>Linked To</th><th></th></tr></thead>
        <tbody>${clientDocRowsHtml || '<tr><td colspan="5">No documents uploaded yet.</td></tr>'}</tbody>
      </table>
    </div>
    <div style="display:flex; align-items:center; gap:10px; margin-top:12px; flex-wrap:wrap;">
      <input type="file" id="clientDocFile" class="field-input" style="max-width:280px;">
      <select id="clientDocLinkTo" class="field-input" style="max-width:240px;">
        <option value="">— Not linked to a specific quote/invoice —</option>
        ${invoiceOptionsHtml}
      </select>
      <button class="btn-sm btn-sm-ghost" onclick="uploadClientDocument('${company.id}')">+ Upload Document</button>
    </div>
  `;
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function uploadClientDocument(companyId) {
  const fileInput = document.getElementById('clientDocFile');
  const file = fileInput.files[0];
  if (!file) { alert('Choose a file first.'); return; }
  const linkedDocId = document.getElementById('clientDocLinkTo').value || null;
  const path = `${companyId}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await ggClient.storage.from('client-documents').upload(path, file);
  if (upErr) { alert('Upload failed: ' + upErr.message); return; }
  const { error: insErr } = await ggClient.from('client_documents').insert({
    company_id: companyId, document_id: linkedDocId, file_name: file.name, storage_path: path, file_size: file.size
  });
  if (insErr) { alert('Could not save document record: ' + insErr.message); return; }
  loadClientDetail();
}

async function viewClientDocument(path) {
  const { data, error } = await ggClient.storage.from('client-documents').createSignedUrl(path, 300);
  if (error || !data) { alert('Could not open file: ' + (error ? error.message : 'unknown error')); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

async function deleteClientDocument(id, path) {
  if (!confirm('Delete this document? This cannot be undone.')) return;
  await ggClient.storage.from('client-documents').remove([path]);
  const { error } = await ggClient.from('client_documents').delete().eq('id', id);
  if (error) { alert('Could not delete: ' + error.message); return; }
  loadClientDetail();
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
    phones: (contactPhonesState['company'] || []).filter(p => p.number && p.number.trim()),
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

// ── ADDRESS BOOK (all contacts, filterable across clients) ──────
let addressBookCompanies = [];
let addressBookRows = [];
let editingContactId = null;
let editingContactCanDelete = true;
let editingContactName = '';

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
    .select('id, full_name, email, phone, phones, title, notes, company_id, is_active, auth_user_id, companies!company_id(name, org_admin_participant_id)')
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

  addressBookRows = filtered;

  container.innerHTML = `
    <div class="responses-table-wrap">
      <table class="responses-table">
        <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Title</th></tr></thead>
        <tbody>
          ${filtered.map(p => {
            const isOrgAdmin = p.companies?.org_admin_participant_id === p.id;
            return `
              <tr class="client-list-row" onclick="showViewContact('${p.id}')">
                <td>${escHtml(p.full_name || '—')}${isOrgAdmin ? ' <span class="wc-badge">Org Admin</span>' : ''}</td>
                <td>${escHtml(p.companies?.name || '—')}</td>
                <td>${escHtml(p.email || '—')}</td>
                <td>${escHtml(p.phone || '—')}</td>
                <td>${escHtml(p.title || '—')}</td>
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
  contactPhonesState['abNew'] = [];
  document.getElementById('phoneRows_abNew').innerHTML = renderPhoneRowsFor('abNew');
}
function hideCreateContact() {
  document.getElementById('createContactCard').style.display = 'none';
}

async function createAddressBookContact() {
  const fullName = document.getElementById('abNewName').value.trim();
  if (!fullName) { alert('Full name is required.'); return; }

  const phones = (contactPhonesState['abNew'] || []).filter(p => p.number && p.number.trim());

  const { error } = await ggClient.from('participants').insert({
    full_name: fullName,
    company_id: document.getElementById('abNewCompany').value || null,
    email: document.getElementById('abNewEmail').value.trim() || null,
    phone: phones[0]?.number || null,
    phones,
    title: document.getElementById('abNewTitle').value.trim() || null,
    notes: document.getElementById('abNewNotes').value.trim() || null
  });

  if (error) {
    alert(/duplicate key|unique/i.test(error.message) ? 'That email is already on file for another contact.' : 'Could not add contact: ' + error.message);
    return;
  }

  document.getElementById('abNewName').value = '';
  document.getElementById('abNewCompany').value = '';
  document.getElementById('abNewEmail').value = '';
  document.getElementById('abNewTitle').value = '';
  document.getElementById('abNewNotes').value = '';
  contactPhonesState['abNew'] = [];
  document.getElementById('phoneRows_abNew').innerHTML = renderPhoneRowsFor('abNew');
  hideCreateContact();
  loadAddressBook();
}

let viewingContactId = null;

function showViewContact(participantId) {
  const p = addressBookRows.find(r => r.id === participantId);
  if (!p) return;
  viewingContactId = participantId;

  const isOrgAdmin = p.companies?.org_admin_participant_id === p.id;
  document.getElementById('viewContactTitle').innerHTML = escHtml(p.full_name || 'Contact') + (isOrgAdmin ? ' <span class="wc-badge">Org Admin</span>' : '');
  document.getElementById('viewContactCompany').textContent = p.companies?.name || '—';
  document.getElementById('viewContactRole').textContent = p.title || '—';
  document.getElementById('viewContactEmail').textContent = p.email || '—';
  document.getElementById('viewContactNotes').textContent = p.notes || '—';

  const phones = (p.phones && p.phones.length) ? p.phones.filter(ph => ph.number) : (p.phone ? [{ type: 'Office', number: p.phone }] : []);
  document.getElementById('viewContactPhones').innerHTML = phones.length
    ? phones.map(ph => `<div>${escHtml(ph.type || 'Phone')}: ${escHtml(ph.number)}</div>`).join('')
    : '—';

  document.getElementById('viewContactModal').style.display = 'flex';
}
function hideViewContact() {
  document.getElementById('viewContactModal').style.display = 'none';
  viewingContactId = null;
}
function editFromViewContact() {
  const id = viewingContactId;
  hideViewContact();
  showEditContact(id);
}

function showEditContact(participantId) {
  const p = addressBookRows.find(r => r.id === participantId);
  if (!p) return;

  editingContactId = participantId;
  editingContactName = p.full_name || 'this contact';
  const isOrgAdmin = p.companies?.org_admin_participant_id === p.id;
  const hasPortalAccess = p.is_active && p.auth_user_id;
  editingContactCanDelete = !hasPortalAccess && !isOrgAdmin;

  document.getElementById('abEditName').value = p.full_name || '';
  document.getElementById('abEditCompany').innerHTML = '<option value="">— None —</option>' +
    addressBookCompanies.map(c => `<option value="${c.id}" ${p.company_id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
  document.getElementById('abEditEmail').value = p.email || '';
  document.getElementById('abEditTitle').value = p.title || '';
  document.getElementById('abEditNotes').value = p.notes || '';
  contactPhonesState['abEdit'] = (p.phones && p.phones.length) ? p.phones.map(ph => ({ ...ph })) : (p.phone ? [{ type: 'Office', number: p.phone }] : []);
  document.getElementById('phoneRows_abEdit').innerHTML = renderPhoneRowsFor('abEdit');

  const deleteBtn = document.getElementById('abDeleteContactBtn');
  deleteBtn.disabled = !editingContactCanDelete;
  deleteBtn.style.opacity = editingContactCanDelete ? '1' : '0.5';
  deleteBtn.style.cursor = editingContactCanDelete ? 'pointer' : 'not-allowed';
  deleteBtn.title = editingContactCanDelete ? '' : (isOrgAdmin ? 'Reassign the org admin first' : 'Manage portal access from their Company view in the client portal');

  document.getElementById('editContactModal').style.display = 'flex';
}
function hideEditContact() {
  document.getElementById('editContactModal').style.display = 'none';
  editingContactId = null;
}

async function saveContactEdits() {
  if (!editingContactId) return;
  const fullName = document.getElementById('abEditName').value.trim();
  if (!fullName) { alert('Full name is required.'); return; }

  const phones = (contactPhonesState['abEdit'] || []).filter(p => p.number && p.number.trim());

  const { error } = await ggClient.from('participants').update({
    full_name: fullName,
    company_id: document.getElementById('abEditCompany').value || null,
    email: document.getElementById('abEditEmail').value.trim() || null,
    phone: phones[0]?.number || null,
    phones,
    title: document.getElementById('abEditTitle').value.trim() || null,
    notes: document.getElementById('abEditNotes').value.trim() || null
  }).eq('id', editingContactId);

  if (error) {
    alert(/duplicate key|unique/i.test(error.message) ? 'That email is already on file for another contact.' : 'Could not save: ' + error.message);
    return;
  }

  hideEditContact();
  loadAddressBook();
}

async function deleteContact() {
  if (!editingContactId || !editingContactCanDelete) return;
  if (!confirm(`Remove ${editingContactName} from the address book? This cannot be undone.`)) return;

  const { error } = await ggClient.from('participants').delete().eq('id', editingContactId);
  if (error) {
    alert(/foreign key|violates/i.test(error.message)
      ? `Can't remove ${editingContactName} — they have training or registration history on file.`
      : 'Could not remove contact: ' + error.message);
    return;
  }
  hideEditContact();
  loadAddressBook();
}

async function openAddressBookForCompany(companyId) {
  setView('address-book', document.querySelector('[data-view="address-book"]'));
  await loadAddressBookFilters();
  document.getElementById('abFilterCompany').value = companyId;
  loadAddressBook();
}

let addRosterContactCompanyId = null;

function showAddRosterContact(companyId) {
  addRosterContactCompanyId = companyId;
  document.getElementById('rosterContactName').value = '';
  document.getElementById('rosterContactEmail').value = '';
  document.getElementById('rosterContactPhone').value = '';
  document.getElementById('rosterContactTitle').value = '';
  document.getElementById('rosterContactNotes').value = '';
  document.getElementById('addRosterContactModal').style.display = 'flex';
}
function hideAddRosterContact() {
  document.getElementById('addRosterContactModal').style.display = 'none';
  addRosterContactCompanyId = null;
}

async function createRosterContact() {
  if (!addRosterContactCompanyId) return;
  const fullName = document.getElementById('rosterContactName').value.trim();
  if (!fullName) { alert('Full name is required.'); return; }

  const { error } = await ggClient.from('participants').insert({
    full_name: fullName,
    company_id: addRosterContactCompanyId,
    email: document.getElementById('rosterContactEmail').value.trim() || null,
    phone: document.getElementById('rosterContactPhone').value.trim() || null,
    title: document.getElementById('rosterContactTitle').value.trim() || null,
    notes: document.getElementById('rosterContactNotes').value.trim() || null
  });

  if (error) {
    alert(/duplicate key|unique/i.test(error.message) ? 'That email is already on file for another contact.' : 'Could not add contact: ' + error.message);
    return;
  }

  hideAddRosterContact();
  loadClientDetail();
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
lucide.createIcons();

// ── INIT ──────────────────────────────────────────────────────
checkSession();
