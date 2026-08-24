import { supabase } from '../../lib/supabase.js';

function throwIfError(error) { if (error) throw error; }

export async function fetchExpenses(eventId) {
  const { data, error } = await supabase.from('event_expenses').select('*').eq('event_id', eventId).order('incurred_on', { ascending: false, nullsFirst: false });
  throwIfError(error); return data || [];
}
export async function createExpense(eventId, values) {
  const { data, error } = await supabase.from('event_expenses').insert({ ...values, event_id: eventId }).select().single();
  throwIfError(error); return data;
}
export async function updateExpense(id, values) { const { error } = await supabase.from('event_expenses').update(values).eq('id', id); throwIfError(error); }
export async function deleteExpense(id) { const { error } = await supabase.from('event_expenses').delete().eq('id', id); throwIfError(error); }

export async function fetchItinerary(eventId) {
  const { data, error } = await supabase.from('event_itinerary_items').select('*').eq('event_id', eventId).order('starts_at', { ascending: true, nullsFirst: false });
  throwIfError(error); return data || [];
}
export async function createItineraryItem(eventId, values) {
  const { data, error } = await supabase.from('event_itinerary_items').insert({ ...values, item_type: values.item_type?.replaceAll(' ', '_'), event_id: eventId }).select().single();
  throwIfError(error); return data;
}
export async function updateItineraryItem(id, values) { const { error } = await supabase.from('event_itinerary_items').update(values).eq('id', id); throwIfError(error); }
export async function deleteItineraryItem(id) { const { error } = await supabase.from('event_itinerary_items').delete().eq('id', id); throwIfError(error); }

export async function fetchDocuments(eventId) {
  const { data, error } = await supabase.from('event_documents').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  throwIfError(error); return data || [];
}
export async function uploadDocument(eventId, file, values = {}) {
  const path = `${eventId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('event-documents').upload(path, file);
  throwIfError(uploadError);
  const { data, error } = await supabase.from('event_documents').insert({ ...values, event_id: eventId, file_name: file.name, file_size: file.size, storage_path: path }).select().single();
  if (error) { await supabase.storage.from('event-documents').remove([path]); throw error; }
  return data;
}
export async function getDocumentUrl(path) { const { data, error } = await supabase.storage.from('event-documents').createSignedUrl(path, 300); throwIfError(error); return data.signedUrl; }
export async function deleteDocument(id, path) { const { error } = await supabase.from('event_documents').delete().eq('id', id); throwIfError(error); const { error: storageError } = await supabase.storage.from('event-documents').remove([path]); throwIfError(storageError); }
