import { supabase } from '../../lib/supabase.js';
function fail(error) { if (error) throw error; }
export async function fetchEvents() { const { data, error } = await supabase.from('events').select('*,companies!company_id(name)').order('starts_at', { ascending: true, nullsFirst: false }); fail(error); return data || []; }
export async function fetchEvent(id) { const { data, error } = await supabase.from('events').select('*').eq('id', id).single(); fail(error); return data; }
export async function createEvent(values) { const { data, error } = await supabase.from('events').insert(values).select().single(); fail(error); return data; }
export async function updateEvent(id, values) { const { data, error } = await supabase.from('events').update(values).eq('id', id).select().single(); fail(error); return data; }
export async function deleteEvent(id) { const { error } = await supabase.from('events').delete().eq('id', id); fail(error); }
