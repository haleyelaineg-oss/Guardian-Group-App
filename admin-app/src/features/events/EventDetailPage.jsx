import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import SaveButton from '../../components/SaveButton.jsx';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import ExpenseManager from '../expenses/ExpenseManager.jsx';
import ItineraryManager from '../itinerary/ItineraryManager.jsx';
import DocumentManager from '../documents/DocumentManager.jsx';
import { createEvent, deleteEvent, fetchEvent, updateEvent } from './eventsService.js';

const blank = { title: '', event_type: 'other', status: 'planning', starts_at: null, ends_at: null, all_day: true, location: '', link_url: '', income_amount: null, notes: '' };
const tabs = ['Overview', 'Itinerary', 'Financials', 'Documents'];

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const closeTo = location.state?.returnTo || '/admin/events';
  const creating = !id || id === 'new';
  const [event, setEvent] = useState(creating ? blank : null);
  const [tab, setTab] = useState('Overview');
  const reload = useCallback(() => { if (!creating) fetchEvent(id).then(setEvent).catch((error) => alert(error.message)); }, [creating, id]);
  useEffect(() => { reload(); }, [reload]);
  if (!event) return <LoadingIndicator label="Loading event…" />;

  const needsSave = creating && tab !== 'Overview';
  return <div className="view active"><Link to={closeTo} aria-label="Close event workspace">← Events</Link><div className="view-header"><h1 className="view-title">{creating ? 'New Event' : event.title}</h1>{!creating && <button className="btn-sm btn-sm-danger" onClick={async () => { if (!confirm(`Delete “${event.title}”? Its itinerary, financial records, and documents will also be removed.`)) return; try { await deleteEvent(id); navigate(closeTo); } catch (error) { alert(error.message); } }}>Delete Event</button>}</div><div className="tab-bar">{tabs.map((name) => <button key={name} className={`tab-btn ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)}>{name}</button>)}</div>{needsSave ? <p className="empty-hint">Save the Overview first to set up this event workspace.</p> : <>{tab === 'Overview' && <Overview event={event} creating={creating} onSaved={reload} onCreated={(record) => navigate(`/admin/events/${record.id}`, { replace: true, state: location.state })} />}{tab === 'Itinerary' && <ItineraryManager eventId={id} />}{tab === 'Financials' && <ExpenseManager eventId={id} incomeAmount={event.income_amount} />}{tab === 'Documents' && <DocumentManager eventId={id} />}</>}</div>;
}

function Overview({ event, creating, onSaved, onCreated }) {
  const [v, setV] = useState(() => ({ title: event.title || '', event_type: event.event_type || 'other', status: event.status || 'planning', starts_at: event.starts_at ? event.starts_at.slice(0, 16) : '', ends_at: event.ends_at ? event.ends_at.slice(0, 16) : '', all_day: !!event.all_day, location: event.location || '', link_url: event.link_url || '', income_amount: event.income_amount ?? '', notes: event.notes || '' }));
  const set = (key, value) => setV((current) => ({ ...current, [key]: value }));
  async function save() { if (!v.title.trim() || !v.starts_at) throw new Error('Title and start date are required.'); const values = { ...v, title: v.title.trim(), starts_at: v.starts_at, ends_at: v.ends_at || null, location: v.location.trim() || null, link_url: v.link_url.trim() || null, income_amount: v.income_amount === '' ? null : Number(v.income_amount), notes: v.notes.trim() || null }; if (creating) onCreated(await createEvent(values)); else { await updateEvent(event.id, values); await onSaved(); } }
  return <section><div className="fields-grid"><label className="field-group half"><span className="field-label">Title</span><input className="field-input" value={v.title} onChange={(e) => set('title', e.target.value)} /></label><label className="field-group half"><span className="field-label">Type</span><select className="field-input" value={v.event_type} onChange={(e) => set('event_type', e.target.value)}>{['workshop', 'travel', 'meeting', 'speaking', 'training', 'other'].map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="field-group half"><span className="field-label">Status</span><select className="field-input" value={v.status} onChange={(e) => set('status', e.target.value)}>{['application_sent', 'application_denied', 'planning', 'confirmed', 'cancelled', 'completed'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><label className="field-group half"><span className="field-label">All day</span><input type="checkbox" checked={v.all_day} onChange={(e) => set('all_day', e.target.checked)} /></label><label className="field-group half"><span className="field-label">Starts</span><input className="field-input" type="datetime-local" value={v.starts_at} onChange={(e) => set('starts_at', e.target.value)} /></label><label className="field-group half"><span className="field-label">Ends</span><input className="field-input" type="datetime-local" value={v.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></label><label className="field-group half"><span className="field-label">Location</span><input className="field-input" value={v.location} onChange={(e) => set('location', e.target.value)} /></label><label className="field-group half"><span className="field-label">Income</span><input className="field-input" type="number" value={v.income_amount} onChange={(e) => set('income_amount', e.target.value)} /></label><label className="field-group full"><span className="field-label">Link</span><input className="field-input" type="url" value={v.link_url} onChange={(e) => set('link_url', e.target.value)} /></label><label className="field-group full"><span className="field-label">Notes</span><textarea className="field-input" value={v.notes} onChange={(e) => set('notes', e.target.value)} /></label></div><SaveButton onSave={save} label={creating ? 'Create Event →' : 'Save Event →'} /></section>;
}
