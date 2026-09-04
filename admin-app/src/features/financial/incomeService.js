import { supabase } from '../../lib/supabase.js';

function fail(error) { if (error) throw error; }

export async function fetchIncomeWorkspace() {
  const [incomes, links, allocations, candidates, companies, events, trainings, speaking, itinerary] = await Promise.all([
    supabase.from('income').select('*').order('expected_on', { ascending: true }),
    supabase.from('income_document_links').select('income_id,allocated_amount,documents(id,doc_number,doc_type,status,due_date,total,client_name)'),
    supabase.from('payment_allocations').select('income_id,document_id,allocated_amount,payments(direction,received_at,payment_method)'),
    supabase.from('income_reconciliation_candidates').select('id,left_income_id,right_income_id,match_basis,status,notes').eq('status', 'pending'),
    supabase.from('companies').select('id,name').order('name'),
    supabase.from('events').select('id,title,event_type,starts_at').order('starts_at', { ascending: false }),
    supabase.from('training_engagements').select('id,title,starts_at').order('starts_at', { ascending: false }),
    supabase.from('speaking_engagements').select('id,event_name,event_start_date').order('event_start_date', { ascending: false }),
    supabase.from('event_itinerary_items').select('id,title,starts_at').order('starts_at', { ascending: false }),
  ]);
  [incomes, links, allocations, candidates, companies, events, trainings, speaking, itinerary].forEach((result) => fail(result.error));
  return { incomes: incomes.data || [], links: links.data || [], allocations: allocations.data || [], candidates: candidates.data || [], companies: companies.data || [], events: events.data || [], trainings: trainings.data || [], speaking: speaking.data || [], itinerary: itinerary.data || [] };
}

export async function createCanonicalIncome(values) { const { data, error } = await supabase.from('income').insert(values).select().single(); fail(error); return data; }
export async function updateCanonicalIncome(id, values) { const { error } = await supabase.from('income').update(values).eq('id', id); fail(error); }
export async function resolveCandidate(id, status) {
  if (status !== 'same_income') { const { error } = await supabase.from('income_reconciliation_candidates').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id); fail(error); return; }
  const { data: candidate, error: candidateError } = await supabase.from('income_reconciliation_candidates').select('left_income_id,right_income_id').eq('id', id).single(); fail(candidateError);
  const { data: records, error: recordsError } = await supabase.from('income').select('id,source_type,notes').in('id', [candidate.left_income_id, candidate.right_income_id]); fail(recordsError);
  const left = records.find((record) => record.id === candidate.left_income_id);
  const right = records.find((record) => record.id === candidate.right_income_id);
  const primary = left.source_type !== 'manual' && right.source_type === 'manual' ? left : right.source_type !== 'manual' && left.source_type === 'manual' ? right : left;
  const duplicate = primary.id === left.id ? right : left;
  const { data: links, error: linksError } = await supabase.from('income_document_links').select('id,document_id').eq('income_id', duplicate.id); fail(linksError);
  for (const link of links || []) {
    const { data: existing, error: existingError } = await supabase.from('income_document_links').select('id').eq('income_id', primary.id).eq('document_id', link.document_id).maybeSingle(); fail(existingError);
    if (existing) { const { error } = await supabase.from('income_document_links').delete().eq('id', link.id); fail(error); } else { const { error } = await supabase.from('income_document_links').update({ income_id: primary.id }).eq('id', link.id); fail(error); }
  }
  const { error: paymentError } = await supabase.from('payment_allocations').update({ income_id: primary.id }).eq('income_id', duplicate.id); fail(paymentError);
  const { error: retireError } = await supabase.from('income').update({ certainty_status: 'cancelled', notes: `${duplicate.notes || ''}\nMerged into Income ${primary.id} during reconciliation.`.trim() }).eq('id', duplicate.id); fail(retireError);
  const { error } = await supabase.from('income_reconciliation_candidates').update({ status, reviewed_at: new Date().toISOString(), notes: `Merged into ${primary.id}` }).eq('id', id); fail(error);
}

export async function recordIncomePayment({ incomeId, documentId, amount, receivedAt, paymentMethod, reference, notes }) {
  const { data: payment, error } = await supabase.from('payments').insert({ amount, received_at: receivedAt, payment_method: paymentMethod || null, reference: reference || null, notes: notes || null }).select('id').single();
  fail(error);
  const { error: allocationError } = await supabase.from('payment_allocations').insert({ payment_id: payment.id, income_id: incomeId, document_id: documentId || null, allocated_amount: amount });
  if (allocationError) { await supabase.from('payments').delete().eq('id', payment.id); fail(allocationError); }
}
