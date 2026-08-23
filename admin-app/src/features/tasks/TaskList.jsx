import TaskRow from './TaskRow.jsx';

// 1:1 with renderTaskList() in js/admin-calendar.js — filtering (the "show
// completed" checkbox) stays owned by TasksPage since it's page-level view
// state, not data; this component just renders whatever list it's given.
export default function TaskList({ tasks, eventTitleById, onToggleStatus, onEdit, onDelete }) {
  if (!tasks.length) {
    return <p className="empty-hint">No tasks yet.</p>;
  }

  return (
    <div id="taskListContainer">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          eventTitle={task.event_id ? eventTitleById[task.event_id] : null}
          onToggleStatus={onToggleStatus}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
