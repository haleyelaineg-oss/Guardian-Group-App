// Shared event-level financial math. Dashboard/Financial Overview can use
// the same helpers later instead of re-deriving totals in each view.
const number = (value) => Number(value) || 0;
// A reimbursement is recorded for audit/history, but it is no longer an
// out-of-pocket cost once it has been received.
export const isReimbursedExpense = (expense = {}) => expense.status === 'reimbursed'
  || (expense.reimbursable && expense.reimbursement_status === 'reimbursed');
export const totalExpenses = (expenses = []) => expenses
  .filter((expense) => !isReimbursedExpense(expense))
  .reduce((sum, expense) => sum + number(expense.amount), 0);
export const pendingReimbursements = (expenses = []) => expenses
  .filter((expense) => expense.reimbursable && expense.reimbursement_status === 'submitted' && !isReimbursedExpense(expense))
  .reduce((sum, expense) => sum + number(expense.amount), 0);
export const eventFinancialSummary = (incomeAmount, expenses = []) => {
  const income = number(incomeAmount); const spent = totalExpenses(expenses);
  return { income, expenses: spent, net: income - spent, pendingReimbursement: pendingReimbursements(expenses) };
};

export function revenueSummary({ invoices = [], events = [], itinerary = [], manual = [] }) {
  let booked = 0; let earned = 0; let accountsReceivable = 0; let collected = 0;
  invoices.forEach((invoice) => { const total = number(invoice.total); booked += total; collected += number(invoice.amount_paid); if (invoice.status !== 'draft') earned += total; if (invoice.status !== 'paid') accountsReceivable += number(invoice.balance); });
  events.forEach((event) => { if (['cancelled', 'application_denied'].includes(event.status)) return; const amount = number(event.income_amount); booked += amount; if (event.status === 'completed') earned += amount; });
  itinerary.forEach((item) => { if (['cancelled', 'application_denied'].includes(item.events?.status)) return; const amount = number(item.income_amount); booked += amount; if (item.events?.status === 'completed') earned += amount; });
  manual.forEach((item) => { const amount = number(item.amount); booked += amount; if (item.status === 'received') { earned += amount; collected += amount; } });
  return { booked, earned, accountsReceivable, collected };
}

export function arAging(invoices = [], today = new Date()) {
  const iso = (date) => date.toISOString().slice(0, 10); const days = (count) => { const d = new Date(today); d.setDate(d.getDate() + count); return iso(d); }; const todayIso = iso(today);
  const buckets = Object.fromEntries(['open', 'within7', 'within14', 'within30', 'pastDue'].map((key) => [key, { count: 0, amount: 0 }]));
  invoices.forEach((invoice) => { if (invoice.status === 'paid') return; const amount = number(invoice.balance); buckets.open.count++; buckets.open.amount += amount; if (invoice.due_date && invoice.due_date < todayIso) { buckets.pastDue.count++; buckets.pastDue.amount += amount; return; } if (invoice.due_date && invoice.due_date <= days(7)) { buckets.within7.count++; buckets.within7.amount += amount; } if (invoice.due_date && invoice.due_date <= days(14)) { buckets.within14.count++; buckets.within14.amount += amount; } if (invoice.due_date && invoice.due_date <= days(30)) { buckets.within30.count++; buckets.within30.amount += amount; } });
  return buckets;
}

export function expensePeriodTotals(expenses = [], today = new Date()) { const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`; const year = `${today.getFullYear()}-01-01`; return expenses.reduce((totals, expense) => ({ mtd: totals.mtd + (expense.incurred_on >= month ? number(expense.amount) : 0), ytd: totals.ytd + (expense.incurred_on >= year ? number(expense.amount) : 0) }), { mtd: 0, ytd: 0 }); }

export function normalizeIncomeSources({ invoices = [], events = [], itinerary = [], manual = [] }) {
  const rows = [
    ...invoices.map((item) => ({ id: item.id, source: 'invoice', label: 'Invoice', description: item.doc_number ? `${item.doc_number} — ${item.client_name || 'Unnamed client'}` : item.client_name || 'Unnamed client', expectedOn: item.due_date, amount: number(item.balance), status: 'expected', action: { type: 'invoice', id: item.id } })),
    ...events.filter((item) => item.status !== 'cancelled').map((item) => ({ id: item.id, source: 'event', label: 'Event', description: item.title, expectedOn: item.starts_at?.slice(0, 10), amount: number(item.income_amount), status: 'expected', action: { type: 'event', id: item.id } })),
    ...itinerary.filter((item) => item.events?.status !== 'cancelled').map((item) => ({ id: item.id, source: 'event', label: 'Itinerary', description: item.income_source ? `${item.title} — ${item.income_source}` : item.title, expectedOn: item.starts_at?.slice(0, 10), amount: number(item.income_amount), status: 'expected', action: { type: 'event', id: item.event_id } })),
    ...manual.map((item) => ({ id: item.id, source: 'manual', label: item.category.replaceAll('_', ' '), description: item.description, expectedOn: item.expected_on, amount: number(item.amount), status: item.status, action: { type: 'manual', id: item.id } })),
  ];
  return rows.sort((a, b) => (a.expectedOn || '9999-12-31').localeCompare(b.expectedOn || '9999-12-31'));
}

export function canonicalIncomeSummary({ incomes = [], links = [], paymentAllocations = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const active = incomes.filter((income) => income.certainty_status !== 'cancelled');
  const service = active.filter((income) => income.income_kind === 'service_revenue');
  const paymentAmount = (incomeId, documentId) => paymentAllocations.filter((allocation) => allocation.income_id === incomeId && (!documentId || allocation.document_id === documentId)).reduce((sum, allocation) => sum + (allocation.payments?.direction === 'refund' ? -1 : 1) * number(allocation.allocated_amount), 0);
  const activeIds = new Set(active.map((income) => income.id));
  const invoiceLinks = links.filter((link) => activeIds.has(link.income_id) && link.documents?.doc_type === 'invoice' && link.documents?.status !== 'draft');
  const confirmed = service.filter((income) => income.certainty_status === 'confirmed').reduce((sum, income) => sum + number(income.amount), 0);
  const potential = service.filter((income) => income.certainty_status === 'potential').reduce((sum, income) => sum + number(income.amount), 0);
  const invoiced = invoiceLinks.reduce((sum, link) => sum + number(link.allocated_amount), 0);
  const received = active.reduce((sum, income) => sum + paymentAmount(income.id), 0);
  const notInvoiced = active.filter((income) => income.certainty_status === 'confirmed').reduce((sum, income) => sum + Math.max(0, number(income.amount) - invoiceLinks.filter((link) => link.income_id === income.id).reduce((billed, link) => billed + number(link.allocated_amount), 0)), 0);
  const receivable = invoiceLinks.reduce((sum, link) => sum + Math.max(0, number(link.allocated_amount) - paymentAmount(link.income_id, link.documents.id)), 0);
  const overdue = invoiceLinks.filter((link) => link.documents?.due_date && link.documents.due_date < today).reduce((sum, link) => sum + Math.max(0, number(link.allocated_amount) - paymentAmount(link.income_id, link.documents.id)), 0);
  return { potential, confirmed, notInvoiced, invoiced, received, receivable, overdue };
}
