// Pure Supabase data access for Tasks — no React, no UI state. Mirrors the
// exact queries js/admin-calendar.js used (same table, columns, ordering).
import { supabase } from '../../lib/supabase.js';

export async function fetchTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, status, owner, event_id, link_url')
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTaskById(id) {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// Powers the Linked Event <select> on the task form. Lives here rather than
// in a dedicated events service since Tasks is the only feature that needs
// it so far — revisit once features/events/ has a real eventService.js
// (Phase 8, per MIGRATION_MAP.md) that this can call into instead.
export async function fetchEventsForSelect() {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, starts_at')
    .order('starts_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function createTask(payload) {
  const { error } = await supabase.from('tasks').insert({ ...payload, status: 'todo' });
  if (error) throw error;
}

export async function updateTask(id, payload) {
  const { error } = await supabase.from('tasks').update(payload).eq('id', id);
  if (error) throw error;
}

export async function setTaskStatus(id, status) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteTaskById(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}
