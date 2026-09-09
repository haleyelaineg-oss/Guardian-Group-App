import { supabase } from '../../lib/supabase.js';
import { createExpense } from '../events/eventResourcesService.js';
import { createGeneralExpense, fetchExpenseTargets } from '../financial/financialService.js';

function fail(error) { if (error) throw error; }

export async function fetchReceiptInbox() {
  const { data, error } = await supabase.from('receipt_inbox').select('*').is('processed_at', null).order('created_at', { ascending: false });
  fail(error);
  return data || [];
}

export async function fetchExpenseChoices() {
  const { data, error } = await supabase.from('event_expenses').select('id,event_id,description,amount,events!event_id(title)').order('created_at', { ascending: false });
  fail(error);
  return data || [];
}

export async function fetchReceiptEvents() { return fetchExpenseTargets(); }

export async function createReceiptExpense(eventId, values) {
  return createExpense(eventId, { category: 'other_business_expense', expense_type: 'other', status: 'paid', reimbursable: false, reimbursement_status: 'not_applicable', reimbursement_amount: 0, ...values });
}

export async function createGeneralReceiptExpense(values) {
  return createGeneralExpense(values);
}

export async function uploadInboxReceipt(file) {
  const path = `unprocessed/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('receipt-inbox').upload(path, file);
  fail(uploadError);
  const { error } = await supabase.from('receipt_inbox').insert({ file_name: file.name, file_size: file.size, storage_path: path });
  if (error) {
    await supabase.storage.from('receipt-inbox').remove([path]);
    throw error;
  }
}

export async function getInboxReceiptUrl(path) {
  const { data, error } = await supabase.storage.from('receipt-inbox').createSignedUrl(path, 300);
  fail(error);
  return data.signedUrl;
}

export async function deleteInboxReceipt(receipt) {
  const { error } = await supabase.from('receipt_inbox').delete().eq('id', receipt.id);
  fail(error);
  const { error: storageError } = await supabase.storage.from('receipt-inbox').remove([receipt.storage_path]);
  fail(storageError);
}

export async function processInboxReceipt(receipt, expense) {
  const destination = `${expense.event_id}/${crypto.randomUUID()}-${receipt.file_name}`;
  const url = await getInboxReceiptUrl(receipt.storage_path);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not read the receipt for processing.');
  const { error: uploadError } = await supabase.storage.from('event-documents').upload(destination, await response.blob());
  fail(uploadError);
  const { error: documentError } = await supabase.from('event_documents').insert({ event_id: expense.event_id, expense_id: expense.id, file_name: receipt.file_name, file_size: receipt.file_size, storage_path: destination, notes: 'Processed from Receipt Inbox' });
  if (documentError) {
    await supabase.storage.from('event-documents').remove([destination]);
    throw documentError;
  }
  await deleteInboxReceipt(receipt);
}

export async function processGeneralInboxReceipt(receipt, expense) {
  const { error } = await supabase.from('receipt_inbox').update({ general_expense_id: expense.id, processed_at: new Date().toISOString() }).eq('id', receipt.id);
  fail(error);
}
