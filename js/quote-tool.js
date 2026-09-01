// ============================================================
// GUARDIAN GROUP — quote-tool.js
// Quote / Invoice / Receipt tool. Shares the main Supabase project
// (js/config.js) — quote_clients/documents/service_items tables,
// staff-only RLS. Only reachable from the logged-in admin dashboard.
// Vanilla JS port of the approved Claude Design build.
// ============================================================

const QT_SHOW_ITEM_DATES = false;

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escAttr(str) {
  return esc(str).replace(/"/g, '&quot;');
}

function formatToday() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayIso() {
  return toIsoDate(new Date());
}
function computeDueDate(docDateStr, dueTermsStr) {
  if (!docDateStr) return '';
  const base = new Date(docDateStr);
  if (isNaN(base.getTime())) return '';
  const match = /(\d+)/.exec(dueTermsStr || '');
  const days = match ? parseInt(match[1], 10) : 14;
  const due = new Date(base);
  due.setDate(due.getDate() + days);
  return toIsoDate(due);
}
function statusListFor(mode) {
  if (mode === 'quote') return ['draft', 'sent', 'accepted', 'declined', 'expired'];
  if (mode === 'invoice') return ['draft', 'sent', 'partially_paid', 'paid'];
  return ['issued'];
}
function labelize(s) {
  return String(s).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function statusTone(s) {
  if (s === 'accepted' || s === 'paid' || s === 'issued') return 'open';
  if (s === 'declined' || s === 'overdue') return 'danger';
  if (s === 'sent') return 'info';
  if (s === 'partially_paid') return 'steel';
  return 'neutral';
}
function fmt(n) {
  const v = Math.abs(n).toFixed(2);
  return (n < 0 ? '-$' : '$') + v;
}
function computeTotals(s) {
  const subtotal = s.items.reduce((sum, it) => {
    const qty = parseFloat(it.qty) || 0;
    const rate = parseFloat(it.rate) || 0;
    const amount = it.type === 'flat' ? rate : qty * rate;
    return sum + amount;
  }, 0);
  const discountValueNum = parseFloat(s.discountValue) || 0;
  const discountAmount = s.discountType === '%' ? (subtotal * discountValueNum / 100) : discountValueNum;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  return { subtotal, discountAmount, afterDiscount };
}
function paymentMethodLabel(s) {
  const labels = { cash: 'Cash', card: 'Card', venmo: 'Venmo', zelle: 'Zelle', cashapp: 'Cash App', check: 'Check', transfer: 'Bank Transfer' };
  if (s.paymentMethod === 'other') return s.paymentMethodOther || 'Other';
  return labels[s.paymentMethod] || '—';
}

let state = {
  view: 'editor',

  currentDocId: null,
  parentDocId: null,
  parentDocNumber: null,
  mode: 'quote',
  status: 'draft',
  docNumber: '',
  docDate: formatToday(),
  validFor: '14 days',
  dueTerms: 'Net 14',
  dueDate: '',
  datePaid: '',
  paymentMethod: '',
  paymentMethodOther: '',
  businessContactName: '',
  businessPhone: '',
  businessEmail: '',
  clientId: null,
  clientCompanyId: null,
  clientCompany: '',
  clientPersonName: '',
  clientEmail: '',
  clientPhone: '',
  showNewClientModal: false,
  newClientSaving: false,
  newClientDraft: { name: '', contactName: '', email: '', phone: '' },
  items: [
    { id: 1, date: '', description: 'Safety & Leadership Workshop (full day)', type: 'flat', qty: '1', rate: '0' }
  ],
  discountType: '$',
  discountValue: '0',
  amountPaid: '0',
  hideTotals: false,
  notesQuote: 'We accept cash, check, Venmo, Zelle, or card. A deposit may be required to reserve your training date.',
  notesInvoice: 'Payment due within the terms above. We accept cash, check, Venmo, Zelle, or card — contact us with any questions about this invoice.',
  notesReceipt: 'Payment received in full. Keep this receipt for your records.',

  saving: false,
  saveMessage: '',

  catalogPick: '',
  clients: [],
  catalogItems: [],

  documentsList: [],
  listLoading: false,
  listSearch: '',
  listTypeFilter: 'all',
  listStatusFilter: 'all',
  listClientFilter: 'all'
};

let itemIdCounter = 1;
let sb = null;

// ── Field binding helpers (avoid full re-render while typing) ──

function qtSetField(field, value) {
  state[field] = value;
  if (field === 'businessContactName' || field === 'businessPhone' || field === 'businessEmail') {
    persistBusinessInfo();
  }
}
function qtSetFieldRecalc(field, value) {
  state[field] = value;
  qtRecalc();
}
function qtSetItemField(id, field, value) {
  const it = state.items.find(i => i.id === id);
  if (it) it[field] = value;
  if (field === 'qty' || field === 'rate') qtRecalc();
}
function qtSetHideTotals(checked) {
  state.hideTotals = checked;
  render();
}
function qtAutosizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function qtRecalc() {
  const s = state;
  const totals = computeTotals(s);
  const isQuote = s.mode === 'quote';
  const isInvoice = s.mode === 'invoice';
  const isReceipt = s.mode === 'receipt';
  const amountPaidNum = parseFloat(s.amountPaid) || 0;
  const balance = totals.afterDiscount - amountPaidNum;
  const isPaidInFull = !isQuote && balance <= 0.005;

  s.items.forEach(it => {
    const el = document.getElementById('qtAmt' + it.id);
    if (!el) return;
    const qty = parseFloat(it.qty) || 0;
    const rate = parseFloat(it.rate) || 0;
    const amount = it.type === 'flat' ? rate : qty * rate;
    el.textContent = fmt(amount);
  });

  const subtotalEl = document.getElementById('qtSubtotal');
  if (subtotalEl) subtotalEl.textContent = fmt(totals.subtotal);

  const totalValueEl = document.getElementById('qtTotalValue');
  if (totalValueEl) totalValueEl.textContent = isQuote ? fmt(totals.afterDiscount) : (isInvoice ? fmt(balance) : fmt(amountPaidNum));

  const paidBadge = document.getElementById('qtPaidBadge');
  if (paidBadge) paidBadge.style.display = isPaidInFull ? '' : 'none';

  const balanceNote = document.getElementById('qtBalanceNote');
  if (balanceNote) {
    const show = isReceipt && !isPaidInFull;
    balanceNote.style.display = show ? '' : 'none';
    if (show) balanceNote.textContent = 'Balance remaining: ' + fmt(balance);
  }

  const markPaidRow = document.getElementById('qtMarkPaidRow');
  if (markPaidRow) markPaidRow.style.display = (!isQuote && !isPaidInFull && totals.afterDiscount > 0) ? '' : 'none';
}

function persistBusinessInfo() {
  try {
    localStorage.setItem('gg_qt_business_info_v1', JSON.stringify({
      businessContactName: state.businessContactName,
      businessPhone: state.businessPhone,
      businessEmail: state.businessEmail
    }));
  } catch (e) {}
}

function patchHelperText() {
  const el = document.getElementById('qtHelperText');
  if (el) el.textContent = state.saveMessage || 'Click any field to edit it directly, then print to save a PDF.';
}
function flashMessage(msg) {
  state.saveMessage = msg;
  patchHelperText();
  setTimeout(() => {
    if (state.saveMessage === msg) { state.saveMessage = ''; patchHelperText(); }
  }, 3500);
}

// ── Item management ─────────────────────────────────────────

function qtAddItem() {
  itemIdCounter += 1;
  state.items.push({ id: itemIdCounter, date: '', description: '', type: 'flat', qty: '1', rate: '0' });
  render();
}
function qtRemoveItem(id) {
  state.items = state.items.filter(it => it.id !== id);
  render();
}

// ── Supabase client ──────────────────────────────────────────

function buildClient() {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function init() {
  buildClient();

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { (window.top || window).location.href = '/admin/'; return; }

  render();
  let biz = {};
  try { biz = JSON.parse(localStorage.getItem('gg_qt_business_info_v1') || '{}'); } catch (e) {}
  if (biz.businessContactName) state.businessContactName = biz.businessContactName;
  if (biz.businessPhone) state.businessPhone = biz.businessPhone;
  if (biz.businessEmail) state.businessEmail = biz.businessEmail;

  loadClients();
  loadCatalog();

  const params = new URLSearchParams(window.location.search);
  const docId = params.get('doc');
  if (docId) {
    await qtOpenDocument(docId);
  } else if (params.get('view') === 'list') {
    const type = params.get('type');
    state.listTypeFilter = ['quote', 'invoice', 'receipt'].includes(type) ? type : 'all';
    state.listStatusFilter = params.get('status') || 'all';
    qtOpenDocumentsList();
  } else {
    resetToBlank('quote');
  }
}

// ── Data loading ─────────────────────────────────────────────

function qtFirstPhone(company) {
  return (company.phones && company.phones[0] && company.phones[0].number) || '';
}

async function loadClients() {
  if (!sb) return;
  const { data } = await sb.from('companies').select('id,name,contact_name,contact_email,phones').order('name');
  if (data) { state.clients = data; render(); }
}
async function loadCatalog() {
  if (!sb) return;
  const { data } = await sb.from('service_items').select('*').order('description');
  if (data) { state.catalogItems = data; render(); }
}
async function loadDocumentsList() {
  if (!sb) return;
  state.listLoading = true;
  renderDocRows();
  const { data } = await sb
    .from('documents')
    .select('id,doc_type,doc_number,status,client_name,total,doc_date,due_date,company_id,created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  state.listLoading = false;
  state.documentsList = data || [];
  renderDocRows();
}
function qtOpenDocumentsList(type) {
  state.view = 'list';
  if (type !== undefined) state.listTypeFilter = type;
  render();
  loadDocumentsList();
}
function qtCreateNewFromList(mode = 'quote') {
  resetToBlank(mode);
}
function qtCreateNewReceipt() {
  resetToBlank('receipt');
  state.status = 'issued';
  state.datePaid = todayIso();
  render();
}

// ── Client / catalog interactions ───────────────────────────

function qtSelectClientOption(value) {
  if (value === '__new__') {
    qtOpenNewClientModal();
    return;
  }
  const company = state.clients.find(c => String(c.id) === String(value));
  state.clientCompanyId = company ? company.id : null;
  state.clientId = null;
  state.clientCompany = company ? company.name : '';
  state.clientPersonName = company ? (company.contact_name || '') : '';
  state.clientEmail = company ? (company.contact_email || '') : '';
  state.clientPhone = company ? qtFirstPhone(company) : '';
  render();
}

function qtOpenNewClientModal() {
  state.showNewClientModal = true;
  state.newClientDraft = { name: '', contactName: '', email: '', phone: '' };
  render();
}
function qtCloseNewClientModal() {
  state.showNewClientModal = false;
  render();
}
function qtSetNewClientField(field, value) {
  state.newClientDraft[field] = value;
}
async function qtCreateNewClient() {
  const name = (state.newClientDraft.name || '').trim();
  if (!name) { flashMessage('Company name is required.'); return; }
  if (!sb) return;
  state.newClientSaving = true;
  render();
  const contactName = (state.newClientDraft.contactName || '').trim();
  const email = (state.newClientDraft.email || '').trim();
  const phone = (state.newClientDraft.phone || '').trim();
  const { data: company, error } = await sb.from('companies').insert({
    name: name,
    contact_name: contactName || null,
    contact_email: email || null,
    phones: phone ? [{ type: 'Office', number: phone }] : []
  }).select('id,name,contact_name,contact_email,phones').single();
  state.newClientSaving = false;
  if (error || !company) {
    render();
    flashMessage('Could not create client — try again.');
    return;
  }
  state.clients.push(company);
  state.clients.sort((a, b) => a.name.localeCompare(b.name));
  state.clientCompanyId = company.id;
  state.clientId = null;
  state.clientCompany = company.name;
  state.clientPersonName = contactName;
  state.clientEmail = email;
  state.clientPhone = phone;
  state.showNewClientModal = false;
  render();
  flashMessage('Client created ✓');
}

function qtPickCatalogItem(value) {
  if (!value) return;
  const item = state.catalogItems.find(ci => String(ci.id) === String(value));
  state.catalogPick = '';
  if (!item) { render(); return; }
  itemIdCounter += 1;
  state.items.push({ id: itemIdCounter, date: '', description: item.description, type: item.type, qty: '1', rate: String(item.rate) });
  render();
}

async function qtSaveItemToCatalog(id) {
  const it = state.items.find(i => i.id === id);
  if (!it) return;
  const desc = (it.description || '').trim();
  if (!desc || !sb) return;
  const exists = state.catalogItems.find(ci => ci.description.toLowerCase() === desc.toLowerCase());
  if (exists) { flashMessage('Already saved as a reusable item'); return; }
  const { data, error } = await sb.from('service_items').insert({
    description: desc, type: it.type, rate: parseFloat(it.rate) || 0
  }).select().single();
  if (!error && data) {
    state.catalogItems.push(data);
    flashMessage('Saved to catalog ✓');
  }
}

async function upsertClient() {
  if (!sb) return state.clientId || null;
  // No company selected — either nothing picked, or this is a legacy
  // document whose quote_clients row was never linked to a company.
  // Keep using its already-resolved quote_clients id as-is.
  if (!state.clientCompanyId) return state.clientId || null;

  const { data: existing } = await sb.from('quote_clients')
    .select('id,contact_name,phone,email').eq('company_id', state.clientCompanyId).maybeSingle();
  if (existing) {
    const patch = {};
    if (state.clientPersonName && !existing.contact_name) patch.contact_name = state.clientPersonName;
    if (state.clientPhone && !existing.phone) patch.phone = state.clientPhone;
    if (state.clientEmail && !existing.email) patch.email = state.clientEmail;
    if (Object.keys(patch).length) await sb.from('quote_clients').update(patch).eq('id', existing.id);
    return existing.id;
  }
  const company = state.clients.find(c => c.id === state.clientCompanyId);
  const { data, error } = await sb.from('quote_clients').insert({
    name: (company && company.name) || state.clientCompany,
    contact_name: state.clientPersonName || '',
    phone: state.clientPhone || '',
    email: state.clientEmail || '',
    company_id: state.clientCompanyId
  }).select('id').single();
  if (!error && data) return data.id;
  return null;
}

// ── Document CRUD ────────────────────────────────────────────

function buildDocPayload(totals) {
  const s = state;
  const isQuote = s.mode === 'quote';
  const amountPaidNum = parseFloat(s.amountPaid) || 0;
  const balance = totals.afterDiscount - amountPaidNum;
  return {
    doc_type: s.mode,
    doc_number: s.docNumber,
    status: s.status,
    client_name: s.clientCompany,
    client_person_name: s.clientPersonName,
    client_email: s.clientEmail,
    client_phone: s.clientPhone,
    company_id: s.clientCompanyId || null,
    business_contact_name: s.businessContactName,
    business_phone: s.businessPhone,
    business_email: s.businessEmail,
    doc_date: s.docDate,
    valid_for: isQuote ? s.validFor : null,
    due_terms: s.mode === 'invoice' ? s.dueTerms : null,
    due_date: s.mode === 'invoice' ? (s.dueDate || null) : null,
    payment_method: !isQuote ? s.paymentMethod : null,
    payment_method_other: !isQuote ? s.paymentMethodOther : null,
    date_paid: !isQuote ? (s.datePaid || null) : null,
    items: s.items,
    discount_type: s.discountType,
    discount_value: parseFloat(s.discountValue) || 0,
    subtotal: totals.subtotal,
    discount_amount: totals.discountAmount,
    total: totals.afterDiscount,
    amount_paid: amountPaidNum,
    balance: balance,
    notes: isQuote ? s.notesQuote : (s.mode === 'invoice' ? s.notesInvoice : s.notesReceipt),
    parent_doc_id: s.parentDocId || null
  };
}

async function qtSaveDocument() {
  if (state.saving || !sb) return;
  state.saving = true;
  state.saveMessage = '';
  render();
  try {
    let docNumber = state.docNumber;
    if (!docNumber) {
      const { data } = await sb.rpc('next_doc_number', { p_type: state.mode });
      docNumber = data;
      state.docNumber = docNumber;
    }
    if (state.mode === 'invoice' && !state.dueDate) {
      state.dueDate = computeDueDate(state.docDate, state.dueTerms);
    }
    const totals = computeTotals(state);
    const clientId = await upsertClient();
    const payload = Object.assign({}, buildDocPayload(totals), { doc_number: docNumber, client_id: clientId });
    let result;
    if (state.currentDocId) {
      result = await sb.from('documents').update(payload).eq('id', state.currentDocId).select().single();
    } else {
      result = await sb.from('documents').insert(payload).select().single();
    }
    if (result.error) throw result.error;
    state.currentDocId = result.data.id;
    state.clientId = clientId;
    state.saving = false;
    render();
    flashMessage('Saved ✓');
  } catch (e) {
    state.saving = false;
    render();
    flashMessage('Save failed — check your connection and try again.');
  }
}

async function qtDeleteDocument(id) {
  if (!sb) return;
  if (!confirm('Delete this document permanently? This cannot be undone.')) return;
  const { error } = await sb.from('documents').delete().eq('id', id);
  if (error) { flashMessage('Could not delete — try again.'); return; }
  if (state.view === 'list') {
    state.documentsList = state.documentsList.filter(d => d.id !== id);
    renderDocRows();
  }
  if (state.currentDocId === id) {
    qtOpenDocumentsList('all');
  }
}

async function qtOpenDocument(id) {
  if (!sb) return;
  state.view = 'editor';
  render();
  const { data, error } = await sb.from('documents').select('*').eq('id', id).single();
  if (error || !data) return;
  let parentNumber = null;
  if (data.parent_doc_id) {
    const p = await sb.from('documents').select('doc_number').eq('id', data.parent_doc_id).single();
    if (p.data) parentNumber = p.data.doc_number;
  }
  const items = (data.items && data.items.length) ? data.items : [{ id: 1, date: '', description: '', type: 'flat', qty: '1', rate: '0' }];
  itemIdCounter = Math.max.apply(null, items.map(i => i.id || 1));
  let clientCompanyId = null;
  if (data.client_id) {
    const qc = await sb.from('quote_clients').select('company_id').eq('id', data.client_id).maybeSingle();
    clientCompanyId = qc.data ? qc.data.company_id : null;
  }
  Object.assign(state, {
    currentDocId: data.id,
    parentDocId: data.parent_doc_id,
    parentDocNumber: parentNumber,
    mode: data.doc_type,
    status: data.status,
    docNumber: data.doc_number,
    docDate: data.doc_date || '',
    validFor: data.valid_for || '14 days',
    dueTerms: data.due_terms || 'Net 14',
    dueDate: data.due_date || '',
    datePaid: data.date_paid || '',
    paymentMethod: data.payment_method || '',
    paymentMethodOther: data.payment_method_other || '',
    businessContactName: data.business_contact_name || state.businessContactName,
    businessPhone: data.business_phone || state.businessPhone,
    businessEmail: data.business_email || state.businessEmail,
    clientId: data.client_id,
    clientCompanyId: clientCompanyId,
    clientCompany: data.client_name || '',
    clientPersonName: data.client_person_name || '',
    clientEmail: data.client_email || '',
    clientPhone: data.client_phone || '',
    items: items,
    discountType: data.discount_type || '$',
    discountValue: String(data.discount_value != null ? data.discount_value : 0),
    amountPaid: String(data.amount_paid != null ? data.amount_paid : 0),
    hideTotals: false,
    notesQuote: data.doc_type === 'quote' ? (data.notes || state.notesQuote) : state.notesQuote,
    notesInvoice: data.doc_type === 'invoice' ? (data.notes || state.notesInvoice) : state.notesInvoice,
    notesReceipt: data.doc_type === 'receipt' ? (data.notes || state.notesReceipt) : state.notesReceipt,
    saveMessage: ''
  });
  render();
}

async function qtConvertToInvoice() {
  if (state.mode !== 'quote' || !state.currentDocId || !sb) return;
  state.saving = true;
  render();
  try {
    const { data: numData, error: numErr } = await sb.rpc('next_doc_number', { p_type: 'invoice' });
    if (numErr) throw numErr;
    const totals = computeTotals(state);
    const newDocDate = formatToday();
    const newDueDate = computeDueDate(newDocDate, 'Net 14');
    const payload = Object.assign({}, buildDocPayload(totals), {
      doc_type: 'invoice',
      doc_number: numData,
      status: 'draft',
      due_terms: 'Net 14',
      due_date: newDueDate,
      valid_for: null,
      payment_method: null,
      payment_method_other: null,
      date_paid: null,
      doc_date: newDocDate,
      amount_paid: 0,
      balance: totals.afterDiscount,
      notes: state.notesInvoice,
      parent_doc_id: state.currentDocId,
      client_id: state.clientId,
      company_id: state.clientCompanyId || null
    });
    const ins = await sb.from('documents').insert(payload).select().single();
    if (ins.error) throw ins.error;
    await sb.from('documents').update({ status: 'accepted' }).eq('id', state.currentDocId);
    Object.assign(state, {
      currentDocId: ins.data.id,
      parentDocId: state.currentDocId,
      parentDocNumber: state.docNumber,
      mode: 'invoice',
      status: 'draft',
      docNumber: numData,
      docDate: newDocDate,
      dueTerms: 'Net 14',
      dueDate: newDueDate,
      datePaid: '',
      amountPaid: '0',
      saving: false
    });
    render();
    flashMessage('Invoice created ✓');
  } catch (e) {
    state.saving = false;
    render();
    flashMessage('Could not convert — try again.');
  }
}

async function qtMarkPaidCreateReceipt() {
  if (state.mode !== 'invoice' || !state.currentDocId || !sb) return;
  if (!state.paymentMethod) { flashMessage('Select a payment method first.'); return; }
  if (state.paymentMethod === 'other' && !(state.paymentMethodOther || '').trim()) {
    flashMessage('Specify the payment method.');
    return;
  }
  state.saving = true;
  render();
  try {
    const totals = computeTotals(state);
    const fullAmount = totals.afterDiscount;
    const paidDate = state.datePaid || todayIso();
    await sb.from('documents').update({
      status: 'paid', amount_paid: fullAmount, balance: 0, date_paid: paidDate,
      payment_method: state.paymentMethod, payment_method_other: state.paymentMethodOther || null
    }).eq('id', state.currentDocId);
    const { data: numData, error: numErr } = await sb.rpc('next_doc_number', { p_type: 'receipt' });
    if (numErr) throw numErr;
    const payload = Object.assign({}, buildDocPayload(totals), {
      doc_type: 'receipt',
      doc_number: numData,
      status: 'issued',
      due_terms: null,
      due_date: null,
      valid_for: null,
      payment_method: state.paymentMethod,
      payment_method_other: state.paymentMethodOther || null,
      date_paid: paidDate,
      doc_date: formatToday(),
      amount_paid: fullAmount,
      balance: 0,
      notes: state.notesReceipt,
      parent_doc_id: state.currentDocId,
      client_id: state.clientId,
      company_id: state.clientCompanyId || null
    });
    const ins = await sb.from('documents').insert(payload).select().single();
    if (ins.error) throw ins.error;
    Object.assign(state, {
      currentDocId: ins.data.id,
      parentDocId: state.currentDocId,
      parentDocNumber: state.docNumber,
      mode: 'receipt',
      status: 'issued',
      docNumber: numData,
      docDate: formatToday(),
      datePaid: paidDate,
      amountPaid: fullAmount.toFixed(2),
      saving: false
    });
    render();
    flashMessage('Receipt created ✓');
  } catch (e) {
    state.saving = false;
    render();
    flashMessage('Could not create receipt — try again.');
  }
}

function resetToBlank(mode) {
  itemIdCounter = 1;
  Object.assign(state, {
    view: 'editor',
    currentDocId: null,
    parentDocId: null,
    parentDocNumber: null,
    mode: mode,
    status: 'draft',
    docNumber: '',
    docDate: formatToday(),
    validFor: '14 days',
    dueTerms: 'Net 14',
    dueDate: '',
    datePaid: '',
    paymentMethod: '',
    paymentMethodOther: '',
    clientId: null,
    clientCompanyId: null,
    clientCompany: '',
    clientPersonName: '',
    clientEmail: '',
    clientPhone: '',
    items: [{ id: 1, date: '', description: '', type: 'flat', qty: '1', rate: '0' }],
    discountType: '$',
    discountValue: '0',
    amountPaid: '0',
    hideTotals: false,
    saveMessage: ''
  });
  render();
  fetchPreviewNumber(mode);
}

async function fetchPreviewNumber(mode) {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('next_doc_number', { p_type: mode });
    if (!error && data) { state.docNumber = data; render(); }
  } catch (e) {}
}

function qtNewDocument() {
  resetToBlank(state.mode);
}
function qtPrintDoc() {
  window.print();
}
function qtMarkPaidInFull() {
  const totals = computeTotals(state);
  state.amountPaid = totals.afterDiscount.toFixed(2);
  render();
}

// ── List view ────────────────────────────────────────────────

function isPastDue(d) {
  return !!(d.due_date && d.due_date < todayIso() && d.status !== 'paid');
}
function filteredDocuments() {
  const s = state;
  return s.documentsList
    .filter(d => s.listTypeFilter === 'all' || d.doc_type === s.listTypeFilter)
    .filter(d => {
      if (s.listStatusFilter === 'all') return true;
      if (s.listStatusFilter === 'past_due') return isPastDue(d);
      return d.status === s.listStatusFilter;
    })
    .filter(d => s.listClientFilter === 'all' || String(d.company_id) === String(s.listClientFilter))
    .filter(d => {
      if (!s.listSearch) return true;
      const q = s.listSearch.toLowerCase();
      return (d.doc_number || '').toLowerCase().includes(q) || (d.client_name || '').toLowerCase().includes(q);
    });
}
function renderDocRows() {
  const wrap = document.getElementById('qtDocRowsWrap');
  if (wrap) wrap.innerHTML = renderDocRowsInner();
}
function qtListSearchInput(value) {
  state.listSearch = value;
  renderDocRows();
}
function qtSetListFilter(field, value) {
  state[field] = value;
  renderDocRows();
}

// ── Render ───────────────────────────────────────────────────

function render() {
  document.getElementById('app').innerHTML = renderApp();
  document.querySelectorAll('.qt-item-row textarea.desc').forEach(qtAutosizeTextarea);
}

function renderApp() {
  return renderUnlocked();
}

function renderUnlocked() {
  const s = state;
  const isListView = s.view === 'list';
  const isEditorView = s.view === 'editor';
  return `
    <div>
      <div class="qt-topbar" data-noprint>
        <div class="qt-topbar-left">
          <img src="../assets/gg-shield.png" alt="" style="width:22px;height:22px;object-fit:contain;">
          <div class="qt-eyebrow">Quote &middot; Invoice &middot; Receipt Tool</div>
        </div>
        <div class="qt-topbar-right">
          ${isListView
            ? `<button class="qt-btn qt-btn-primary" onclick="qtCreateNewFromList('quote')">+ New Quote</button><button class="qt-btn qt-btn-primary" onclick="qtCreateNewFromList('invoice')">+ New Invoice</button><button class="qt-btn qt-btn-primary" onclick="qtCreateNewReceipt()">+ New Receipt</button>`
            : `<button class="qt-btn qt-btn-ghost" onclick="qtOpenDocumentsList('all')">All Documents</button>`}
          ${isEditorView ? renderModeTabsAndActions() : ''}
        </div>
      </div>
      <div class="qt-subbar" data-noprint>
        <div class="qt-helper-text" id="qtHelperText">${esc(s.saveMessage || 'Click any field to edit it directly, then print to save a PDF.')}</div>
        <div style="display:flex; gap:8px;">
          ${isEditorView && s.currentDocId ? `<button class="qt-btn qt-btn-danger" onclick="qtDeleteDocument('${escAttr(s.currentDocId)}')">Delete</button>` : ''}
          ${isEditorView ? `<button class="qt-btn qt-btn-dark" onclick="qtSaveDocument()">${s.saving ? 'Saving…' : 'Save'}</button>` : ''}
        </div>
      </div>
      ${isListView ? renderListView() : ''}
      ${isEditorView ? renderEditorView() : ''}
      ${s.showNewClientModal ? renderNewClientModal() : ''}
    </div>`;
}

function renderNewClientModal() {
  const d = state.newClientDraft;
  const saving = state.newClientSaving;
  return `
    <div class="qt-modal-overlay" data-noprint onclick="if (event.target === this) qtCloseNewClientModal()">
      <div class="qt-modal-card">
        <div class="qt-modal-header">
          <h3 class="qt-modal-title">New Client</h3>
          <button type="button" class="qt-modal-close" onclick="qtCloseNewClientModal()">&times;</button>
        </div>
        <div class="qt-modal-body">
          <label class="qt-modal-label">Company Name <span class="qt-required">*</span></label>
          <input class="qt-modal-input" value="${escAttr(d.name)}" placeholder="e.g. Acme Industrial" oninput="qtSetNewClientField('name', this.value)">
          <label class="qt-modal-label">Contact Name</label>
          <input class="qt-modal-input" value="${escAttr(d.contactName)}" placeholder="Jane Smith" oninput="qtSetNewClientField('contactName', this.value)">
          <label class="qt-modal-label">Email</label>
          <input class="qt-modal-input" type="email" value="${escAttr(d.email)}" placeholder="jane@acme.com" oninput="qtSetNewClientField('email', this.value)">
          <label class="qt-modal-label">Phone</label>
          <input class="qt-modal-input" value="${escAttr(d.phone)}" placeholder="(555) 555-5555" oninput="qtSetNewClientField('phone', this.value)">
        </div>
        <div class="qt-modal-actions">
          <button type="button" class="qt-btn qt-btn-muted" onclick="qtCloseNewClientModal()">Cancel</button>
          <button type="button" class="qt-btn qt-btn-primary" onclick="qtCreateNewClient()">${saving ? 'Saving…' : 'Add Client →'}</button>
        </div>
      </div>
    </div>`;
}

function renderModeTabsAndActions() {
  const s = state;
  return `
    <div class="qt-doc-type-label">${esc(labelize(s.mode))}</div>
    ${s.mode !== 'receipt' ? `<button class="qt-btn qt-btn-muted" onclick="qtNewDocument()">New</button>` : ''}
    <button class="qt-btn qt-btn-primary" onclick="qtPrintDoc()">Print / Save PDF</button>`;
}

function renderListView() {
  const s = state;
  const listTitle = 'All Documents';
  return `
    <div id="listPage" class="qt-list-page">
      <div class="qt-list-header">
        <div class="qt-list-title">${esc(listTitle)}</div>
        <div class="qt-list-controls">
          <input class="qt-list-search" value="${escAttr(s.listSearch)}" oninput="qtListSearchInput(this.value)" placeholder="Search client or number…">
          <select class="qt-select" onchange="qtSetListFilter('listTypeFilter', this.value)">
            <option value="all" ${s.listTypeFilter === 'all' ? 'selected' : ''}>All types</option>
            <option value="quote" ${s.listTypeFilter === 'quote' ? 'selected' : ''}>Quotes</option>
            <option value="invoice" ${s.listTypeFilter === 'invoice' ? 'selected' : ''}>Invoices</option>
            <option value="receipt" ${s.listTypeFilter === 'receipt' ? 'selected' : ''}>Receipts</option>
          </select>
          <select class="qt-select" onchange="qtSetListFilter('listStatusFilter', this.value)">
            <option value="all" ${s.listStatusFilter === 'all' ? 'selected' : ''}>All statuses</option>
            <option value="past_due" ${s.listStatusFilter === 'past_due' ? 'selected' : ''}>Past Due</option>
            ${['draft', 'sent', 'accepted', 'declined', 'expired', 'partially_paid', 'paid', 'issued'].map(v => `<option value="${v}" ${s.listStatusFilter === v ? 'selected' : ''}>${esc(labelize(v))}</option>`).join('')}
          </select>
          <select class="qt-select" onchange="qtSetListFilter('listClientFilter', this.value)">
            <option value="all" ${s.listClientFilter === 'all' ? 'selected' : ''}>All clients</option>
            ${s.clients.map(c => `<option value="${escAttr(String(c.id))}" ${String(s.listClientFilter) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="qtDocRowsWrap">${renderDocRowsInner()}</div>
    </div>`;
}

function renderDocRowsInner() {
  const s = state;
  const filtered = filteredDocuments();
  let html = `<div class="qt-doc-row-head">
      <div>Number</div><div>Type</div><div>Client</div><div>Status</div><div>Total</div><div>Date</div><div></div>
    </div>`;
  if (s.listLoading) return html + `<div class="qt-list-empty">Loading…</div>`;
  if (filtered.length === 0) return html + `<div class="qt-list-empty">No documents yet — save one from the editor.</div>`;
  html += filtered.map(d => {
    const pastDue = isPastDue(d);
    const pillLabel = pastDue ? 'Past Due' : labelize(d.status);
    const pillTone = pastDue ? 'danger' : statusTone(d.status);
    const dateLabel = d.doc_type === 'invoice' && d.due_date ? d.due_date : (d.doc_date || '');
    return `
    <div class="qt-doc-row" onclick="qtOpenDocument('${escAttr(String(d.id))}')">
      <div class="num">${esc(d.doc_number)}</div>
      <div class="type">${esc(d.doc_type)}</div>
      <div>${esc(d.client_name || '—')}</div>
      <div><span class="qt-status-pill tone-${pillTone}">${esc(pillLabel)}</span></div>
      <div>${fmt(d.total || 0)}</div>
      <div>${esc(dateLabel)}</div>
      <button type="button" class="qt-doc-row-delete" title="Delete" onclick="event.stopPropagation(); qtDeleteDocument('${escAttr(String(d.id))}')">&times;</button>
    </div>`;
  }).join('');
  return html;
}

function renderEditorView() {
  const s = state;
  const isQuote = s.mode === 'quote';
  const isInvoice = s.mode === 'invoice';
  const isReceipt = s.mode === 'receipt';
  const totals = computeTotals(s);
  const amountPaidNum = parseFloat(s.amountPaid) || 0;
  const balance = totals.afterDiscount - amountPaidNum;
  const isPaidInFull = !isQuote && balance <= 0.005;
  const isSaved = !!s.currentDocId;
  const docTitle = isQuote ? 'QUOTE' : (isInvoice ? 'INVOICE' : 'RECEIPT');
  const billToLabel = isQuote ? 'Prepared For' : (isInvoice ? 'Bill To' : 'Received From');
  const totalLineLabel = isQuote ? 'Estimated Total' : (isInvoice ? 'Balance Due' : 'Amount Received');
  const totalLineValue = isQuote ? fmt(totals.afterDiscount) : (isInvoice ? fmt(balance) : fmt(amountPaidNum));
  const statusOptions = statusListFor(s.mode);
  const showMarkPaid = !isQuote && !isPaidInFull && totals.afterDiscount > 0;
  const showRemainingNote = isReceipt && !isPaidInFull;
  const canConvertToInvoice = isQuote && isSaved;
  const canMarkPaidReceipt = isInvoice && isSaved && s.status !== 'paid';
  const needsSaveFirst = !isSaved && (isQuote || isInvoice);
  const notes = isQuote ? s.notesQuote : (isInvoice ? s.notesInvoice : s.notesReceipt);
  const notesField = isQuote ? 'notesQuote' : (isInvoice ? 'notesInvoice' : 'notesReceipt');
  const showTotalsBlock = !(isQuote && s.hideTotals);
  const summaryTopMargin = isQuote ? '12px' : '28px';

  return `
  <div id="docPage" class="qt-doc-page">
    <div class="qt-doc-head">
      <div class="qt-doc-brand">
        <img src="../assets/gg-shield.png" alt="Guardian Group">
        <div>
          <div class="qt-doc-brand-name">Guardian Group</div>
          <div class="qt-eyebrow" style="margin-top:2px;">Safety &amp; Leadership Solutions</div>
        </div>
      </div>
      <div class="qt-doc-meta">
        <div class="qt-doc-title">${docTitle}</div>
        <div class="qt-doc-meta-rows">
          <div class="qt-doc-meta-row"><span>No.</span><input class="qt-field-line" value="${escAttr(s.docNumber || '…')}" oninput="qtSetField('docNumber', this.value)"></div>
          <div class="qt-doc-meta-row"><span>Date</span><input class="qt-field-line" value="${escAttr(s.docDate)}" oninput="qtSetField('docDate', this.value)"></div>
          ${isQuote ? `<div class="qt-doc-meta-row"><span>Valid for</span><input class="qt-field-line" value="${escAttr(s.validFor)}" oninput="qtSetField('validFor', this.value)" placeholder="e.g. 14 days"></div>` : ''}
          ${isInvoice ? `<div class="qt-doc-meta-row"><span>Terms</span><input class="qt-field-line" value="${escAttr(s.dueTerms)}" oninput="qtSetField('dueTerms', this.value)" placeholder="e.g. Net 14"></div>` : ''}
          ${isInvoice ? `<div class="qt-doc-meta-row"><span>Due</span><input type="date" class="qt-field-line" value="${escAttr(s.dueDate)}" oninput="qtSetField('dueDate', this.value)"></div>` : ''}
          <div class="qt-doc-meta-row" data-noprint>
            <span>Status</span>
            <select class="qt-status-select" onchange="qtSetField('status', this.value); render();">
              ${statusOptions.map(v => `<option value="${v}" ${s.status === v ? 'selected' : ''}>${esc(labelize(v))}</option>`).join('')}
            </select>
          </div>
          <span data-printonly style="display:none;font-weight:600;color:var(--gg-dark);">${esc(labelize(s.status))}</span>
        </div>
      </div>
    </div>

    ${s.parentDocNumber ? `<div class="qt-parent-note">Converted from ${esc(s.parentDocNumber)}</div>` : ''}

    <div class="qt-parties">
      <div class="qt-party">
        <div class="qt-eyebrow">From</div>
        <div class="qt-party-name">Guardian Group</div>
        <input class="qt-field-line first" value="${escAttr(s.businessContactName)}" placeholder="Your name" oninput="qtSetField('businessContactName', this.value)">
        <input class="qt-field-line" value="${escAttr(s.businessPhone)}" placeholder="Phone number" oninput="qtSetField('businessPhone', this.value)">
        <input class="qt-field-line" value="${escAttr(s.businessEmail)}" placeholder="Email address" oninput="qtSetField('businessEmail', this.value)">
      </div>
      <div class="qt-party">
        <div class="qt-eyebrow">${esc(billToLabel)}</div>
        <select class="qt-field-line company" data-noprint onchange="qtSelectClientOption(this.value)">
          <option value="">— Select client —</option>
          ${s.clients.map(c => `<option value="${escAttr(String(c.id))}" ${String(s.clientCompanyId) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          <option value="__new__">+ Create New Client</option>
        </select>
        <div class="qt-field-line company" data-printonly style="display:none;">${esc(s.clientCompany || '—')}</div>
        <input class="qt-field-line first" id="qtClientPersonName" value="${escAttr(s.clientPersonName)}" placeholder="Contact name" oninput="qtSetField('clientPersonName', this.value)">
        <input class="qt-field-line" id="qtClientPhone" value="${escAttr(s.clientPhone)}" placeholder="Phone" oninput="qtSetField('clientPhone', this.value)">
        <input class="qt-field-line" id="qtClientEmail" value="${escAttr(s.clientEmail)}" placeholder="Email" oninput="qtSetField('clientEmail', this.value)">
      </div>
    </div>

    <div class="qt-items-wrap">
      ${s.items.map(it => renderItemRow(it)).join('')}
      <div class="qt-items-actions" data-noprint>
        <button class="qt-btn-dashed" onclick="qtAddItem()">+ Add line item</button>
        <select class="qt-select" onchange="qtPickCatalogItem(this.value)">
          <option value="">+ Add from saved items…</option>
          ${s.catalogItems.map(ci => `<option value="${escAttr(String(ci.id))}">${esc(ci.description + ' · ' + fmt(parseFloat(ci.rate) || 0))}</option>`).join('')}
        </select>
      </div>
    </div>

    ${isQuote ? `
    <div class="qt-hide-totals-row" data-noprint>
      <label class="qt-hide-totals-label">
        <input type="checkbox" ${s.hideTotals ? 'checked' : ''} onchange="qtSetHideTotals(this.checked)">
        Hide subtotal &amp; total <span style="color:var(--gg-pale);">(quoting more than one option)</span>
      </label>
    </div>` : ''}

    <div class="qt-totals-wrap" style="margin-top:${summaryTopMargin};">
      <div class="qt-totals-box">
        ${showTotalsBlock ? `
        <div class="qt-totals-line"><span>Subtotal</span><span id="qtSubtotal">${fmt(totals.subtotal)}</span></div>
        <div class="qt-totals-line">
          <span style="display:flex;align-items:center;gap:6px;">Discount
            <select class="qt-discount-select" data-noprint onchange="qtSetFieldRecalc('discountType', this.value)">
              <option value="$" ${s.discountType === '$' ? 'selected' : ''}>$</option>
              <option value="%" ${s.discountType === '%' ? 'selected' : ''}>%</option>
            </select>
          </span>
          <input class="qt-field-line" value="${escAttr(s.discountValue)}" oninput="qtSetFieldRecalc('discountValue', this.value)">
        </div>
        ${!isQuote ? `
        <div class="qt-totals-line with-border">
          <span>${isInvoice ? 'Deposit Paid' : 'Amount Received'}</span>
          <input class="qt-field-line paid" value="${escAttr(s.amountPaid)}" oninput="qtSetFieldRecalc('amountPaid', this.value)">
        </div>` : ''}
        <div class="qt-mark-paid-row" data-noprint id="qtMarkPaidRow" style="display:${showMarkPaid ? '' : 'none'};">
          <button class="qt-btn-text" onclick="qtMarkPaidInFull()">Mark deposit as paid in full</button>
        </div>
        <div class="qt-total-box" style="background:var(--gg-mid);">
          <span class="label">${esc(totalLineLabel)}</span>
          <span class="value" id="qtTotalValue">${totalLineValue}</span>
        </div>
        <div class="qt-paid-badge-row" id="qtPaidBadge" style="display:${isPaidInFull ? '' : 'none'};">
          <span class="qt-status-pill tone-open">Paid in full</span>
        </div>
        <div class="qt-balance-note" id="qtBalanceNote" style="display:${showRemainingNote ? '' : 'none'};">Balance remaining: ${fmt(balance)}</div>` : ''}
        ${!isQuote && isSaved ? `
        <div class="qt-paidvia-row">
          <span>Paid via</span>
          <div class="qt-paidvia-right">
            <select class="qt-select" data-noprint onchange="qtSetField('paymentMethod', this.value); render();">
              <option value="">Select method</option>
              <option value="cash" ${s.paymentMethod === 'cash' ? 'selected' : ''}>Cash</option>
              <option value="card" ${s.paymentMethod === 'card' ? 'selected' : ''}>Card</option>
              <option value="venmo" ${s.paymentMethod === 'venmo' ? 'selected' : ''}>Venmo</option>
              <option value="zelle" ${s.paymentMethod === 'zelle' ? 'selected' : ''}>Zelle</option>
              <option value="cashapp" ${s.paymentMethod === 'cashapp' ? 'selected' : ''}>Cash App</option>
              <option value="check" ${s.paymentMethod === 'check' ? 'selected' : ''}>Check</option>
              <option value="transfer" ${s.paymentMethod === 'transfer' ? 'selected' : ''}>Bank Transfer</option>
              <option value="other" ${s.paymentMethod === 'other' ? 'selected' : ''}>Other</option>
            </select>
            ${s.paymentMethod === 'other' ? `<input class="qt-field-line" data-noprint value="${escAttr(s.paymentMethodOther)}" placeholder="Specify" oninput="qtSetField('paymentMethodOther', this.value)">` : ''}
            <span data-printonly style="display:none;font-weight:600;color:var(--gg-dark);">${esc(paymentMethodLabel(s))}</span>
          </div>
        </div>
        <div class="qt-paidvia-row">
          <span>Date paid</span>
          <div class="qt-paidvia-right">
            <input type="date" class="qt-field-line" data-noprint value="${escAttr(s.datePaid)}" oninput="qtSetField('datePaid', this.value)">
            <span data-printonly style="display:none;font-weight:600;color:var(--gg-dark);">${esc(s.datePaid || '—')}</span>
          </div>
        </div>` : ''}
        ${canConvertToInvoice ? `<button class="qt-btn-cta-block" data-noprint onclick="qtConvertToInvoice()">Convert to Invoice →</button>` : ''}
        ${canMarkPaidReceipt ? `<button class="qt-btn-cta-block" data-noprint onclick="qtMarkPaidCreateReceipt()">Mark Paid &amp; Create Receipt →</button>` : ''}
        ${needsSaveFirst ? `<div class="qt-save-first-note" data-noprint>Save this document to convert it or record payment.</div>` : ''}
      </div>
    </div>

    <div class="qt-notes-block">
      <div class="qt-eyebrow">Payment Options &amp; Instructions</div>
      <textarea class="qt-field-area" rows="2" oninput="qtSetField('${notesField}', this.value)">${esc(notes)}</textarea>
    </div>

    <div class="qt-thankyou">
      <div class="qt-eyebrow">Thank you for being a part of Guardian Group</div>
    </div>
  </div>`;
}

function renderItemRow(it) {
  const isFlat = it.type === 'flat';
  const isHours = it.type === 'hours';
  const qty = parseFloat(it.qty) || 0;
  const rate = parseFloat(it.rate) || 0;
  const amount = isFlat ? rate : qty * rate;
  const qtyLabel = isHours ? 'HRS' : 'QTY';
  const rateLabel = isFlat ? 'PRICE' : (isHours ? 'RATE/HR' : 'UNIT PRICE');
  return `
    <div class="qt-item-row">
      ${QT_SHOW_ITEM_DATES ? `
      <div class="qt-item-col-date">
        <span class="qt-item-label">DATE</span>
        <input class="qt-field-line" value="${escAttr(it.date)}" placeholder="—" oninput="qtSetItemField(${it.id}, 'date', this.value)">
      </div>` : ''}
      <div class="qt-item-col-desc">
        <span class="qt-item-label">DESCRIPTION</span>
        <textarea class="qt-field-line desc" rows="1" placeholder="Service description — add extra lines for sub-items or details" oninput="qtAutosizeTextarea(this); qtSetItemField(${it.id}, 'description', this.value)">${esc(it.description)}</textarea>
        <button class="qt-item-save-cta" data-noprint title="Save as a reusable item" onclick="qtSaveItemToCatalog(${it.id})">+ Save as reusable item</button>
      </div>
      <select class="qt-item-type" data-noprint onchange="qtSetItemField(${it.id}, 'type', this.value); render();">
        <option value="flat" ${isFlat ? 'selected' : ''}>Flat price</option>
        <option value="qty" ${it.type === 'qty' ? 'selected' : ''}>Qty &times; price</option>
        <option value="hours" ${isHours ? 'selected' : ''}>Hours &times; rate</option>
      </select>
      ${!isFlat
        ? `<div class="qt-item-col-qty"><span class="qt-item-label">${qtyLabel}</span><input class="qt-field-line" style="text-align:center;" value="${escAttr(it.qty)}" oninput="qtSetItemField(${it.id}, 'qty', this.value)"></div>`
        : `<div style="width:50px;flex-shrink:0;"></div>`}
      <div class="qt-item-col-rate">
        <span class="qt-item-label">${rateLabel}</span>
        <input class="qt-field-line" data-noprint style="text-align:right;" value="${escAttr(it.rate)}" oninput="qtSetItemField(${it.id}, 'rate', this.value)">
        ${!isFlat ? `<span class="qt-field-line" data-printonly style="display:none;text-align:right;">${fmt(rate)}</span>` : ''}
      </div>
      <div class="qt-item-col-amount" id="qtAmt${it.id}">${fmt(amount)}</div>
      <button class="qt-item-remove" data-noprint onclick="qtRemoveItem(${it.id})">&times;</button>
    </div>`;
}

init();
