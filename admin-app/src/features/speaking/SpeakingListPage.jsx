import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { fetchSpeakingEngagements } from './speakingService.js';

export default function SpeakingListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const reload = useCallback(async () => { setLoading(true); try { setRows(await fetchSpeakingEngagements()); setError(null); } catch (err) { setError(err); } finally { setLoading(false); } }, []);
  useEffect(() => { reload(); }, [reload]);
  return <div className="view active"><div className="view-header"><h1 className="view-title">Speaking Engagements</h1><button className="btn btn-primary" onClick={() => navigate('/admin/speaking/new')}>+ New Speaking Engagement</button></div>{error ? <section className="empty-hint" role="alert">Couldn’t load speaking engagements. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading speaking engagements…" /> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Event</th><th>Organization</th><th>Date</th><th>Status</th><th>Fee</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr className="client-list-row" key={row.id}><td><Link to={`/admin/speaking/${row.id}`}>{row.event_name}</Link></td><td>{row.organization_name || '—'}</td><td>{row.event_start_date ? formatDate(row.event_start_date) : row.cfp_deadline ? `CFP due ${formatDate(row.cfp_deadline)}` : '—'}</td><td><StatusBadge status={row.status} /></td><td>{formatCurrency(row.offered_fee ?? row.requested_fee)}</td></tr>) : <tr><td colSpan="5">No speaking engagements yet.</td></tr>}</tbody></table></div>}</div>;
}
