import { supabase } from '../../lib/supabase.js';

function fail(error) { if (error) throw error; }

export async function fetchPresentationSessions() {
  const { data, error } = await supabase.from('presentation_sessions').select('*').order('title');
  fail(error);
  return data || [];
}

export async function fetchPresentationSession(id) {
  const [session, deliveries, materials] = await Promise.all([
    supabase.from('presentation_sessions').select('*').eq('id', id).single(),
    supabase.from('event_itinerary_items').select('id, title, starts_at, ends_at, speakers, events(title, starts_at, status)').eq('presentation_session_id', id).order('starts_at', { ascending: false, nullsFirst: false }),
    supabase.from('presentation_session_materials').select('*').eq('presentation_session_id', id).order('created_at', { ascending: false }),
  ]);
  fail(session.error); fail(deliveries.error); fail(materials.error);
  return { session: session.data, deliveries: deliveries.data || [], materials: materials.data || [] };
}

export async function fetchPresentationSessionUsage() {
  const { data, error } = await supabase.from('event_itinerary_items').select('presentation_session_id, events(status)').not('presentation_session_id', 'is', null);
  fail(error);
  return (data || []).filter((row) => row.events?.status === 'completed').reduce((counts, row) => ({ ...counts, [row.presentation_session_id]: (counts[row.presentation_session_id] || 0) + 1 }), {});
}

export async function createPresentationSession(values) {
  const { data, error } = await supabase.from('presentation_sessions').insert(values).select().single();
  fail(error); return data;
}

export async function updatePresentationSession(id, values) {
  const { data, error } = await supabase.from('presentation_sessions').update(values).eq('id', id).select().single();
  fail(error); return data;
}

export async function deletePresentationSession(id) {
  const { error } = await supabase.from('presentation_sessions').delete().eq('id', id);
  fail(error);
}

export async function createSessionMaterialLink(sessionId, values) {
  const { error } = await supabase.from('presentation_session_materials').insert({ presentation_session_id: sessionId, material_type: 'link', label: values.label, url: values.url, notes: values.notes || null });
  fail(error);
}

export async function uploadSessionMaterial(sessionId, file, notes = null) {
  const path = `${sessionId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('session-materials').upload(path, file);
  fail(uploadError);
  const { error } = await supabase.from('presentation_session_materials').insert({ presentation_session_id: sessionId, material_type: 'file', label: file.name, file_name: file.name, file_size: file.size, storage_path: path, notes });
  if (error) { await supabase.storage.from('session-materials').remove([path]); fail(error); }
}

export async function getSessionMaterialUrl(path) {
  const { data, error } = await supabase.storage.from('session-materials').createSignedUrl(path, 300);
  fail(error); return data.signedUrl;
}

export async function deleteSessionMaterial(material) {
  const { error } = await supabase.from('presentation_session_materials').delete().eq('id', material.id);
  fail(error);
  if (material.storage_path) { const { error: storageError } = await supabase.storage.from('session-materials').remove([material.storage_path]); fail(storageError); }
}
