// ============================================================
// GUARDIAN GROUP — quote-tool.js
// Quote / Invoice / Receipt tool. Gated by a team passphrase
// checked against its own Supabase project (separate from the
// main survey/workshops backend). Vanilla JS port of the
// approved Claude Design build.
// ============================================================

const QT_SUPABASE_URL = 'https://gymrzsyrrjuyfnbnhzsk.supabase.co';
const QT_SUPABASE_KEY = 'sb_publishable_8n3FBcV6i-0w3NnES4_TpQ_SEHNwKo_';
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
function statusListFor(mode) {
  if (mode === 'quote') return ['draft', 'sent', 'accepted', 'declined', 'expired'];
  if (mode === 'invoice') return ['draft', 'sent', 'partially_paid', 'paid', 'overdue'];
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
  checkingGate: true,
  unlocked: false,
  gatePasswordInput: '',
  gateError: '',

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
  paymentMethod: '',
  paymentMethodOther: '',
  businessContactName: '',
  businessPhone: '',
  businessEmail: '',
  clientId: null,
  clientCompany: '',
  clientPersonName: '',
  clientEmail: '',
  clientPhone: '',
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
  listStatusFilter: 'all'
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

// ── Gate / auth ──────────────────────────────────────────────

function buildClient(pw) {
  sb = window.supabase.createClient(QT_SUPABASE_URL, QT_SUPABASE_KEY, {
    global: { headers: { 'x-app-key': pw } }
  });
}

async function verifyAndUnlock(pw, fromStored) {
  buildClient(pw);
  state.checkingGate = true;
  state.gateError = '';
  render();
  try {
    const { data, error } = await sb.rpc('has_app_key');
    if (error) throw error;
    if (data === true) {
      try { localStorage.setItem('gg_qt_app_pw_v1', pw); } catch (e) {}
      state.unlocked = true;
      state.checkingGate = false;
      state.gateError = '';
      render();
      loadClients();
      loadCatalog();
      resetToBlank('quote');
    } else {
      try { localStorage.removeItem('gg_qt_app_pw_v1'); } catch (e) {}
      state.unlocked = false;
      state.checkingGate = false;
      state.gateError = fromStored ? '' : 'Incorrect passphrase.';
      render();
    }
  } catch (e) {
    state.unlocked = false;
    state.checkingGate = false;
    state.gateError = 'Connection error — try again.';
    render();
  }
}

function qtSubmitGate(e) {
  if (e && e.preventDefault) e.preventDefault();
  verifyAndUnlock(state.gatePasswordInput, false);
}

function init() {
  render();
  let biz = {};
  try { biz = JSON.parse(localStorage.getItem('gg_qt_business_info_v1') || '{}'); } catch (e) {}
  if (biz.businessContactName) state.businessContactName = biz.businessContactName;
  if (biz.businessPhone) state.businessPhone = biz.businessPhone;
  if (biz.businessEmail) state.businessEmail = biz.businessEmail;

  let pw = '';
  try { pw = localStorage.getItem('gg_qt_app_pw_v1') || ''; } catch (e) {}
  if (pw) {
    verifyAndUnlock(pw, true);
  } else {
    state.checkingGate = false;
    render();
  }
}

// ── Data loading ─────────────────────────────────────────────

async function loadClients() {
  if (!sb) return;
  const { data } = await sb.from('clients').select('id,name,contact_name,phone,email,notes').order('name');
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
    .select('id,doc_type,doc_number,status,client_name,total,doc_date,created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  state.listLoading = false;
  state.documentsList = data || [];
  renderDocRows();
}
function qtOpenDocumentsList() {
  state.view = 'list';
  render();
  loadDocumentsList();
}
function qtBackToEditor() {
  state.view = 'editor';
  render();
}

// ── Client / catalog interactions ───────────────────────────

function qtClientCompanyInput(value) {
  state.clientCompany = value;
  const match = state.clients.find(c => c.name.toLowerCase() === value.trim().toLowerCase());
  state.clientId = match ? match.id : null;
  if (match) {
    if (!state.clientPersonName && match.contact_name) {
      state.clientPersonName = match.contact_name;
      const el = document.getElementById('qtClientPersonName'); if (el) el.value = match.contact_name;
    }
    if (!state.clientPhone && match.phone) {
      state.clientPhone = match.phone;
      const el = document.getElementById('qtClientPhone'); if (el) el.value = match.phone;
    }
    if (!state.clientEmail && match.email) {
      state.clientEmail = match.email;
      const el = document.getElementById('qtClientEmail'); if (el) el.value = match.email;
    }
  }
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
  const name = (state.clientCompany || '').trim();
  if (!name || !sb) return state.clientId || null;
  const existing = state.clients.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    const patch = {};
    if (state.clientPersonName && !existing.contact_name) patch.contact_name = state.clientPersonName;
    if (state.clientPhone && !existing.phone) patch.phone = state.clientPhone;
    if (state.clientEmail && !existing.email) patch.email = state.clientEmail;
    if (Object.keys(patch).length) {
      await sb.from('clients').update(patch).eq('id', existing.id);
      Object.assign(existing, patch);
    }
    return existing.id;
  }
  const { data, error } = await sb.from('clients').insert({
    name: name, contact_name: state.clientPersonName || '', phone: state.clientPhone || '', email: state.clientEmail || ''
  }).select('id,name,contact_name,phone,email,notes').single();
  if (!error && data) { state.clients.push(data); return data.id; }
  return null;
}

// ── Document CRUD ────────────────────────────────────────────

function buildDocPayload(totals) {
  const s = state;
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
    business_contact_name: s.businessContactName,
    business_phone: s.businessPhone,
    business_email: s.businessEmail,
    doc_date: s.docDate,
    valid_for: s.mode === 'quote' ? s.validFor : null,
    due_terms: s.mode === 'invoice' ? s.dueTerms : null,
    payment_method: s.mode === 'receipt' ? s.paymentMethod : null,
    payment_method_other: s.mode === 'receipt' ? s.paymentMethodOther : null,
    items: s.items,
    discount_type: s.discountType,
    discount_value: parseFloat(s.discountValue) || 0,
    subtotal: totals.subtotal,
    discount_amount: totals.discountAmount,
    total: totals.afterDiscount,
    amount_paid: amountPaidNum,
    balance: balance,
    notes: s.mode === 'quote' ? s.notesQuote : (s.mode === 'invoice' ? s.notesInvoice : s.notesReceipt),
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
    paymentMethod: data.payment_method || '',
    paymentMethodOther: data.payment_method_other || '',
    businessContactName: data.business_contact_name || state.businessContactName,
    businessPhone: data.business_phone || state.businessPhone,
    businessEmail: data.business_email || state.businessEmail,
    clientId: data.client_id,
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
    const payload = Object.assign({}, buildDocPayload(totals), {
      doc_type: 'invoice',
      doc_number: numData,
      status: 'draft',
      due_terms: 'Net 14',
      valid_for: null,
      payment_method: null,
      payment_method_other: null,
      doc_date: formatToday(),
      amount_paid: 0,
      balance: totals.afterDiscount,
      notes: state.notesInvoice,
      parent_doc_id: state.currentDocId,
      client_id: state.clientId
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
      docDate: formatToday(),
      dueTerms: 'Net 14',
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
  state.saving = true;
  render();
  try {
    const totals = computeTotals(state);
    const fullAmount = totals.afterDiscount;
    await sb.from('documents').update({ status: 'paid', amount_paid: fullAmount, balance: 0 }).eq('id', state.currentDocId);
    const { data: numData, error: numErr } = await sb.rpc('next_doc_number', { p_type: 'receipt' });
    if (numErr) throw numErr;
    const payload = Object.assign({}, buildDocPayload(totals), {
      doc_type: 'receipt',
      doc_number: numData,
      status: 'issued',
      due_terms: null,
      valid_for: null,
      payment_method: '',
      payment_method_other: '',
      doc_date: formatToday(),
      amount_paid: fullAmount,
      balance: 0,
      notes: state.notesReceipt,
      parent_doc_id: state.currentDocId,
      client_id: state.clientId
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
      paymentMethod: '',
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
    currentDocId: null,
    parentDocId: null,
    parentDocNumber: null,
    mode: mode,
    status: 'draft',
    docNumber: '',
    docDate: formatToday(),
    validFor: '14 days',
    dueTerms: 'Net 14',
    paymentMethod: '',
    paymentMethodOther: '',
    clientId: null,
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

function qtSetMode(mode) {
  if (mode !== state.mode) resetToBlank(mode);
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

function filteredDocuments() {
  const s = state;
  return s.documentsList
    .filter(d => s.listTypeFilter === 'all' || d.doc_type === s.listTypeFilter)
    .filter(d => s.listStatusFilter === 'all' || d.status === s.listStatusFilter)
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
  const s = state;
  if (s.checkingGate) return renderChecking();
  if (!s.unlocked) return renderGate();
  return renderUnlocked();
}

function renderChecking() {
  return `<div class="qt-gate-wrap" style="color:var(--gg-muted);font-size:14px;">Loading…</div>`;
}

function renderGate() {
  const s = state;
  return `
    <div class="qt-gate-wrap">
      <form class="qt-gate-card" onsubmit="qtSubmitGate(event)">
        <img src="../assets/gg-shield.png" alt="" style="width:48px;height:48px;margin:0 auto 16px;display:block;">
        <div style="font-family:var(--font-display);font-weight:700;font-size:20px;color:var(--gg-dark);text-transform:uppercase;margin-bottom:4px;">Guardian Group</div>
        <div style="font-size:13px;color:var(--gg-muted);margin-bottom:20px;line-height:1.5;">Enter the team passphrase to open the quote, invoice &amp; receipt tool.</div>
        <input type="password" class="qt-gate-input" value="${escAttr(s.gatePasswordInput)}" oninput="qtSetField('gatePasswordInput', this.value)" placeholder="Passphrase">
        ${s.gateError ? `<div class="qt-gate-error">${esc(s.gateError)}</div>` : ''}
        <button type="submit" class="qt-btn qt-btn-primary" style="width:100%;padding:12px;">Unlock</button>
      </form>
    </div>`;
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
          <button class="qt-btn qt-btn-ghost" onclick="${isListView ? 'qtBackToEditor()' : 'qtOpenDocumentsList()'}">${isListView ? '← Back to Editor' : 'All Documents'}</button>
          ${isEditorView ? renderModeTabsAndActions() : ''}
        </div>
      </div>
      <div class="qt-subbar" data-noprint>
        <div class="qt-helper-text" id="qtHelperText">${esc(s.saveMessage || 'Click any field to edit it directly, then print to save a PDF.')}</div>
        ${isEditorView ? `<button class="qt-btn qt-btn-dark" onclick="qtSaveDocument()">${s.saving ? 'Saving…' : 'Save'}</button>` : ''}
      </div>
      ${isListView ? renderListView() : ''}
      ${isEditorView ? renderEditorView() : ''}
    </div>`;
}

function renderModeTabsAndActions() {
  const s = state;
  return `
    <div class="qt-mode-tabs">
      <button class="qt-mode-tab ${s.mode === 'quote' ? 'active' : ''}" onclick="qtSetMode('quote')">Quote</button>
      <button class="qt-mode-tab ${s.mode === 'invoice' ? 'active' : ''}" onclick="qtSetMode('invoice')">Invoice</button>
      <button class="qt-mode-tab ${s.mode === 'receipt' ? 'active' : ''}" onclick="qtSetMode('receipt')">Receipt</button>
    </div>
    <button class="qt-btn qt-btn-muted" onclick="qtNewDocument()">New</button>
    <button class="qt-btn qt-btn-primary" onclick="qtPrintDoc()">Print / Save PDF</button>`;
}

function renderListView() {
  const s = state;
  return `
    <div id="listPage" class="qt-list-page">
      <div class="qt-list-header">
        <div class="qt-list-title">All Documents</div>
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
            ${['draft', 'sent', 'accepted', 'declined', 'expired', 'partially_paid', 'paid', 'overdue', 'issued'].map(v => `<option value="${v}" ${s.listStatusFilter === v ? 'selected' : ''}>${esc(labelize(v))}</option>`).join('')}
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
      <div>Number</div><div>Type</div><div>Client</div><div>Status</div><div>Total</div><div>Date</div>
    </div>`;
  if (s.listLoading) return html + `<div class="qt-list-empty">Loading…</div>`;
  if (filtered.length === 0) return html + `<div class="qt-list-empty">No documents yet — save one from the editor.</div>`;
  html += filtered.map(d => `
    <div class="qt-doc-row" onclick="qtOpenDocument('${escAttr(String(d.id))}')">
      <div class="num">${esc(d.doc_number)}</div>
      <div class="type">${esc(d.doc_type)}</div>
      <div>${esc(d.client_name || '—')}</div>
      <div><span class="qt-status-pill tone-${statusTone(d.status)}">${esc(labelize(d.status))}</span></div>
      <div>${fmt(d.total || 0)}</div>
      <div>${esc(d.doc_date || '')}</div>
    </div>`).join('');
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
        <input class="qt-field-line company" list="qtClientNamesList" value="${escAttr(s.clientCompany)}" placeholder="Company name" oninput="qtClientCompanyInput(this.value)">
        <datalist id="qtClientNamesList">
          ${s.clients.map(c => `<option value="${escAttr(c.name)}"></option>`).join('')}
        </datalist>
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
        ${isReceipt ? `
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
      <div class="qt-item-col-rate" data-noprint>
        <span class="qt-item-label">${rateLabel}</span>
        <input class="qt-field-line" style="text-align:right;" value="${escAttr(it.rate)}" oninput="qtSetItemField(${it.id}, 'rate', this.value)">
      </div>
      <div class="qt-item-col-amount" id="qtAmt${it.id}">${fmt(amount)}</div>
      <button class="qt-item-remove" data-noprint onclick="qtRemoveItem(${it.id})">&times;</button>
    </div>`;
}

init();
