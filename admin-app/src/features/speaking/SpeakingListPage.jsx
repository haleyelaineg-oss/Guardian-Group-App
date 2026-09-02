import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { fetchSpeakingEngagements } from './speakingService.js';

export default function SpeakingListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [showCancelled, setShowCancelled] = useState(false);
  const navigate = useNavigate();
  const reload = useCallback(async () => { setLoading(true); try { setRows(await fetchSpeakingEngagements()); setError(null); } catch (err) { setError(err); } finally { setLoading(false); } }, []);
  useEffect(() => { reload(); }, [reload]);
  const open = (row) => navigate(`/admin/speaking/${row.id}`);
  const onRowKeyDown = (keyEvent, row) => { if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); open(row); } };
  const statuses = [...new Set(rows.map((row) => row.status).filter(Boolean))].sort();
  const visibleRows = rows.filter((row) => (showCancelled || statusFilter === 'cancelled' || row.status !== 'cancelled') && (statusFilter === 'all' || row.status === statusFilter)).sort((left, right) => sortBy === 'name' ? (left.event_name || '').localeCompare(right.event_name || '') : (left.event_start_date || left.cfp_deadline || '9999-12-31').localeCompare(right.event_start_date || right.cfp_deadline || '9999-12-31'));
  return <div className="view active"><div className="view-header"><h1 className="view-title">Speaking Engagements</h1><button className="btn btn-primary" onClick={() => navigate('/admin/speaking/new')}>+ New Speaking Engagement</button></div><div className="event-list-controls" aria-label="Speaking engagement list controls"><label><span>Status</span><select className="field-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><label><span>Sort by</span><select className="field-input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="date">Date</option><option value="name">Name (A–Z)</option></select></label><label className="filter-toggle"><input type="checkbox" checked={showCancelled} onChange={(event) => setShowCancelled(event.target.checked)} /><span>Show cancelled</span></label></div>{error ? <section className="empty-hint" role="alert">Couldn’t load speaking engagements. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading speaking engagements…" /> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Event</th><th>Organization</th><th>Date</th><th>Status</th><th>Fee</th></tr></thead><tbody>{visibleRows.length ? visibleRows.map((row) => <tr className="client-list-row clickable-row" key={row.id} tabIndex={0} role="button" aria-label={`Open ${row.event_name}`} onClick={() => open(row)} onKeyDown={(keyEvent) => onRowKeyDown(keyEvent, row)}><td>{row.event_name}</td><td>{row.organization_name || '—'}</td><td>{row.event_start_date ? formatDate(row.event_start_date) : row.cfp_deadline ? `CFP due ${formatDate(row.cfp_deadline)}` : '—'}</td><td><StatusBadge status={row.status} /></td><td>{formatCurrency(row.offered_fee ?? row.requested_fee)}</td></tr>) : <tr><td colSpan="5">No speaking engagements match these filters.</td></tr>}</tbody></table></div>}</div>;
}
