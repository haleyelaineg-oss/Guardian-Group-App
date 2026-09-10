import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import { fetchPresentationSessions, fetchPresentationSessionUsage } from './sessionService.js';

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();
  const reload = useCallback(async () => {
    setLoading(true);
    try { const [rows, counts] = await Promise.all([fetchPresentationSessions(), fetchPresentationSessionUsage()]); setSessions(rows); setUsage(counts); setError(null); }
    catch (err) { setError(err); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const q = search.trim().toLowerCase();
  const visible = sessions.filter((session) => (showArchived || session.status !== 'archived') && (!q || [session.title, session.session_type, session.intended_audience, session.description].filter(Boolean).join(' ').toLowerCase().includes(q)));
  return <div className="view active"><div className="view-header"><div><h1 className="view-title">Sessions & Presentations</h1><p className="view-sub">Build reusable presentations once, then add them to any speaking engagement.</p></div><button className="btn btn-primary" onClick={() => navigate('/admin/sessions/new')}>+ New Session</button></div><div className="event-list-controls" aria-label="Session library controls"><label className="session-search"><span>Search</span><input className="field-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, type, or audience" /></label><label className="filter-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /><span>Show archived</span></label></div>{error ? <section className="empty-hint" role="alert">Couldn’t load the session library. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading sessions…" /> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Session</th><th>Type</th><th>Duration</th><th>Delivered</th><th>Status</th></tr></thead><tbody>{visible.length ? visible.map((session) => <tr className="client-list-row clickable-row" key={session.id} tabIndex={0} role="button" aria-label={`Open ${session.title}`} onClick={() => navigate(`/admin/sessions/${session.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/admin/sessions/${session.id}`); } }}><td><strong>{session.title}</strong>{session.intended_audience && <div className="table-secondary">{session.intended_audience}</div>}</td><td>{session.session_type || '—'}</td><td>{session.duration_minutes ? `${session.duration_minutes} min` : '—'}</td><td>{usage[session.id] || 0}</td><td>{session.status === 'active' ? 'Active' : session.status === 'draft' ? 'Draft' : 'Archived'}</td></tr>) : <tr><td colSpan="5">No sessions match these filters.</td></tr>}</tbody></table></div>}</div>;
}
