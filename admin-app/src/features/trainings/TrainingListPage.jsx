import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatDate } from '../../utils/format.js';
import { fetchTrainings } from './trainingService.js';

export default function TrainingListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [showCancelled, setShowCancelled] = useState(false);
  const navigate = useNavigate();
  const reload = useCallback(async () => { setLoading(true); try { setRows(await fetchTrainings()); setError(null); } catch (err) { setError(err); } finally { setLoading(false); } }, []);
  useEffect(() => { reload(); }, [reload]);
  const open = (row) => navigate(`/admin/trainings/${row.id}`);
  const onRowKeyDown = (keyEvent, row) => { if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); open(row); } };
  const statuses = [...new Set(rows.map((row) => row.status).filter(Boolean))].sort();
  const visibleRows = rows.filter((row) => (showCancelled || statusFilter === 'cancelled' || row.status !== 'cancelled') && (deliveryFilter === 'all' || row.delivery_method === deliveryFilter) && (statusFilter === 'all' || row.status === statusFilter)).sort((left, right) => sortBy === 'name' ? (left.title || '').localeCompare(right.title || '') : (left.starts_at || '9999-12-31').localeCompare(right.starts_at || '9999-12-31'));
  return <div className="view active"><div className="view-header"><h1 className="view-title">Trainings</h1><button className="btn btn-primary" onClick={() => navigate('/admin/trainings/new')}>+ New Training</button></div><div className="event-list-controls" aria-label="Training list controls"><label><span>Delivery</span><select className="field-input" value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)}><option value="all">All delivery methods</option><option value="in_person">In Person</option><option value="virtual">Virtual</option></select></label><label><span>Status</span><select className="field-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><label><span>Sort by</span><select className="field-input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="date">Date</option><option value="name">Name (A–Z)</option></select></label><label className="filter-toggle"><input type="checkbox" checked={showCancelled} onChange={(event) => setShowCancelled(event.target.checked)} /><span>Show cancelled</span></label></div>{error ? <section className="empty-hint" role="alert">Couldn’t load trainings. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading trainings…" /> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Training</th><th>Client</th><th>Delivery</th><th>Starts</th><th>Status</th></tr></thead><tbody>{visibleRows.length ? visibleRows.map((row) => <tr className="client-list-row clickable-row" key={row.id} tabIndex={0} role="button" aria-label={`Open ${row.title}`} onClick={() => open(row)} onKeyDown={(keyEvent) => onRowKeyDown(keyEvent, row)}><td>{row.title}</td><td>{row.companies?.name || '—'}</td><td>{row.delivery_method === 'virtual' ? 'Virtual' : 'In Person'}</td><td>{row.starts_at ? formatDate(row.starts_at.slice(0, 10)) : '—'}</td><td><StatusBadge status={row.status} /></td></tr>) : <tr><td colSpan="5">No trainings match these filters.</td></tr>}</tbody></table></div>}</div>;
}
