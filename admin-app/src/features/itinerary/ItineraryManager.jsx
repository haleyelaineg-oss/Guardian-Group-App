import { useState } from 'react';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import SaveButton from '../../components/SaveButton.jsx';
import { createItineraryItem, deleteItineraryItem, fetchItinerary, updateItineraryItem } from '../events/eventResourcesService.js';
import { useEventResource } from '../events/useEventResource.js';

const TYPES = ['driving_to', 'driving_home', 'departing_flight', 'return_flight', 'hotel', 'car_rental', 'speaking_session', 'training_session', 'other'];
const STATUSES = ['planned', 'booked', 'cancelled'];
const BLANK = { item_type: 'other', title: '', starts_at: '', ends_at: '', location: '', provider: '', confirmation_number: '', cost: '', status: 'planned', notes: '' };
const dateTime = (value) => value ? new Date(value).toLocaleString() : '—';

function formValues(item) {
  return { ...BLANK, ...item, starts_at: item.starts_at ? item.starts_at.slice(0, 16) : '', ends_at: item.ends_at ? item.ends_at.slice(0, 16) : '', cost: item.cost ?? '' };
}

function Editor({ values, setValues, editing, onCancel, onSave }) {
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const field = (key, label, type = 'text') => <label className="field-group half"><span className="field-label">{label}</span><input className="field-input" type={type} value={values[key]} onChange={(e) => set(key, e.target.value)} /></label>;
  return <div className="create-form-card"><h3 className="card-title">{editing === 'new' ? 'Add Itinerary Item' : 'Edit Itinerary Item'}</h3><div className="fields-grid"><label className="field-group half"><span className="field-label">Type</span><select className="field-input" value={values.item_type} onChange={(e) => set('item_type', e.target.value)}>{TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>{field('title', 'Title')}{field('starts_at', 'Starts', 'datetime-local')}{field('ends_at', 'Ends', 'datetime-local')}{field('location', 'Location')}{field('provider', 'Provider')}{field('confirmation_number', 'Confirmation number')}{field('cost', 'Cost', 'number')}<label className="field-group half"><span className="field-label">Status</span><select className="field-input" value={values.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label className="field-group full"><span className="field-label">Notes</span><textarea className="field-input" value={values.notes} onChange={(e) => set('notes', e.target.value)} /></label></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={onCancel}>Cancel</button><SaveButton onSave={onSave} label={editing === 'new' ? 'Add Item →' : 'Save Item →'} /></div></div>;
}

export default function ItineraryManager({ eventId, onItemsChange }) {
  const { rows, loading, error, reload } = useEventResource(eventId, fetchItinerary);
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(BLANK);
  async function refresh() { await reload(); onItemsChange?.(); }
  const closeEditor = () => { setEditing(null); setValues(BLANK); };
  const openEditor = (item = null) => { setEditing(item?.id || 'new'); setValues(item ? formValues(item) : BLANK); };
  async function save() { if (!values.title.trim()) throw new Error('A title is required.'); const payload = { ...values, title: values.title.trim(), starts_at: values.starts_at || null, ends_at: values.ends_at || null, location: values.location.trim() || null, provider: values.provider.trim() || null, confirmation_number: values.confirmation_number.trim() || null, cost: values.cost === '' ? null : Number(values.cost), notes: values.notes.trim() || null }; if (editing === 'new') await createItineraryItem(eventId, payload); else await updateItineraryItem(editing, payload); await refresh(); closeEditor(); }
  async function remove(item) { if (!confirm(`Delete ${item.title}?`)) return; try { await deleteItineraryItem(item.id); await refresh(); } catch (err) { alert(err.message); } }
  if (!eventId) return <p className="empty-hint">Itinerary is available once this item is on the Calendar.</p>;
  return <section><div className="detail-section-title">Itinerary</div><button className="btn-sm btn-sm-ghost" onClick={() => openEditor()}>+ Add Itinerary Item</button>{editing && <Editor values={values} setValues={setValues} editing={editing} onCancel={closeEditor} onSave={save} />}{loading ? <LoadingIndicator label="Loading itinerary…" /> : error ? <section className="empty-hint" role="alert">Couldn’t load itinerary. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Type</th><th>Title</th><th>Starts</th><th>Provider / confirmation</th><th>Cost</th><th>Status</th><th></th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan="7">No itinerary items yet.</td></tr> : rows.map((item) => <tr key={item.id}><td>{item.item_type.replaceAll('_', ' ')}</td><td>{item.title}</td><td>{dateTime(item.starts_at)}</td><td>{[item.provider, item.confirmation_number].filter(Boolean).join(' · ') || '—'}</td><td>{item.cost == null ? '—' : `$${Number(item.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td><td>{item.status}</td><td><button className="btn-sm btn-sm-ghost" onClick={() => openEditor(item)}>Edit</button> <button className="btn-sm btn-sm-danger" onClick={() => remove(item)}>🗑️</button></td></tr>)}</tbody></table></div>}</section>;
}
