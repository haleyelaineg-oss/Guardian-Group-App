import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import { useTasks } from './useTasks.js';
import TaskForm from './TaskForm.jsx';
import TaskList from './TaskList.jsx';

// Composition root for the Tasks feature — 1:1 with #view-tasks in
// admin/index.html + the loadTaskList/showCreateTask/editTask/saveTask/
// toggleTaskStatus/deleteTask functions in js/admin-calendar.js, split into
// useTasks (data) + TaskForm/TaskList/TaskRow (presentation).
export default function TasksPage() {
  const {
    tasks, eventOptions, eventTitleById, loading, error, reload,
    createTask, updateTask, toggleTaskStatus, deleteTask, fetchTaskById,
  } = useTasks();
  const location = useLocation();
  const navigate = useNavigate();

  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editingTask, setEditingTask] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  function openCreateForm() {
    setEditingTask(null);
    setFormMode('create');
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get('edit');
    if (params.get('new') === '1') {
      openCreateForm();
      navigate('/admin/tasks', { replace: true });
    } else if (editId) {
      openEditForm(editId);
      navigate('/admin/tasks', { replace: true });
    }
  }, [location.search, navigate]);

  async function openEditForm(taskId) {
    try {
      const fullTask = await fetchTaskById(taskId);
      setEditingTask(fullTask);
      setFormMode('edit');
    } catch (err) {
      alert('Could not load task.');
    }
  }

  function closeForm() {
    setFormMode(null);
    setEditingTask(null);
  }

  // No try/catch here — SaveButton (inside TaskForm) owns error display now;
  // this just needs to throw on failure, which updateTask/createTask
  // already do. closeForm() runs from TaskForm's onSaved, i.e. after the
  // "✓ Saved" confirmation has actually been visible, not immediately.
  async function handleSubmit(payload) {
    if (formMode === 'edit') {
      await updateTask(editingTask.id, payload);
    } else {
      await createTask(payload);
    }
  }

  async function handleToggleStatus(task) {
    try {
      await toggleTaskStatus(task);
    } catch (err) {
      alert('Could not update task: ' + err.message);
    }
  }

  async function handleDelete(taskId) {
    if (!confirm('Delete this task?')) return;
    try {
      await deleteTask(taskId);
      if (formMode === 'edit' && editingTask?.id === taskId) closeForm();
    } catch (err) {
      alert('Could not delete: ' + err.message);
    }
  }

  const visibleTasks = tasks.filter((t) => showCompleted || t.status !== 'done');

  return (
    <div className="view active">
      <div className="view-header">
        <h1 className="view-title">Tasks</h1>
        <button className="btn btn-primary" onClick={openCreateForm}>+ New Task</button>
      </div>
      <p className="view-sub">Every task on the calendar, with due dates and owners.</p>

      {formMode && (
        <TaskForm
          key={formMode === 'edit' ? editingTask?.id : 'create'}
          mode={formMode}
          initialTask={editingTask}
          eventOptions={eventOptions}
          onSubmit={handleSubmit}
          onSaved={closeForm}
          onCancel={closeForm}
          onDelete={() => handleDelete(editingTask.id)}
        />
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gg-muted)', marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={(e) => setShowCompleted(e.target.checked)}
        /> Show completed
      </label>

      {loading ? <LoadingIndicator label="Loading tasks…" /> : error ? <section className="empty-hint" role="alert">Couldn’t load tasks. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : (
        <TaskList
          tasks={visibleTasks}
          eventTitleById={eventTitleById}
          onToggleStatus={handleToggleStatus}
          onEdit={openEditForm}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
