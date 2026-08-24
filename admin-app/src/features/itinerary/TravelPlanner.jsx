import { useState } from 'react';
import SaveButton from '../../components/SaveButton.jsx';
import { createItineraryItem } from '../events/eventResourcesService.js';

// Travel stays on event_itinerary_items; this wizard only creates deliberate
// planning stubs and never invents vendors, costs, or confirmations.
export default function TravelPlanner({ eventId, startsAt, endsAt, onCreated }) {
  const [needed, setNeeded] = useState(''); const [method, setMethod] = useState('drive');
  if (!eventId) return <p className="empty-hint">Travel planning is available after the event is linked.</p>;
  async function create() { if (needed !== 'yes') return; const types = method === 'fly' ? [['departing_flight', 'Departing Flight', startsAt], ['return_flight', 'Return Flight', endsAt]] : [['driving_to', 'Driving To', startsAt], ['driving_home', 'Driving Home', endsAt]]; await Promise.all(types.map(([item_type, title, starts_at]) => createItineraryItem(eventId, { item_type, title, starts_at: starts_at || null, status: 'planned' }))); await onCreated?.(); setNeeded(''); }
  return <section className="builder-card"><h3 className="card-title">Travel Planner</h3><div className="fields-grid"><label className="field-group half"><span className="field-label">Is travel needed?</span><select className="field-input" value={needed} onChange={(e) => setNeeded(e.target.value)}><option value="">— Select —</option><option value="yes">Yes</option><option value="no">No</option></select></label>{needed === 'yes' && <label className="field-group half"><span className="field-label">Method</span><select className="field-input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="drive">Drive</option><option value="fly">Fly</option></select></label>}</div>{needed === 'yes' && <div className="create-form-actions"><SaveButton onSave={create} onSaved={onCreated} label="Create Travel Plan →" /></div>}{needed === 'no' && <p className="field-hint">No travel items will be created.</p>}</section>;
}
