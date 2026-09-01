import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatDate } from '../../utils/format.js';
import { fetchTrainings } from './trainingService.js';

export default function TrainingListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const reload = useCallback(async () => { setLoading(true); try { setRows(await fetchTrainings()); setError(null); } catch (err) { setError(err); } finally { setLoading(false); } }, []);
  useEffect(() => { reload(); }, [reload]);
  return <div className="view active"><div className="view-header"><h1 className="view-title">Trainings</h1><button className="btn btn-primary" onClick={() => navigate('/admin/trainings/new')}>+ New Training</button></div>{error ? <section className="empty-hint" role="alert">Couldn’t load trainings. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Training</th><th>Client</th><th>Delivery</th><th>Starts</th><th>Status</th></tr></thead><tbody>{loading ? <tr><td colSpan="5">Loading trainings...</td></tr> : rows.length ? rows.map((row) => <tr className="client-list-row" key={row.id}><td><Link to={`/admin/trainings/${row.id}`}>{row.title}</Link></td><td>{row.companies?.name || '—'}</td><td>{row.delivery_method === 'virtual' ? 'Virtual' : 'In Person'}</td><td>{row.starts_at ? formatDate(row.starts_at.slice(0, 10)) : '—'}</td><td><StatusBadge status={row.status} /></td></tr>) : <tr><td colSpan="5">No trainings yet.</td></tr>}</tbody></table></div>}</div>;
}
