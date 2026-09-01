import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatDate } from '../../utils/format.js';
import { fetchEvents } from './eventsService.js';

export default function EventsListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const reload = useCallback(async () => { setLoading(true); try { setRows(await fetchEvents()); setError(null); } catch (err) { setError(err); } finally { setLoading(false); } }, []);
  useEffect(() => { reload(); }, [reload]);
  return <div className="view active"><div className="view-header"><h1 className="view-title">Events</h1><button className="btn btn-primary" onClick={() => navigate('/admin/events/new')}>+ New Event</button></div>{error ? <section className="empty-hint" role="alert">Couldn’t load events. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading events…" /> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Event</th><th>Type</th><th>Status</th><th>Starts</th><th>Location</th><th>Client</th></tr></thead><tbody>{rows.length ? rows.map((event) => <tr className="client-list-row" key={event.id}><td><Link to={`/admin/events/${event.id}`}>{event.title}</Link></td><td>{event.event_type.replaceAll('_', ' ')}</td><td><StatusBadge status={event.status} /></td><td>{event.starts_at ? formatDate(event.starts_at.slice(0, 10)) : '—'}</td><td>{event.location || '—'}</td><td>{event.companies?.name || '—'}</td></tr>) : <tr><td colSpan="6">No events yet.</td></tr>}</tbody></table></div>}</div>;
}
