import { supabase } from '../../lib/supabase.js';
import { fetchCompaniesForSelect } from '../clients/clientsService.js';
function fail(error) { if (error) throw error; }
export async function fetchTrainings() { const { data, error } = await supabase.from('training_engagements').select('*,companies(name)').order('starts_at', { ascending: true, nullsFirst: false }); fail(error); return data || []; }
export async function fetchTrainingDetail(id) { const { data, error } = await supabase.from('training_engagements').select('*,companies(name)').eq('id', id).single(); fail(error); return data; }
export async function createTraining(values) { const { data, error } = await supabase.from('training_engagements').insert(values).select().single(); fail(error); return syncTrainingCalendar(data); }
export async function updateTraining(id, values) { const { data, error } = await supabase.from('training_engagements').update(values).eq('id', id).select().single(); fail(error); await syncTrainingRosterSnapshot(data); return data; }
export async function deleteTraining(id) { const { error } = await supabase.from('training_engagements').delete().eq('id', id); fail(error); }
export async function deleteTrainingAndCalendar(training) { if (training.event_id) { const { error } = await supabase.from('events').delete().eq('id', training.event_id); fail(error); } await deleteTraining(training.id); }
export async function listTrainingCompanies() { return fetchCompaniesForSelect(); }
export async function listTrainingContacts(companyId) { if (!companyId) return []; const { data, error } = await supabase.from('participants').select('id,full_name').eq('company_id', companyId).order('full_name'); fail(error); return data || []; }
function eventStatus(status) { if (['scheduled', 'planning', 'ready'].includes(status)) return 'confirmed'; if (['completed', 'invoice_sent', 'payment_pending', 'paid'].includes(status)) return 'completed'; if (status === 'cancelled') return 'cancelled'; return 'planning'; }
export async function syncTrainingCalendar(training) { const cancelled = training.status === 'cancelled'; const eventPayload = { title: training.title, event_type: 'training', company_id: training.company_id, starts_at: cancelled ? null : training.starts_at, ends_at: cancelled ? null : training.ends_at || null, all_day: true, location: training.delivery_method === 'in_person' ? training.site_location || null : null, status: eventStatus(training.status) }; if (training.event_id) { const { error } = await supabase.from('events').update(eventPayload).eq('id', training.event_id); fail(error); return training; } if (!training.starts_at || cancelled) return training; const { data: event, error } = await supabase.from('events').insert(eventPayload).select().single(); fail(error); return updateTraining(training.id, { event_id: event.id }); }
export async function saveTrainingAndLink(id, values) { return syncTrainingCalendar(await updateTraining(id, values)); }

function trainingFacilitator(training) {
  return (training.instructors || []).map((person) => typeof person === 'string' ? person : person.name).filter(Boolean).join(' & ') || null;
}

function trainingSnapshot(training) {
  return {
    training_title: training.title,
    training_date: training.starts_at || null,
    training_facilitator: trainingFacilitator(training),
  };
}

async function syncTrainingRosterSnapshot(training) {
  const { error } = await supabase.from('attendance').update(trainingSnapshot(training)).eq('training_engagement_id', training.id);
  fail(error);
}

export async function fetchTrainingAttendanceRoster(trainingId) {
  const [rosterResult, companies] = await Promise.all([
    supabase
      .from('attendance')
      .select('id, participant_id, status, certificate_issued, certificate_number, certificate_issued_at, participant:participant_id(id, full_name, email, title, company:company_id(id, name))')
      .eq('training_engagement_id', trainingId)
      .order('created_at', { ascending: true }),
    fetchCompaniesForSelect(),
  ]);
  fail(rosterResult.error);
  return { roster: rosterResult.data || [], companies };
}

export async function addTrainingAttendee(training, { firstName, lastName, email, companyId, position }) {
  const fullName = `${firstName} ${lastName}`.trim();
  const cleanEmail = (email || '').trim();
  const normalizedEmail = cleanEmail.toLowerCase();

  let match = null;
  if (normalizedEmail) {
    const { data, error } = await supabase
      .from('participants')
      .select('id, full_name, email, title, company_id, company:company_id(name)')
      .eq('email_lower', normalizedEmail)
      .maybeSingle();
    fail(error);
    if (data?.company_id && data.company_id !== companyId) {
      const companyName = data.company?.name || 'another client';
      throw new Error(`That email is already assigned to ${companyName} in the Address Book.`);
    }
    match = data;
  }

  if (!match) {
    const { data, error } = await supabase
      .from('participants')
      .select('id, full_name, email, title, company_id')
      .eq('company_id', companyId)
      .ilike('full_name', fullName)
      .limit(1);
    fail(error);
    match = data?.[0] || null;
  }

  let participantId = match?.id;
  if (participantId) {
    const updates = {};
    if (match.full_name !== fullName) updates.full_name = fullName;
    if (normalizedEmail && match.email?.trim().toLowerCase() !== normalizedEmail) updates.email = cleanEmail;
    if (!match.company_id) updates.company_id = companyId;
    if (position && match.title !== position) updates.title = position;
    if (Object.keys(updates).length) {
      const { error } = await supabase.from('participants').update(updates).eq('id', participantId);
      if (error?.code === '23505') throw new Error('That email is already on file for another Address Book contact.');
      fail(error);
    }
  } else {
    const { data: participant, error } = await supabase
      .from('participants')
      .insert({ full_name: fullName, email: cleanEmail || null, company_id: companyId, title: position || null })
      .select('id')
      .single();
    if (error?.code === '23505') throw new Error('That email is already on file for another Address Book contact.');
    fail(error);
    participantId = participant.id;
  }

  const { error } = await supabase.from('attendance').insert({
    participant_id: participantId,
    training_engagement_id: training.id,
    status: 'registered',
    ...trainingSnapshot(training),
  });
  if (error?.code === '23505') throw new Error('This person is already on the training roster.');
  fail(error);
}

export async function updateTrainingAttendanceStatus(attendanceId, status) {
  const { error } = await supabase.from('attendance').update({ status }).eq('id', attendanceId);
  fail(error);
}

export async function issueTrainingCertificate(attendanceId) {
  const { error } = await supabase.from('attendance').update({ certificate_issued: true }).eq('id', attendanceId);
  fail(error);
}

export async function removeTrainingAttendee(attendanceId) {
  const { error } = await supabase.from('attendance').delete().eq('id', attendanceId);
  fail(error);
}
