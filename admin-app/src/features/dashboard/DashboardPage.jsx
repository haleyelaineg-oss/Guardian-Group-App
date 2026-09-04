import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import { supabase } from '../../lib/supabase.js';
import { engagementForEvent } from '../calendar/calendarService.js';
import { canonicalIncomeSummary } from '../financial/financialCalculations.js';
import { formatCurrency, formatDate, todayIsoDate } from '../../utils/format.js';

function eventWhen(event) {
  if (!event.starts_at) return 'Date TBD';
  const date = new Date(event.starts_at);
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return event.all_day ? label : `${label} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function RevenueCard({ value, label, sub, danger = false, accent = false }) {
  return <div className={`stat-card ${danger ? 'accent-danger' : accent ? 'accent' : ''}`}><div className="stat-value">{formatCurrency(value)}</div><div className="stat-label">{label}</div><div className="stat-sub">{sub}</div></div>;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const reload = useCallback(async () => {
    setError(null);
    try {
      const [events, tasks, speaking, trainings, incomes, links, paymentAllocations] = await Promise.all([
        supabase.from('events').select('id,title,event_type,starts_at,ends_at,all_day,location,status').gte('starts_at', new Date().toISOString()).neq('status', 'cancelled').order('starts_at').limit(8),
        supabase.from('tasks').select('id,title,due_date,status,owner,event_id').neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(8),
        supabase.from('speaking_engagements').select('id', { count: 'exact', head: true }).in('status', ['selected', 'contracting', 'planning', 'ready']),
        supabase.from('training_engagements').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'planning', 'ready']),
        supabase.from('income').select('id,amount,certainty_status,income_kind'),
        supabase.from('income_document_links').select('income_id,allocated_amount,documents(id,doc_type,status,due_date)'),
        supabase.from('payment_allocations').select('income_id,document_id,allocated_amount,payments(direction)'),
      ]);
      const failed = [events, tasks, speaking, trainings, incomes, links, paymentAllocations].find((result) => result.error);
      if (failed) throw failed.error;
      const summary = canonicalIncomeSummary({ incomes: incomes.data || [], links: links.data || [], paymentAllocations: paymentAllocations.data || [] });
      setData({ events: events.data || [], tasks: tasks.data || [], speaking: speaking.count || 0, trainings: trainings.count || 0, revenue: { booked: summary.confirmed, earned: summary.invoiced, accountsReceivable: summary.receivable, collected: summary.received } });
    } catch (err) { setError(err); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const openCalendarResource = async (event) => {
    if (!['speaking', 'training'].includes(event.event_type)) return navigate(`/admin/events/${event.id}`);
    try {
      const engagement = await engagementForEvent(event.id, event.event_type);
      if (engagement) return navigate(`/admin/${event.event_type === 'speaking' ? 'speaking' : 'trainings'}/${engagement.id}`);
    } catch {
      // The Event workspace remains a safe fallback if a linked lookup fails.
    }
    navigate(`/admin/events/${event.id}`);
  };
  const toggleTask = async (task) => {
    try {
      const { error: updateError } = await supabase.from('tasks').update({ status: task.status === 'done' ? 'todo' : 'done' }).eq('id', task.id);
      if (updateError) throw updateError;
      await reload();
    } catch (err) { alert(`Could not update task: ${err.message}`); }
  };
  if (error) return <div className="view active"><div className="view-header"><h1 className="view-title">Dashboard</h1></div><section className="empty-hint" role="alert">Couldn’t load the dashboard. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section></div>;
  if (!data) return <LoadingIndicator label="Loading dashboard…" />;
  const { revenue } = data;
  const today = todayIsoDate();
  return <div className="view active"><div className="view-header"><h1 className="view-title">Dashboard</h1></div><div className="stats-grid dashboard-operations-grid"><div className="stat-card accent"><div className="stat-value">{data.events.length}</div><div className="stat-label">Upcoming Events</div></div><div className="stat-card"><div className="stat-value">{data.tasks.length}</div><div className="stat-label">Open Tasks</div></div><div className="stat-card"><div className="stat-value">{data.speaking}</div><div className="stat-label">Active Speaking</div></div><div className="stat-card"><div className="stat-value">{data.trainings}</div><div className="stat-label">Active Trainings</div></div></div><div className="detail-section-title">Revenue Snapshot</div><div className="stats-grid"><RevenueCard value={revenue.booked} label="Booked Revenue" sub="all sources" /><RevenueCard value={revenue.earned} label="Earned Revenue" sub="completed / invoiced" /><RevenueCard value={revenue.accountsReceivable} label="Accounts Receivable" sub="open invoices" danger={Boolean(revenue.accountsReceivable)} /><RevenueCard value={revenue.collected} label="Collected Revenue" sub="received" accent /></div><div className="dashboard-split-row"><section><div className="dashboard-section-header"><div className="detail-section-title">Upcoming Events</div><Link className="dashboard-section-link" to="/admin/calendar">View calendar →</Link></div>{data.events.length ? data.events.map((event) => <button className="dashboard-event-row" type="button" key={event.id} onClick={() => openCalendarResource(event)}><span className="dashboard-event-main"><span className="dashboard-event-title">{event.title}</span><span className="dashboard-event-meta">{eventWhen(event)}{event.location ? ` · ${event.location}` : ''}</span></span><span className={`calendar-event-chip event-type-${event.event_type || 'other'}`}>{event.event_type || 'other'}</span></button>) : <p className="empty-hint">Nothing on the calendar yet.</p>}</section><section><div className="dashboard-section-header"><div className="detail-section-title">Open Tasks</div><Link className="dashboard-section-link" to="/admin/tasks">View tasks →</Link></div>{data.tasks.length ? data.tasks.map((task) => <div className="dashboard-event-row" key={task.id}><Link className="dashboard-event-main" to="/admin/tasks"><span className="dashboard-event-title">{task.title}</span><span className={`dashboard-event-meta ${task.due_date && task.due_date < today ? 'task-row-overdue' : ''}`}>{task.due_date ? formatDate(task.due_date) : 'No due date'}{task.owner && task.owner !== 'Unassigned' ? ` · ${task.owner}` : ''}</span></Link><input type="checkbox" aria-label={`Mark ${task.title} complete`} checked={task.status === 'done'} onChange={() => toggleTask(task)} /></div>) : <p className="empty-hint">No open tasks.</p>}</section></div></div>;
}
