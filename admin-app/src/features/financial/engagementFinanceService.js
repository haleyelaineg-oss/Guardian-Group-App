import { supabase } from '../../lib/supabase.js';
import { recordIncomePayment } from './incomeService.js';

const sourceField = { event: 'event_id', training: 'training_engagement_id', speaking: 'speaking_engagement_id' };
const number = (value) => Number(value || 0);
function fail(error) { if (error) throw error; }

export async function loadEngagementFinance({ sourceType, sourceId }) {
  const field = sourceField[sourceType];
  if (!field || !sourceId) return { income: null, links: [], allocations: [] };
  const { data: incomes, error } = await supabase.from('income').select('*').eq(field, sourceId).eq('income_kind', 'service_revenue').neq('certainty_status', 'cancelled').order('created_at');
  fail(error);
  if ((incomes || []).length > 1) return { income: null, links: [], allocations: [], ambiguous: incomes };
  const income = incomes?.[0] || null;
  if (!income) return { income: null, links: [], allocations: [], ambiguous: [] };
  const [links, allocations] = await Promise.all([
    supabase.from('income_document_links').select('income_id,allocated_amount,documents(id,doc_number,doc_type,status,due_date,total)').eq('income_id', income.id),
    supabase.from('payment_allocations').select('income_id,document_id,allocated_amount,payments(direction,received_at,payment_method,reference)').eq('income_id', income.id),
  ]);
  fail(links.error); fail(allocations.error);
  return { income, links: links.data || [], allocations: allocations.data || [], ambiguous: [] };
}

export async function saveEngagementValue({ sourceType, sourceId, companyId, title, amount, certaintyStatus, expectedOn }) {
  const field = sourceField[sourceType];
  if (!field || !sourceId) throw new Error('Save the engagement before setting its value.');
  const current = await loadEngagementFinance({ sourceType, sourceId });
  if (current.ambiguous.length) throw new Error('This engagement has multiple active service-revenue records. Resolve them in Income before changing its value.');
  const payload = { amount: number(amount), certainty_status: certaintyStatus, company_id: companyId || null, description: title || 'Engagement value', expected_on: expectedOn || null };
  if (current.income) {
    const { error } = await supabase.from('income').update(payload).eq('id', current.income.id); fail(error);
    return current.income.id;
  }
  const { data, error } = await supabase.from('income').insert({ ...payload, income_kind: 'service_revenue', source_type: sourceType, [field]: sourceId }).select('id').single();
  fail(error); return data.id;
}

export async function recordEngagementPayment({ incomeId, documentId, amount, receivedAt, paymentMethod, reference, notes }) {
  return recordIncomePayment({ incomeId, documentId, amount, receivedAt, paymentMethod, reference, notes });
}

export function engagementTotals(finance) {
  const income = finance.income;
  const invoiceLinks = (finance.links || []).filter((link) => link.documents?.doc_type === 'invoice' && link.documents?.status !== 'draft');
  const invoiced = invoiceLinks.reduce((sum, link) => sum + number(link.allocated_amount), 0);
  const received = (finance.allocations || []).reduce((sum, allocation) => sum + (allocation.payments?.direction === 'refund' ? -1 : 1) * number(allocation.allocated_amount), 0);
  return { invoiced, received, remaining: Math.max(0, number(income?.amount) - received), uninvoiced: Math.max(0, number(income?.amount) - invoiced) };
}
