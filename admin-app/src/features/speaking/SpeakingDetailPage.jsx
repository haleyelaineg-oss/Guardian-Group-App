import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SaveButton from '../../components/SaveButton.jsx';
import Checklist from '../engagements/Checklist.jsx';
import CareArrangements from '../engagements/CareArrangements.jsx';
import ExpenseManager from '../expenses/ExpenseManager.jsx';
import DocumentManager from '../documents/DocumentManager.jsx';
import TravelPlanner from '../itinerary/TravelPlanner.jsx';
import SpeakingSubmissions from './SpeakingSubmissions.jsx';
import SpeakingSessions from './SpeakingSessions.jsx';
import { fetchSpeakingDetail, isCalendarRemovalStatus, removeSpeakingFromCalendar, syncSpeakingCalendar, updateSpeakingEngagement } from './speakingService.js';

const STATUSES = ['opportunity', 'preparing_submission', 'applied', 'under_review', 'selected', 'contracting', 'planning', 'ready', 'completed', 'payment_pending', 'closed', 'declined', 'withdrawn', 'cancelled'];
const text = (value) => value.trim() || null;

export default function SpeakingDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('Overview');
  const reload = () => fetchSpeakingDetail(id).then(setData).catch((err) => alert(err.message));
  useEffect(() => { reload(); }, [id]);
  if (!data) return <p className="empty-hint">Loading...</p>;

  const { engagement } = data;
  const tabs = ['Overview', 'Submissions', 'Sessions', 'Prep', 'Travel', 'Care', 'Financials', 'Documents', 'Post-Event'];
  return <div className="view active"><Link to="/admin/speaking" aria-label="Close speaking engagement workspace">← Speaking Engagements</Link><h1 className="view-title">{engagement.event_name}</h1><div className="tab-bar">{tabs.map((name) => <button key={name} className={`tab-btn ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)}>{name}</button>)}</div>
    {tab === 'Overview' && <Overview engagement={engagement} onSaved={reload} />}
    {tab === 'Submissions' && <SpeakingSubmissions engagementId={engagement.id} submissions={data.submissions} onSaved={reload} />}
    {tab === 'Sessions' && <SpeakingSessions eventId={engagement.event_id} />}
    {tab === 'Prep' && <Checklist kind="speaking" engagementId={engagement.id} />}
    {tab === 'Travel' && <TravelPlanner eventId={engagement.event_id} startsAt={engagement.event_start_date} endsAt={engagement.event_end_date} />}
    {tab === 'Care' && <CareArrangements eventId={engagement.event_id} />}
    {tab === 'Financials' && <ExpenseManager eventId={engagement.event_id} incomeAmount={engagement.offered_fee} />}
    {tab === 'Documents' && <DocumentManager eventId={engagement.event_id} />}
    {tab === 'Post-Event' && <PostEvent engagement={engagement} onSaved={reload} />}
  </div>;
}

function Overview({ engagement, onSaved }) {
  const [v, setV] = useState(() => ({ event_name: engagement.event_name || '', organization_name: engagement.organization_name || '', event_website: engagement.event_website || '', venue: engagement.venue || '', venue_address: engagement.venue_address || '', city: engagement.city || '', region: engagement.region || '', country: engagement.country || '', zip_code: engagement.zip_code || '', event_start_date: engagement.event_start_date || '', event_end_date: engagement.event_end_date || '', cfp_deadline: engagement.cfp_deadline || '', application_url: engagement.application_url || '', contact_name: engagement.contact_name || '', contact_email: engagement.contact_email || '', contact_phone: engagement.contact_phone || '', requested_fee: engagement.requested_fee ?? '', offered_fee: engagement.offered_fee ?? '', status: engagement.status, notes: engagement.notes || '' }));
  const set = (key, value) => setV((current) => ({ ...current, [key]: value }));
  const field = (key, label, type = 'text') => <label className="field-group half"><span className="field-label">{label}</span><input className="field-input" type={type} value={v[key]} onChange={(e) => set(key, e.target.value)} /></label>;
  async function save() {
    if (!v.event_name.trim()) throw new Error('Event name is required.');
    const values = { ...v, event_name: v.event_name.trim(), organization_name: text(v.organization_name), event_website: text(v.event_website), venue: text(v.venue), venue_address: text(v.venue_address), city: text(v.city), region: text(v.region), country: text(v.country), zip_code: text(v.zip_code), event_start_date: v.event_start_date || null, event_end_date: v.event_end_date || null, cfp_deadline: v.cfp_deadline || null, application_url: text(v.application_url), contact_name: text(v.contact_name), contact_email: text(v.contact_email), contact_phone: text(v.contact_phone), requested_fee: v.requested_fee === '' ? null : Number(v.requested_fee), offered_fee: v.offered_fee === '' ? null : Number(v.offered_fee), notes: text(v.notes) };
    const saved = await updateSpeakingEngagement(engagement.id, values);
    if (isCalendarRemovalStatus(saved.status) && saved.event_id) {
      if (confirm('This engagement is no longer active. Remove it from the Calendar? Its planning records, documents, and expenses will be kept.')) await removeSpeakingFromCalendar(saved);
      else await syncSpeakingCalendar(saved);
    } else if (!isCalendarRemovalStatus(saved.status)) {
      await syncSpeakingCalendar(saved);
    }
    await onSaved();
  }
  return <section>{engagement.event_id && !isCalendarRemovalStatus(engagement.status) && <p className="field-hint">On Calendar · <Link to="/admin/calendar">View on Calendar →</Link></p>}<div className="fields-grid"><label className="field-group full"><span className="field-label">Status</span><select className="field-input" value={v.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>{field('event_name', 'Event name')}{field('organization_name', 'Organization')}{field('event_website', 'Website')}{field('application_url', 'Application URL')}{field('venue', 'Venue name')}{field('venue_address', 'Venue address')}{field('city', 'City')}{field('region', 'State / region')}{field('country', 'Country')}{field('zip_code', 'ZIP code')}{field('event_start_date', 'Event start date', 'date')}{field('event_end_date', 'Event end date', 'date')}{field('cfp_deadline', 'CFP deadline', 'date')}{field('contact_name', 'Contact name')}{field('contact_email', 'Contact email', 'email')}{field('contact_phone', 'Contact phone')}{field('requested_fee', 'Requested fee', 'number')}{field('offered_fee', 'Offered fee', 'number')}<label className="field-group full"><span className="field-label">Notes</span><textarea className="field-input" value={v.notes} onChange={(e) => set('notes', e.target.value)} /></label></div><div className="create-form-actions"><SaveButton onSave={save} label="Save Engagement →" /></div></section>;
}

function PostEvent({ engagement, onSaved }) { const [attendeeCount, setAttendeeCount] = useState(engagement.attendee_count ?? ''); const [recordingUrl, setRecordingUrl] = useState(engagement.recording_url || ''); const [outcomeNotes, setOutcomeNotes] = useState(engagement.outcome_notes || ''); return <section><div className="fields-grid"><label className="field-group half"><span className="field-label">Actual attendee count</span><input className="field-input" type="number" value={attendeeCount} onChange={(e) => setAttendeeCount(e.target.value)} /></label><label className="field-group half"><span className="field-label">Recording URL</span><input className="field-input" type="url" value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} /></label><label className="field-group full"><span className="field-label">Outcome notes</span><textarea className="field-input" value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} /></label></div><SaveButton onSave={async () => { await updateSpeakingEngagement(engagement.id, { attendee_count: attendeeCount === '' ? null : Number(attendeeCount), recording_url: text(recordingUrl), outcome_notes: text(outcomeNotes) }); await onSaved(); }} label="Save Post-Event →" /></section>; }
