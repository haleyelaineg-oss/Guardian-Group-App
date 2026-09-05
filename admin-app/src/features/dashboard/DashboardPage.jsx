import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import Modal from '../../components/Modal.jsx';
import SaveButton from '../../components/SaveButton.jsx';
import { supabase } from '../../lib/supabase.js';
import { engagementForEvent } from '../calendar/calendarService.js';
import { createExpense, uploadDocument } from '../events/eventResourcesService.js';
import { createGeneralExpense } from '../financial/financialService.js';
import { canonicalIncomeSummary } from '../financial/financialCalculations.js';
import { createTask } from '../tasks/tasksService.js';
import { formatCurrency, formatDate, todayIsoDate } from '../../utils/format.js';
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, EXPENSE_TYPES, categoryForExpenseType } from '../expenses/expenseOptions.js';

function eventWhen(event) {
  if (!event.starts_at) return 'Date TBD';
  const date = new Date(event.starts_at);
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return event.all_day ? label : `${label} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function RevenueCard({ value, label, sub, danger = false, accent = false }) {
  return <div className={`stat-card ${danger ? 'accent-danger' : accent ? 'accent' : ''}`}><div className="stat-value">{formatCurrency(value)}</div><div className="stat-label">{label}</div><div className="stat-sub">{sub}</div></div>;
}

function QuickTaskModal({ eventOptions, onClose, onSaved }) {
  const [values, setValues] = useState({ title: '', due_date: '', owner: 'Unassigned', event_id: '' });
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!values.title.trim()) throw new Error('Task title is required.');
    await createTask({ title: values.title.trim(), due_date: values.due_date || null, owner: values.owner, event_id: values.event_id || null, link_url: null, notes: null });
  };
  return <Modal title="Add Task" onClose={onClose}><div className="fields-grid"><label className="field-group full"><span className="field-label">Task</span><input autoFocus className="field-input" value={values.title} onChange={(event) => set('title', event.target.value)} placeholder="What needs to be done?" /></label><label className="field-group half"><span className="field-label">Due date</span><input className="field-input" type="date" value={values.due_date} onChange={(event) => set('due_date', event.target.value)} /></label><label className="field-group half"><span className="field-label">Owner</span><select className="field-input" value={values.owner} onChange={(event) => set('owner', event.target.value)}><option value="Unassigned">Unassigned</option><option value="Dave">Dave</option><option value="Haley">Haley</option></select></label><label className="field-group full"><span className="field-label">Related event or engagement</span><select className="field-input" value={values.event_id} onChange={(event) => set('event_id', event.target.value)}><option value="">— None —</option>{eventOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><SaveButton onSave={save} onSaved={onSaved} label="Add Task" /></div></Modal>;
}

function QuickExpenseModal({ eventOptions, onClose, onSaved }) {
  const [values, setValues] = useState({ event_id: '', category: 'other_business_expense', expense_type: 'other', description: '', amount: '', status: 'paid', reimbursable: false, reimbursement_status: 'not_applicable' });
  const receiptRef = useRef(null);
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (values.amount === '' || Number(values.amount) < 0) throw new Error('Enter an expense amount of zero or more.');
    const receipt = receiptRef.current?.files?.[0];
    const description = values.description.trim() || values.expense_type.replaceAll('_', ' ');
    if (receipt && !values.event_id) throw new Error('Choose a related event or engagement before attaching a receipt.');
    if (values.event_id) {
      const expense = await createExpense(values.event_id, { category: values.category, expense_type: values.expense_type, description, amount: Number(values.amount), status: values.status, incurred_on: todayIsoDate(), vendor: null, reimbursable: values.reimbursement_status !== 'not_applicable', reimbursement_status: values.reimbursement_status });
      if (receipt) await uploadDocument(values.event_id, receipt, { expense_id: expense.id, notes: 'Receipt uploaded from Dashboard quick action' });
    } else {
      await createGeneralExpense({ category: values.category, expense_type: values.expense_type, description, amount: Number(values.amount), status: values.status, incurred_on: todayIsoDate(), notes: null });
    }
  };
  return <Modal title="Add Expense" onClose={onClose}><p className="field-hint">Choose a related record to add an event expense and attach its receipt. Leave it unselected for a general business expense.</p><div className="fields-grid"><label className="field-group full"><span className="field-label">Related event, engagement, or training</span><select className="field-input" value={values.event_id} onChange={(event) => set('event_id', event.target.value)}><option value="">No — general business expense</option>{eventOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="field-group half"><span className="field-label">Description</span><input className="field-input" value={values.description} onChange={(event) => set('description', event.target.value)} /></label><label className="field-group half"><span className="field-label">Amount</span><input className="field-input" type="number" min="0" step="0.01" value={values.amount} onChange={(event) => set('amount', event.target.value)} /></label><label className="field-group half"><span className="field-label">Expense Category</span><select className="field-input" value={values.category} onChange={(event) => set('category', event.target.value)}>{EXPENSE_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="field-group half"><span className="field-label">Expense Type</span><select className="field-input" value={values.expense_type} onChange={(event) => setValues((current) => ({ ...current, expense_type: event.target.value, category: categoryForExpenseType(event.target.value) }))}>{EXPENSE_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="field-group half"><span className="field-label">Status</span><select className="field-input" value={values.status} onChange={(event) => set('status', event.target.value)}>{EXPENSE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>{values.event_id && <label className="field-group half"><span className="field-label">Reimbursement Status</span><select className="field-input" value={values.reimbursement_status} onChange={(event) => set('reimbursement_status', event.target.value)}><option value="not_applicable">None</option><option value="submitted">Pending Reimbursement</option><option value="reimbursed">Reimbursement Received</option></select></label>}<label className="field-group full"><span className="field-label">Receipt photo or file</span><input ref={receiptRef} className="field-input" type="file" accept="image/*,.pdf" capture="environment" disabled={!values.event_id} /><span className="field-hint">{values.event_id ? 'On mobile, choose Camera to take a photo or Photo Library to select one.' : 'Select a related record to enable receipt upload.'}</span></label></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><SaveButton onSave={save} onSaved={onSaved} label="Add Expense" /></div></Modal>;
}

function QuickMileageModal({ eventOptions, onClose, onSaved }) {
  const [values, setValues] = useState({ event_id: '', travelled_on: todayIsoDate(), vehicle: '', starting_location: '', destination: '', business_purpose: '', starting_odometer: '', ending_odometer: '', business_miles: '', round_trip: false, notes: '' });
  const set = (key, value) => setValues((current) => {
    const next = { ...current, [key]: value };
    if (['starting_odometer', 'ending_odometer'].includes(key) && next.starting_odometer !== '' && next.ending_odometer !== '') next.business_miles = String(Math.max(0, Number(next.ending_odometer) - Number(next.starting_odometer)));
    return next;
  });
  const save = async () => {
    if (!values.event_id) throw new Error('Choose a related event, engagement, or training.');
    if (values.business_miles === '' || Number(values.business_miles) < 0) throw new Error('Enter business miles of zero or more.');
    const { error } = await supabase.from('event_mileage_entries').insert({ ...values, business_miles: Number(values.business_miles), starting_odometer: values.starting_odometer === '' ? null : Number(values.starting_odometer), ending_odometer: values.ending_odometer === '' ? null : Number(values.ending_odometer) });
    if (error) throw error;
  };
  return <Modal title="Add Mileage" onClose={onClose}><p className="field-hint">Mileage is tracked separately from cash expenses and must be linked to an event, engagement, or training.</p><div className="fields-grid"><label className="field-group full"><span className="field-label">Related event, engagement, or training</span><select className="field-input" value={values.event_id} onChange={(event) => set('event_id', event.target.value)}><option value="">Select a related record</option>{eventOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>{[['travelled_on', 'Date', 'date'], ['vehicle', 'Vehicle'], ['starting_location', 'Starting Location'], ['destination', 'Destination'], ['starting_odometer', 'Starting Odometer', 'number'], ['ending_odometer', 'Ending Odometer', 'number'], ['business_purpose', 'Business Purpose'], ['business_miles', 'Business Miles', 'number']].map(([key, label, type]) => <label className="field-group half" key={key}><span className="field-label">{label}</span><input className="field-input" type={type || 'text'} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.1' : undefined} value={values[key]} onChange={(event) => set(key, event.target.value)} /></label>)}<label className="field-group half"><span className="field-label"><input type="checkbox" checked={values.round_trip} onChange={(event) => set('round_trip', event.target.checked)} /> Round Trip</span></label></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><SaveButton onSave={save} onSaved={onSaved} label="Add Mileage" /></div></Modal>;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [quickAction, setQuickAction] = useState(null);
  const navigate = useNavigate();
  const reload = useCallback(async () => {
    setError(null);
    try {
      const [events, tasks, speaking, trainings, incomes, links, paymentAllocations, allEvents, trainingOptions, speakingOptions] = await Promise.all([
        supabase.from('events').select('id,title,event_type,starts_at,ends_at,all_day,location,status').gte('starts_at', new Date().toISOString()).neq('status', 'cancelled').order('starts_at').limit(8),
        supabase.from('tasks').select('id,title,due_date,status,owner,event_id').neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(8),
        supabase.from('speaking_engagements').select('id', { count: 'exact', head: true }).in('status', ['selected', 'contracting', 'planning', 'ready']),
        supabase.from('training_engagements').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'planning', 'ready']),
        supabase.from('income').select('id,amount,certainty_status,income_kind'),
        supabase.from('income_document_links').select('income_id,allocated_amount,documents(id,doc_type,status,due_date)'),
        supabase.from('payment_allocations').select('income_id,document_id,allocated_amount,payments(direction)'),
        supabase.from('events').select('id,title,event_type,starts_at,status').neq('status', 'cancelled').order('starts_at').limit(100),
        supabase.from('training_engagements').select('title,event_id').not('event_id', 'is', null),
        supabase.from('speaking_engagements').select('event_name,event_id').not('event_id', 'is', null),
      ]);
      const failed = [events, tasks, speaking, trainings, incomes, links, paymentAllocations, allEvents, trainingOptions, speakingOptions].find((result) => result.error);
      if (failed) throw failed.error;
      const targets = new Map((allEvents.data || []).map((event) => [event.id, { id: event.id, label: `${event.title} · Event` }]));
      (trainingOptions.data || []).forEach((training) => targets.set(training.event_id, { id: training.event_id, label: `${training.title} · Training` }));
      (speakingOptions.data || []).forEach((speaking) => targets.set(speaking.event_id, { id: speaking.event_id, label: `${speaking.event_name} · Speaking engagement` }));
      const summary = canonicalIncomeSummary({ incomes: incomes.data || [], links: links.data || [], paymentAllocations: paymentAllocations.data || [] });
      setData({ events: events.data || [], tasks: tasks.data || [], eventOptions: [...targets.values()].sort((a, b) => a.label.localeCompare(b.label)), speaking: speaking.count || 0, trainings: trainings.count || 0, revenue: { booked: summary.confirmed, earned: summary.invoiced, accountsReceivable: summary.receivable, collected: summary.received } });
    } catch (err) { setError(err); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const openCalendarResource = async (event) => {
    if (!['speaking', 'training'].includes(event.event_type)) return navigate(`/admin/events/${event.id}`);
    try { const engagement = await engagementForEvent(event.id, event.event_type); if (engagement) return navigate(`/admin/${event.event_type === 'speaking' ? 'speaking' : 'trainings'}/${engagement.id}`); } catch { /* Fall through to Event workspace. */ }
    navigate(`/admin/events/${event.id}`);
  };
  const toggleTask = async (task) => { try { const { error: updateError } = await supabase.from('tasks').update({ status: task.status === 'done' ? 'todo' : 'done' }).eq('id', task.id); if (updateError) throw updateError; await reload(); } catch (err) { alert(`Could not update task: ${err.message}`); } };
  const closeQuickAction = async () => { setQuickAction(null); await reload(); };
  if (error) return <div className="view active"><div className="view-header"><h1 className="view-title">Dashboard</h1></div><section className="empty-hint" role="alert">Couldn’t load the dashboard. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section></div>;
  if (!data) return <LoadingIndicator label="Loading dashboard…" />;
  const { revenue } = data;
  const today = todayIsoDate();
  return <div className="view active">{quickAction === 'task' && <QuickTaskModal eventOptions={data.eventOptions} onClose={() => setQuickAction(null)} onSaved={closeQuickAction} />}{quickAction === 'expense' && <QuickExpenseModal eventOptions={data.eventOptions} onClose={() => setQuickAction(null)} onSaved={closeQuickAction} />}{quickAction === 'mileage' && <QuickMileageModal eventOptions={data.eventOptions} onClose={() => setQuickAction(null)} onSaved={closeQuickAction} />}<div className="view-header"><h1 className="view-title">Dashboard</h1></div><section className="dashboard-quick-actions"><div className="detail-section-title">Quick Actions</div><div><button className="btn btn-primary" onClick={() => setQuickAction('task')}>+ Add Task</button><button className="btn btn-primary" onClick={() => setQuickAction('expense')}>+ Add Expense</button><button className="btn btn-primary" onClick={() => setQuickAction('mileage')}>+ Add Mileage</button></div></section><div className="stats-grid dashboard-operations-grid"><div className="stat-card accent"><div className="stat-value">{data.events.length}</div><div className="stat-label">Upcoming Events</div></div><div className="stat-card"><div className="stat-value">{data.tasks.length}</div><div className="stat-label">Open Tasks</div></div><div className="stat-card"><div className="stat-value">{data.speaking}</div><div className="stat-label">Active Speaking</div></div><div className="stat-card"><div className="stat-value">{data.trainings}</div><div className="stat-label">Active Trainings</div></div></div><div className="detail-section-title">Revenue Snapshot</div><div className="stats-grid"><RevenueCard value={revenue.booked} label="Booked Revenue" sub="all sources" /><RevenueCard value={revenue.earned} label="Earned Revenue" sub="completed / invoiced" /><RevenueCard value={revenue.accountsReceivable} label="Accounts Receivable" sub="open invoices" danger={Boolean(revenue.accountsReceivable)} /><RevenueCard value={revenue.collected} label="Collected Revenue" sub="received" accent /></div><div className="dashboard-split-row"><section><div className="dashboard-section-header"><div className="detail-section-title">Upcoming Events</div><Link className="dashboard-section-link" to="/admin/calendar">View calendar →</Link></div>{data.events.length ? data.events.map((event) => <button className="dashboard-event-row" type="button" key={event.id} onClick={() => openCalendarResource(event)}><span className="dashboard-event-main"><span className="dashboard-event-title">{event.title}</span><span className="dashboard-event-meta">{eventWhen(event)}{event.location ? ` · ${event.location}` : ''}</span></span><span className={`calendar-event-chip event-type-${event.event_type || 'other'}`}>{event.event_type || 'other'}</span></button>) : <p className="empty-hint">Nothing on the calendar yet.</p>}</section><section><div className="dashboard-section-header"><div className="detail-section-title">Open Tasks</div><Link className="dashboard-section-link" to="/admin/tasks">View tasks →</Link></div>{data.tasks.length ? data.tasks.map((task) => <div className="dashboard-event-row" key={task.id}><Link className="dashboard-event-main" to="/admin/tasks"><span className="dashboard-event-title">{task.title}</span><span className={`dashboard-event-meta ${task.due_date && task.due_date < today ? 'task-row-overdue' : ''}`}>{task.due_date ? formatDate(task.due_date) : 'No due date'}{task.owner && task.owner !== 'Unassigned' ? ` · ${task.owner}` : ''}</span></Link><input type="checkbox" aria-label={`Mark ${task.title} complete`} checked={task.status === 'done'} onChange={() => toggleTask(task)} /></div>) : <p className="empty-hint">No open tasks.</p>}</section></div></div>;
}
