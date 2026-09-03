import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import Modal from '../../components/Modal.jsx';
import TaskForm from '../tasks/TaskForm.jsx';
import { createTask, fetchEventsForSelect } from '../tasks/tasksService.js';
import { supabase } from '../../lib/supabase.js';
import { adoptEvent, engagementForEvent, fetchCalendarRange } from './calendarService.js';

const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = new Date();
const todayValue = key(today);

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function eventSegmentsForWeek(events, weekDays) {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const segments = events
    .map((event) => ({ event, start: startOfDay(event.starts_at), end: startOfDay(event.ends_at || event.starts_at) }))
    .filter(({ start, end }) => start <= weekEnd && end >= weekStart)
    .map(({ event, start, end }) => ({
      event,
      start: Math.max(0, Math.round((start - weekStart) / 86400000)),
      end: Math.min(6, Math.round((end - weekStart) / 86400000)),
    }))
    .sort((a, b) => a.start - b.start || b.end - b.start || a.event.title.localeCompare(b.event.title));

  const laneEnds = [];
  return segments.map((segment) => {
    let lane = laneEnds.findIndex((end) => end < segment.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = segment.end;
    return { ...segment, lane };
  });
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [jumpDate, setJumpDate] = useState(todayValue);
  const [data, setData] = useState({ events: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskEventOptions, setTaskEventOptions] = useState([]);
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
  const openTaskModal = async () => {
    setShowTaskModal(true);
    try { setTaskEventOptions(await fetchEventsForSelect()); }
    catch (err) { alert(`Couldn’t load events for this task: ${err.message}`); }
  };
  const createCalendarTask = async (values) => {
    await createTask(values);
    await reload();
  };
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
  const weeks = Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  return <div className="view active calendar-view">{showTaskModal && <Modal title="Create New Task" onClose={() => setShowTaskModal(false)}><TaskForm mode="create" eventOptions={taskEventOptions} onSubmit={createCalendarTask} onSaved={() => setShowTaskModal(false)} onCancel={() => setShowTaskModal(false)} /></Modal>}<div className="view-header"><h1 className="view-title">Calendar</h1></div><div className="calendar-toolbar"><div className="calendar-navigation"><div><button className="btn btn-ghost" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button><button className="btn btn-ghost" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setJumpDate(todayValue); }}>Today</button><button className="btn btn-ghost" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button></div><label className="calendar-date-jump"><span>Go to date</span><input className="field-input" type="date" value={jumpDate} onChange={(event) => jumpToDate(event.target.value)} /></label></div><div className="calendar-actions"><button className="btn btn-ghost" onClick={openTaskModal}>+ Task</button><button className="btn btn-ghost" onClick={() => navigate('/admin/events/new', { state: { returnTo: '/admin/calendar' } })}>+ Event</button><button className="btn btn-ghost" onClick={() => navigate('/admin/trainings/new', { state: { returnTo: '/admin/calendar' } })}>+ New Training</button><button className="btn btn-ghost" onClick={() => navigate('/admin/speaking/new', { state: { returnTo: '/admin/calendar' } })}>+ Speaking Engagement</button></div></div><h2 className="detail-section-title">{month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h2>{error ? <section className="empty-hint" role="alert">Couldn’t load the calendar. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading calendar…" /> : <div className="calendar-grid"><div className="calendar-weekday-headers">{names.map((name) => <div className="calendar-day-header" key={name}>{name}</div>)}</div>{weeks.map((week) => {
    const segments = eventSegmentsForWeek(data.events, week);
    const lanes = segments.reduce((count, segment) => Math.max(count, segment.lane + 1), 0);
    return <div className="calendar-week" key={key(week[0])} style={{ '--calendar-event-lanes': lanes }}><div className="calendar-week-days">{week.map((day) => <div className={`calendar-day-cell ${day.getMonth() !== month.getMonth() ? 'outside-month' : ''}`} key={key(day)}><div className="calendar-day-number">{day.getDate()}</div>{(tasks[key(day)] || []).map((task) => <button className={`calendar-task-chip ${task.status === 'done' ? 'task-done' : ''}`} key={task.id} onClick={() => navigate(`/admin/tasks?edit=${task.id}`)}>{task.status === 'done' ? '✓ ' : '☐ '}{task.title}</button>)}</div>)}</div><div className="calendar-event-lanes">{segments.map(({ event, start, end, lane }) => <button className={`calendar-event-chip event-type-${event.event_type}`} key={`${event.id}-${start}`} style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: lane + 1 }} onClick={() => open(event)}>{event.title}</button>)}</div></div>;
  })}</div>}</div>;
}
