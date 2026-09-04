import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SaveButton from '../../components/SaveButton.jsx';
import { createSpeakingEngagement } from './speakingService.js';
import { SPEAKING_STATUSES, SPEAKING_STATUS_LABELS } from './statuses.js';

const blank = { event_name: '', organization_name: '', event_website: '', venue: '', venue_address: '', city: '', region: '', country: '', zip_code: '', event_start_date: '', event_end_date: '', cfp_deadline: '', application_url: '', contact_name: '', contact_email: '', contact_phone: '', requested_fee: '', offered_fee: '', status: 'opportunity', notes: '' };
const clean = (value) => value.trim() || null;

export default function SpeakingCreatePage() {
  const [v, setV] = useState(blank);
  const [tab, setTab] = useState('Overview');
  const navigate = useNavigate();
  const location = useLocation();
  const closeTo = location.state?.returnTo || '/admin/speaking';
  const set = (key, value) => setV((old) => ({ ...old, [key]: value }));
  const field = (key, label, type = 'text') => <label className="field-group half"><span className="field-label">{label}</span><input className="field-input" type={type} value={v[key]} onChange={(e) => set(key, e.target.value)} /></label>;
  const tabs = ['Overview', 'Submissions', 'Sessions', 'Prep', 'Travel', 'Care', 'Financials', 'Documents', 'Post-Event'];
  const save = async () => {
    if (!v.event_name.trim()) throw new Error('Event name is required.');
    const record = await createSpeakingEngagement({ ...v, event_name: v.event_name.trim(), organization_name: clean(v.organization_name), event_website: clean(v.event_website), venue: clean(v.venue), venue_address: clean(v.venue_address), city: clean(v.city), region: clean(v.region), country: clean(v.country), zip_code: clean(v.zip_code), event_start_date: v.event_start_date || null, event_end_date: v.event_end_date || null, cfp_deadline: v.cfp_deadline || null, application_url: clean(v.application_url), contact_name: clean(v.contact_name), contact_email: clean(v.contact_email), contact_phone: clean(v.contact_phone), requested_fee: v.requested_fee === '' ? null : Number(v.requested_fee), offered_fee: v.offered_fee === '' ? null : Number(v.offered_fee), notes: clean(v.notes) });
    navigate(`/admin/speaking/${record.id}`, { replace: true, state: location.state });
  };
  return <div className="view active"><Link to={closeTo} aria-label="Close speaking engagement workspace">← Speaking Engagements</Link><h1 className="view-title">New Speaking Engagement</h1><div className="tab-bar">{tabs.map((name) => <button key={name} className={`tab-btn ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)}>{name}</button>)}</div>{tab !== 'Overview' ? <p className="empty-hint">Save the Overview first to set up this engagement’s planning workspace.</p> : <section><div className="fields-grid"><label className="field-group full"><span className="field-label">Status</span><select className="field-input" value={v.status} onChange={(e) => set('status', e.target.value)}>{SPEAKING_STATUSES.map((status) => <option key={status} value={status}>{SPEAKING_STATUS_LABELS[status]}</option>)}</select></label>{field('event_name', 'Event name')}{field('organization_name', 'Organization')}{field('event_website', 'Website')}{field('application_url', 'Application URL')}{field('venue', 'Venue name')}{field('venue_address', 'Venue address')}{field('city', 'City')}{field('region', 'State / region')}{field('country', 'Country')}{field('zip_code', 'ZIP code')}{field('event_start_date', 'Event start date', 'date')}{field('event_end_date', 'Event end date', 'date')}{field('cfp_deadline', 'CFP deadline', 'date')}{field('contact_name', 'Contact name')}{field('contact_email', 'Contact email')}{field('contact_phone', 'Contact phone')}{field('requested_fee', 'Requested fee', 'number')}{field('offered_fee', 'Offered fee', 'number')}<label className="field-group full"><span className="field-label">Notes</span><textarea className="field-input" value={v.notes} onChange={(e) => set('notes', e.target.value)} /></label></div><div className="create-form-actions"><SaveButton onSave={save} label="Create Speaking Engagement →" /></div></section>}</div>;
}
