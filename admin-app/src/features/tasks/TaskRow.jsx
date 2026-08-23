import { formatDate, todayIsoDate } from '../../utils/format.js';

// One row in the Tasks list — 1:1 with buildTaskRowsHtml() in
// js/admin-calendar.js. (The vanilla app also has a second, differently
// laid-out row renderer for the Dashboard's mini task list —
// buildDashboardTaskRowsHtml. That's Phase 10 work; deliberately not
// building a "compact" variant here until Dashboard actually exists to
// consume it and prove out the right shape.)
export default function TaskRow({ task, eventTitle, onToggleStatus, onEdit, onDelete }) {
  const isDone = task.status === 'done';
  const isOverdue = !isDone && task.due_date && task.due_date < todayIsoDate();

  return (
    <div className={`task-row${isDone ? ' task-row-done' : ''}`}>
      <input type="checkbox" checked={isDone} onChange={() => onToggleStatus(task)} />
      <span className="task-row-title" onClick={() => onEdit(task.id)} style={{ cursor: 'pointer' }}>
        {task.title}
      </span>
      {task.owner && task.owner !== 'Unassigned' && (
        <span className="task-row-owner">{task.owner}</span>
      )}
      {eventTitle && <span className="task-row-event">{eventTitle}</span>}
      {task.link_url && (
        <a
          className="task-row-link"
          href={task.link_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          🔗 Link
        </a>
      )}
      <span className={`task-row-due${isOverdue ? ' task-row-overdue' : ''}`}>
        {task.due_date ? formatDate(task.due_date) : 'No due date'}
      </span>
      <button className="btn-sm btn-sm-danger" onClick={() => onDelete(task.id)} title="Delete">🗑️</button>
    </div>
  );
}
