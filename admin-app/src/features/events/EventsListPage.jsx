import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/format.js';
import { fetchEvents } from './eventsService.js';

export default function EventsListPage() {
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();
  const reload = () => fetchEvents().then(setRows).catch((err) => alert(err.message));
  useEffect(() => { reload(); }, []);
  return <div className="view active"><div className="view-header"><h1 className="view-title">Events</h1><button className="btn btn-primary" onClick={() => navigate('/admin/events/new')}>+ New Event</button></div><div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Event</th><th>Type</th><th>Status</th><th>Starts</th><th>Location</th><th>Client</th></tr></thead><tbody>{rows.length ? rows.map((event) => <tr className="client-list-row" key={event.id}><td><Link to={`/admin/events/${event.id}`}>{event.title}</Link></td><td>{event.event_type.replaceAll('_', ' ')}</td><td>{event.status.replaceAll('_', ' ')}</td><td>{event.starts_at ? formatDate(event.starts_at.slice(0, 10)) : '—'}</td><td>{event.location || '—'}</td><td>{event.companies?.name || '—'}</td></tr>) : <tr><td colSpan="6">No events yet.</td></tr>}</tbody></table></div></div>;
}
