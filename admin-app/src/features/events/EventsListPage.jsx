import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatDate, formatShortDate } from '../../utils/format.js';
import { fetchEvents } from './eventsService.js';

export default function EventsListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [showCancelled, setShowCancelled] = useState(false);
  const navigate = useNavigate();
  const reload = useCallback(async () => { setLoading(true); try { setRows(await fetchEvents()); setError(null); } catch (err) { setError(err); } finally { setLoading(false); } }, []);
  useEffect(() => { reload(); }, [reload]);
  const open = (event) => navigate(`/admin/events/${event.id}`);
  const onRowKeyDown = (keyEvent, event) => { if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); open(event); } };
  const types = [...new Set(rows.map((event) => event.event_type).filter(Boolean))].sort();
  const statuses = [...new Set(rows.map((event) => event.status).filter(Boolean))].sort();
  const visibleRows = rows.filter((event) => (showCancelled || statusFilter === 'cancelled' || event.status !== 'cancelled') && (typeFilter === 'all' || event.event_type === typeFilter) && (statusFilter === 'all' || event.status === statusFilter)).sort((left, right) => sortBy === 'name' ? (left.title || '').localeCompare(right.title || '') : (left.starts_at || '9999-12-31').localeCompare(right.starts_at || '9999-12-31'));
  return <div className="view active"><div className="view-header"><h1 className="view-title">Events</h1><button className="btn btn-primary" onClick={() => navigate('/admin/events/new')}>+ New Event</button></div><div className="event-list-controls" aria-label="Event list controls"><label><span>Type</span><select className="field-input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option>{types.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label><label><span>Status</span><select className="field-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><label><span>Sort by</span><select className="field-input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="date">Date</option><option value="name">Name (A–Z)</option></select></label><label className="filter-toggle"><input type="checkbox" checked={showCancelled} onChange={(event) => setShowCancelled(event.target.checked)} /><span>Show cancelled</span></label></div>{error ? <section className="empty-hint" role="alert">Couldn’t load events. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading events…" /> : <div className="responses-table-wrap"><table className="responses-table event-list-table"><thead><tr><th>Event</th><th>Type</th><th>Status</th><th>Starts</th><th>Location</th><th>Client</th></tr></thead><tbody>{visibleRows.length ? visibleRows.map((event) => <tr className="client-list-row clickable-row" key={event.id} tabIndex="0" role="button" aria-label={`Open ${event.title}`} onClick={() => open(event)} onKeyDown={(keyEvent) => onRowKeyDown(keyEvent, event)}><td>{event.title}</td><td>{event.event_type.replaceAll('_', ' ')}</td><td><StatusBadge status={event.status} /></td><td>{event.starts_at ? <><span className="date-full">{formatDate(event.starts_at.slice(0, 10))}</span><span className="date-short">{formatShortDate(event.starts_at.slice(0, 10))}</span></> : '—'}</td><td>{event.location || '—'}</td><td>{event.companies?.name || '—'}</td></tr>) : <tr><td colSpan="6">No events match these filters.</td></tr>}</tbody></table></div>}</div>;
}
