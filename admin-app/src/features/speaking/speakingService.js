import { supabase } from '../../lib/supabase.js';

function fail(error) { if (error) throw error; }
export async function fetchSpeakingEngagements() { const { data, error } = await supabase.from('speaking_engagements').select('*').order('event_start_date', { ascending: true, nullsFirst: false }); fail(error); return data || []; }
export async function createSpeakingEngagement(values) { const { data, error } = await supabase.from('speaking_engagements').insert(values).select().single(); fail(error); return data; }
export async function fetchSpeakingDetail(id) { const [engagement, submissions] = await Promise.all([supabase.from('speaking_engagements').select('*').eq('id', id).single(), supabase.from('speaking_submissions').select('*').eq('speaking_engagement_id', id).order('submitted_at', { ascending: false })]); fail(engagement.error); fail(submissions.error); return { engagement: engagement.data, submissions: submissions.data || [] }; }
export async function updateSpeakingEngagement(id, values) { const { data, error } = await supabase.from('speaking_engagements').update(values).eq('id', id).select().single(); fail(error); return data; }
export async function deleteSpeakingEngagement(id) { const { error } = await supabase.from('speaking_engagements').delete().eq('id', id); fail(error); }
export async function createSpeakingSubmission(values) { const { error } = await supabase.from('speaking_submissions').insert(values); fail(error); }
export async function fetchSpeakingSessions(eventId) { const { data, error } = await supabase.from('event_itinerary_items').select('*').eq('event_id', eventId).eq('item_type', 'speaking_session').order('starts_at', { ascending: true, nullsFirst: false }); fail(error); return data || []; }
export async function createSpeakingSession(eventId, values) { const { error } = await supabase.from('event_itinerary_items').insert({ ...values, event_id: eventId, item_type: 'speaking_session' }); fail(error); }
export async function updateSpeakingSession(id, values) { const { error } = await supabase.from('event_itinerary_items').update(values).eq('id', id); fail(error); }
export async function deleteSpeakingSession(id) { const { error } = await supabase.from('event_itinerary_items').delete().eq('id', id); fail(error); }

function eventStatus(status) { if (['selected', 'contracting', 'planning', 'ready'].includes(status)) return 'confirmed'; if (['completed', 'payment_pending', 'closed'].includes(status)) return 'completed'; if (['cancelled', 'declined', 'withdrawn'].includes(status)) return 'cancelled'; return 'planning'; }
export async function saveSpeakingAndLink(id, values) {
  const engagement = await updateSpeakingEngagement(id, values);
  const location = [engagement.venue, engagement.city, engagement.region].filter(Boolean).join(', ') || null;
  const eventPayload = { title: engagement.event_name, event_type: 'speaking', starts_at: engagement.event_start_date ? new Date(`${engagement.event_start_date}T00:00:00`).toISOString() : null, ends_at: engagement.event_end_date ? new Date(`${engagement.event_end_date}T00:00:00`).toISOString() : null, all_day: true, location, status: eventStatus(engagement.status), income_amount: engagement.offered_fee, link_url: engagement.application_url };
  if (engagement.event_id) { const { error } = await supabase.from('events').update(eventPayload).eq('id', engagement.event_id); fail(error); return engagement; }
  if (!engagement.event_start_date) throw new Error('Add an Event Start Date before adding this to the Calendar.');
  const { data: event, error: eventError } = await supabase.from('events').insert(eventPayload).select().single(); fail(eventError);
  return updateSpeakingEngagement(id, { event_id: event.id, selected_at: engagement.selected_at || new Date().toISOString() });
}
