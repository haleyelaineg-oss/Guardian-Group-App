import { supabase } from '../../lib/supabase.js';
import { fetchSpeakingEngagements } from '../speaking/speakingService.js';
import { normalizeSpeakingStatus, SPEAKING_STATUS_LABELS } from '../speaking/statuses.js';
import { fetchTrainings } from '../trainings/trainingService.js';
import { isCancelledTrainingStatus, trainingStatusLabel } from '../trainings/statuses.js';
function fail(error) { if (error) throw error; }
export async function fetchEvents() { const { data, error } = await supabase.from('events').select('*,companies!company_id(name)').order('starts_at', { ascending: true, nullsFirst: false }); fail(error); return data || []; }

export async function fetchEventHubRows() {
  const [events, trainings, speakingEngagements] = await Promise.all([
    fetchEvents(),
    fetchTrainings(),
    fetchSpeakingEngagements(),
  ]);
  const linkedEventIds = new Set([
    ...trainings.map((training) => training.event_id),
    ...speakingEngagements.map((engagement) => engagement.event_id),
  ].filter(Boolean));

  const standaloneEvents = events
    .filter((event) => !linkedEventIds.has(event.id))
    .map((event) => ({
      key: `event:${event.id}`,
      kind: 'event',
      id: event.id,
      title: event.title,
      status: event.status,
      statusLabel: null,
      startsAt: event.starts_at,
      dateFallback: null,
      location: event.location,
      organization: event.companies?.name,
      subtype: event.event_type,
      cancelled: event.status === 'cancelled',
      path: `/admin/events/${event.id}`,
    }));

  const trainingRows = trainings.map((training) => ({
    key: `training:${training.id}`,
    kind: 'training',
    id: training.id,
    title: training.title,
    status: training.status,
    statusLabel: trainingStatusLabel(training.status),
    startsAt: training.starts_at,
    dateFallback: null,
    location: training.delivery_method === 'virtual' ? 'Virtual' : training.site_location || training.site_address,
    organization: training.companies?.name,
    subtype: training.delivery_method,
    cancelled: isCancelledTrainingStatus(training.status),
    path: `/admin/trainings/${training.id}`,
  }));

  const speakingRows = speakingEngagements.map((engagement) => {
    const status = normalizeSpeakingStatus(engagement.status);
    return {
      key: `speaking:${engagement.id}`,
      kind: 'speaking',
      id: engagement.id,
      title: engagement.event_name,
      status,
      statusLabel: SPEAKING_STATUS_LABELS[status],
      startsAt: engagement.event_start_date,
      dateFallback: engagement.cfp_deadline,
      location: [engagement.venue, engagement.city, engagement.region].filter(Boolean).join(', '),
      organization: engagement.organization_name,
      subtype: null,
      cancelled: status.startsWith('cancelled_'),
      path: `/admin/speaking/${engagement.id}`,
    };
  });

  return [...standaloneEvents, ...trainingRows, ...speakingRows];
}
export async function fetchEvent(id) { const { data, error } = await supabase.from('events').select('*').eq('id', id).single(); fail(error); return data; }
export async function createEvent(values) { const { data, error } = await supabase.from('events').insert(values).select().single(); fail(error); return data; }
export async function updateEvent(id, values) { const { data, error } = await supabase.from('events').update(values).eq('id', id).select().single(); fail(error); return data; }
export async function deleteEvent(id) { const { error } = await supabase.from('events').delete().eq('id', id); fail(error); }
