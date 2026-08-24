import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ExpenseManager from '../expenses/ExpenseManager.jsx';
import ItineraryManager from '../itinerary/ItineraryManager.jsx';
import DocumentManager from '../documents/DocumentManager.jsx';
import { supabase } from '../../lib/supabase.js';

export default function EventDetailPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null); const [tab, setTab] = useState('Itinerary');
  const reload = useCallback(async () => { const { data, error } = await supabase.from('events').select('*').eq('id', id).single(); if (error) throw error; setEvent(data); }, [id]);
  useEffect(() => { reload().catch((error) => alert(error.message)); }, [reload]);
  if (!event) return <p className="empty-hint">Loading...</p>;
  return <div className="view active"><div className="view-header"><div><Link to="/admin/events">← Events</Link><h1 className="view-title">{event.title}</h1></div></div><div className="tab-bar">{['Itinerary', 'Financials', 'Documents'].map((name) => <button key={name} className={`tab-btn ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)}>{name}</button>)}</div>{tab === 'Itinerary' && <ItineraryManager eventId={id} />}{tab === 'Financials' && <ExpenseManager eventId={id} incomeAmount={event.income_amount} />}{tab === 'Documents' && <DocumentManager eventId={id} />}</div>;
}
