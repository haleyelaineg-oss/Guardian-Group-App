import { useState } from 'react';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import SaveButton from '../../components/SaveButton.jsx';
import { createExpense, createItineraryItem, deleteItineraryItem, fetchExpenses, fetchItinerary, updateItineraryItem } from '../events/eventResourcesService.js';
import { useEventResource } from '../events/useEventResource.js';

const TYPE_LABELS = { driving_to: 'Driving To', driving_home: 'Driving Home', departing_flight: 'Departing Flight', return_flight: 'Return Flight', hotel: 'Hotel', rental_car_pickup: 'Rental Car', rental_car_drop_off: 'Rental Car', car_rental: 'Rental Car', speaking_session: 'Speaking Session', training_session: 'Training Session', other: 'Other' };
const TYPES = ['driving_to', 'driving_home', 'departing_flight', 'return_flight', 'hotel', 'car_rental', 'speaking_session', 'training_session', 'other'];
export const TRAVEL_TYPES = ['driving_to', 'driving_home', 'departing_flight', 'return_flight', 'hotel', 'car_rental', 'other'];
const STATUSES = ['planning', 'booked', 'cancelled'];
const BLANK = { item_type: 'other', title: '', starts_at: '', ends_at: '', location: '', provider: '', confirmation_number: '', cost: '', status: 'planning', notes: '' };
const dateTime = (value) => value ? new Date(value).toLocaleString() : '—';
const expenseCategory = (type) => ({ departing_flight: 'airfare', return_flight: 'airfare', hotel: 'lodging', rental_car_pickup: 'rental_car', rental_car_drop_off: 'rental_car', car_rental: 'rental_car', driving_to: 'mileage', driving_home: 'mileage' }[type] || 'ground_transportation');

function formValues(item) {
  return {
    ...BLANK,
    ...item,
    starts_at: item.starts_at ? item.starts_at.slice(0, 16) : '',
    ends_at: item.ends_at ? item.ends_at.slice(0, 16) : '',
    location: item.location ?? '',
    provider: item.provider ?? '',
    confirmation_number: item.confirmation_number ?? '',
    notes: item.notes ?? '',
    cost: item.cost ?? ''
  };
}

function Editor({ values, setValues, editing, onCancel, onSave, itemTypes }) {
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const field = (key, label, type = 'text') => <label className="field-group half"><span className="field-label">{label}</span><input className="field-input" type={type} value={values[key]} onChange={(e) => set(key, e.target.value)} /></label>;
  const selectableTypes = ['rental_car_pickup', 'rental_car_drop_off'].includes(values.item_type)
    ? [...itemTypes, values.item_type]
    : itemTypes;
  return <div className="create-form-card"><h3 className="card-title">{editing === 'new' ? 'Add Itinerary Item' : 'Edit Itinerary Item'}</h3><div className="fields-grid"><label className="field-group half"><span className="field-label">Type</span><select className="field-input" value={values.item_type} onChange={(e) => set('item_type', e.target.value)}>{selectableTypes.map((type) => <option key={type} value={type}>{TYPE_LABELS[type] || type.replaceAll('_', ' ')}</option>)}</select></label><label className="field-group half"><span className="field-label">Status</span><select className="field-input" value={values.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>{field('starts_at', 'Start date & time', 'datetime-local')}{field('ends_at', 'End date & time', 'datetime-local')}{field('provider', 'Name')}{field('location', 'Address')}{field('confirmation_number', 'Confirmation number')}{field('cost', 'Cost', 'number')}<label className="field-group full"><span className="field-label">Notes</span><textarea className="field-input" value={values.notes} onChange={(e) => set('notes', e.target.value)} /></label></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={onCancel}>Cancel</button><SaveButton onSave={onSave} label={editing === 'new' ? 'Add Item →' : 'Save Item →'} /></div></div>;
}

export default function ItineraryManager({ eventId, onItemsChange, itemTypes = TYPES, title = 'Itinerary' }) {
  const { rows, loading, error, reload } = useEventResource(eventId, fetchItinerary);
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(BLANK);
  const [addingExpense, setAddingExpense] = useState({});
  async function refresh() { await reload(); onItemsChange?.(); }
  const closeEditor = () => { setEditing(null); setValues(BLANK); };
  const openEditor = (item = null) => { setEditing(item?.id || 'new'); setValues(item ? formValues(item) : { ...BLANK, item_type: itemTypes[0] || 'other' }); };
  async function save() { const payload = { ...values, title: TYPE_LABELS[values.item_type] || values.item_type.replaceAll('_', ' '), starts_at: values.starts_at || null, ends_at: values.ends_at || null, location: String(values.location || '').trim() || null, provider: String(values.provider || '').trim() || null, confirmation_number: String(values.confirmation_number || '').trim() || null, cost: values.cost === '' ? null : Number(values.cost), notes: String(values.notes || '').trim() || null }; if (editing === 'new') await createItineraryItem(eventId, payload); else await updateItineraryItem(editing, payload); closeEditor(); await refresh(); }
  async function remove(item) { if (!confirm(`Delete ${item.title}?`)) return; try { await deleteItineraryItem(item.id); await refresh(); } catch (err) { alert(err.message); } }
  async function addExpense(item) {
    const enteredAmount = item.cost == null ? prompt('Enter the travel expense amount:') : item.cost;
    if (enteredAmount === null) return;
    const amount = Number(enteredAmount);
    if (!Number.isFinite(amount) || amount < 0) { alert('Enter a valid expense amount.'); return; }
    const description = `${TYPE_LABELS[item.item_type] || item.item_type.replaceAll('_', ' ')}${item.provider ? ` — ${item.provider}` : ''}`;
    setAddingExpense((current) => ({ ...current, [item.id]: true }));
    try {
      const expenses = await fetchExpenses(eventId);
      const exists = expenses.some((expense) => expense.category === expenseCategory(item.item_type) && expense.description === description && Number(expense.amount) === amount);
      if (!exists) await createExpense(eventId, { category: expenseCategory(item.item_type), description, amount, status: 'planned', incurred_on: item.starts_at?.slice(0, 10) || null, vendor: item.provider || null, reimbursable: false, reimbursement_status: 'not_applicable' });
      if (item.cost == null) await updateItineraryItem(item.id, { cost: amount });
      setAddingExpense((current) => ({ ...current, [item.id]: 'done' }));
      await refresh();
    } catch (error) { setAddingExpense((current) => ({ ...current, [item.id]: false })); alert(error.message); }
  }
  if (!eventId) return <p className="empty-hint">Itinerary is available once this item is on the Calendar.</p>;
  const visibleRows = rows.filter((item) => itemTypes.includes(item.item_type));
  return <section><div className="detail-section-title">{title}</div><button className="btn-sm btn-sm-ghost" onClick={() => openEditor()}>+ Add {title === 'Travel Details' ? 'Travel Item' : 'Itinerary Item'}</button>{editing && <Editor values={values} setValues={setValues} editing={editing} onCancel={closeEditor} onSave={save} itemTypes={itemTypes} />}{loading && !rows.length ? <LoadingIndicator label="Loading itinerary…" /> : error ? <section className="empty-hint" role="alert">Couldn’t load itinerary. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : <div className="responses-table-wrap" style={{ marginTop: 14 }}><table className="responses-table"><thead><tr><th>Type</th><th>Address</th><th>Starts</th><th>Name / confirmation</th><th>Cost</th><th>Status</th><th></th></tr></thead><tbody>{visibleRows.length === 0 ? <tr><td colSpan="7">No {title.toLowerCase()} yet.</td></tr> : visibleRows.map((item) => <tr key={item.id}><td>{TYPE_LABELS[item.item_type] || item.item_type.replaceAll('_', ' ')}</td><td>{item.location || '—'}</td><td>{dateTime(item.starts_at)}</td><td>{[item.provider, item.confirmation_number].filter(Boolean).join(' · ') || '—'}</td><td>{item.cost == null ? '—' : `$${Number(item.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td><td>{item.status}</td><td><button className="btn-sm btn-sm-ghost" disabled={Boolean(addingExpense[item.id])} onClick={() => addExpense(item)}>{addingExpense[item.id] === 'done' ? 'Added to Expenses ✓' : addingExpense[item.id] ? 'Adding…' : 'Add as Expense'}</button><button className="btn-sm btn-sm-ghost" onClick={() => openEditor(item)}>Edit</button> <button className="btn-sm btn-sm-danger" onClick={() => remove(item)}>🗑️</button></td></tr>)}</tbody></table></div>}</section>;
}
