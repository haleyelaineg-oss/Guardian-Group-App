import { supabase } from '../../lib/supabase.js';

function fail(error) { if (error) throw error; }
export async function fetchGeneralExpenses() { const { data, error } = await supabase.from('expenses').select('*').order('incurred_on', { ascending: false }); fail(error); return data || []; }
export async function fetchAllExpenses() {
  const [general, eventLinked, receipts] = await Promise.all([
    supabase.from('expenses').select('*'),
    supabase.from('event_expenses').select('*,events!event_id(title,event_type)'),
    supabase.from('event_documents').select('expense_id').not('expense_id', 'is', null),
  ]);
  fail(general.error); fail(eventLinked.error); fail(receipts.error);
  const receiptExpenseIds = new Set((receipts.data || []).map((receipt) => receipt.expense_id));
  return [
    ...(general.data || []).map((expense) => ({ ...expense, source: 'general', related_record: 'General business' })),
    ...(eventLinked.data || []).map((expense) => ({ ...expense, source: 'event', related_record: expense.events?.title || 'Event record', event_type: expense.events?.event_type, has_receipt: receiptExpenseIds.has(expense.id) })),
  ].sort((a, b) => String(b.incurred_on || '').localeCompare(String(a.incurred_on || '')));
}
export async function fetchExpenseTargets() {
  const [events, trainings, speaking] = await Promise.all([
    supabase.from('events').select('id,title,event_type,starts_at').neq('status', 'cancelled').order('starts_at').limit(100),
    supabase.from('training_engagements').select('title,event_id').not('event_id', 'is', null),
    supabase.from('speaking_engagements').select('event_name,event_id').not('event_id', 'is', null),
  ]);
  fail(events.error); fail(trainings.error); fail(speaking.error);
  const targets = new Map((events.data || []).map((event) => [event.id, { id: event.id, label: `${event.title} · Event` }]));
  (trainings.data || []).forEach((training) => targets.set(training.event_id, { id: training.event_id, label: `${training.title} · Training` }));
  (speaking.data || []).forEach((engagement) => targets.set(engagement.event_id, { id: engagement.event_id, label: `${engagement.event_name} · Speaking engagement` }));
  return [...targets.values()].sort((a, b) => a.label.localeCompare(b.label));
}
export async function fetchFinancialOverview() { const [documents, incomes, links, paymentAllocations, expenses] = await Promise.all([supabase.from('documents').select('id,doc_type,doc_number,client_name,status,total,balance,amount_paid,doc_date,due_date,date_paid').order('created_at', { ascending: false }), supabase.from('income').select('id,amount,certainty_status,income_kind'), supabase.from('income_document_links').select('income_id,allocated_amount,documents(id,doc_type,status,due_date)'), supabase.from('payment_allocations').select('income_id,document_id,allocated_amount,payments(direction)'), supabase.from('expenses').select('amount,incurred_on')]); [documents, incomes, links, paymentAllocations, expenses].forEach((result) => fail(result.error)); return { documents: documents.data || [], incomes: incomes.data || [], links: links.data || [], paymentAllocations: paymentAllocations.data || [], expenses: expenses.data || [] }; }
export async function createGeneralExpense(values) { const { error } = await supabase.from('expenses').insert(values); fail(error); }
export async function updateGeneralExpense(id, values) { const { error } = await supabase.from('expenses').update(values).eq('id', id); fail(error); }
export async function deleteGeneralExpense(id) { const { error } = await supabase.from('expenses').delete().eq('id', id); fail(error); }
export async function fetchIncomeSources() { const [invoices, events, itinerary, manual] = await Promise.all([supabase.from('documents').select('id,doc_number,client_name,status,balance,due_date').eq('doc_type', 'invoice').gt('balance', 0), supabase.from('events').select('id,title,status,starts_at,income_amount').not('income_amount', 'is', null), supabase.from('event_itinerary_items').select('id,title,income_amount,income_source,starts_at,event_id,events!event_id(status)').not('income_amount', 'is', null), supabase.from('income').select('*').order('expected_on', { ascending: true })]); [invoices, events, itinerary, manual].forEach((result) => fail(result.error)); return { invoices: invoices.data || [], events: events.data || [], itinerary: itinerary.data || [], manual: manual.data || [] }; }
export async function createIncome(values) { const { error } = await supabase.from('income').insert(values); fail(error); }
export async function updateIncome(id, values) { const { error } = await supabase.from('income').update(values).eq('id', id); fail(error); }
export async function deleteIncome(id) { const { error } = await supabase.from('income').delete().eq('id', id); fail(error); }
