import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import { supabase } from '../../lib/supabase.js';
import { adoptEvent, engagementForEvent, fetchCalendarRange } from './calendarService.js';

const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = new Date();
const todayValue = key(today);

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [jumpDate, setJumpDate] = useState(todayValue);
  const [data, setData] = useState({ events: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const range = useMemo(() => {
    const start = new Date(month);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 42);
    return { start, end };
  }, [month]);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await fetchCalendarRange(range.start.toISOString(), range.end.toISOString())); }
    catch (err) { setError(err); }
    finally { setLoading(false); }
  }, [range]);
  useEffect(() => { reload(); }, [reload]);
  const events = useMemo(() => data.events.reduce((out, event) => {
    const start = new Date(event.starts_at);
    const end = event.ends_at ? new Date(event.ends_at) : start;
    for (const day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day <= end; day.setDate(day.getDate() + 1)) (out[key(day)] ||= []).push(event);
    return out;
  }, {}), [data.events]);
  const tasks = useMemo(() => data.tasks.reduce((out, task) => {
    if (task.due_date) (out[task.due_date] ||= []).push(task);
    return out;
  }, {}), [data.tasks]);
  const jumpToDate = (value) => {
    setJumpDate(value);
    if (!value) return;
    const selected = new Date(`${value}T12:00:00`);
    setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  };
  const open = async (event) => {
    if (!['speaking', 'training'].includes(event.event_type)) return navigate(`/admin/events/${event.id}`);
    try {
      const linked = await engagementForEvent(event.id, event.event_type);
      if (linked) return navigate(`/admin/${event.event_type === 'speaking' ? 'speaking' : 'trainings'}/${linked.id}`);
      if (!confirm(`“${event.title}” is not linked to a ${event.event_type === 'speaking' ? 'Speaking Engagement' : 'Training'} record. Create one from this event?`)) return navigate(`/admin/events/${event.id}`);
      const { data: full, error: fetchError } = await supabase.from('events').select('*').eq('id', event.id).single();
      if (fetchError) throw fetchError;
      const id = await adoptEvent(full, event.event_type);
      navigate(`/admin/${event.event_type === 'speaking' ? 'speaking' : 'trainings'}/${id}`);
    } catch (err) {
      alert(err.message);
      navigate(`/admin/events/${event.id}`);
    }
  };
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(range.start);
    day.setDate(day.getDate() + index);
    return day;
  });
  return <div className="view active"><div className="view-header"><h1 className="view-title">Calendar</h1><div className="calendar-actions"><button className="btn btn-ghost" onClick={() => navigate('/admin/tasks?new=1')}>+ Task</button><button className="btn btn-ghost" onClick={() => navigate('/admin/events/new')}>+ Event</button><button className="btn btn-ghost" onClick={() => navigate('/admin/trainings/new')}>+ New Training</button><button className="btn btn-primary" onClick={() => navigate('/admin/speaking/new')}>+ Speaking Engagement</button></div></div><div className="calendar-toolbar"><div><button className="btn btn-ghost" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button><button className="btn btn-ghost" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setJumpDate(todayValue); }}>Today</button><button className="btn btn-ghost" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button></div><label className="calendar-date-jump"><span>Go to date</span><input className="field-input" type="date" value={jumpDate} onChange={(event) => jumpToDate(event.target.value)} /></label></div><h2 className="detail-section-title">{month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h2>{error ? <section className="empty-hint" role="alert">Couldn’t load the calendar. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading calendar…" /> : <div className="calendar-grid">{names.map((name) => <div className="calendar-day-header" key={name}>{name}</div>)}{days.map((day) => <div className={`calendar-day-cell ${day.getMonth() !== month.getMonth() ? 'outside-month' : ''}`} key={key(day)}><div className="calendar-day-number">{day.getDate()}</div>{(events[key(day)] || []).map((event) => <button className={`calendar-event-chip event-type-${event.event_type}`} key={`${key(day)}-${event.id}`} onClick={() => open(event)}>{event.title}</button>)}{(tasks[key(day)] || []).map((task) => <button className={`calendar-task-chip ${task.status === 'done' ? 'task-done' : ''}`} key={task.id} onClick={() => navigate('/admin/tasks')}>{task.status === 'done' ? '✓ ' : '☐ '}{task.title}</button>)}</div>)}</div>}</div>;
}
