import { useEffect, useRef, useState } from 'react';

const BLANK = { title: '', due_date: '', owner: 'Unassigned', event_id: '', link_url: '', notes: '' };

// Single create/edit form, same as the vanilla app's one shared
// #createTaskCard reused for both — 1:1 with showCreateTask()/
// populateEditTaskForm()/saveTask() in js/admin-calendar.js. Mount a fresh
// instance (via a `key` prop on the caller side) whenever switching between
// "create" and a specific task to edit, so field state always resets the
// same way the vanilla form's repopulation did.
export default function TaskForm({ mode, initialTask, eventOptions, onSubmit, onCancel, onDelete }) {
  const [values, setValues] = useState(() =>
    mode === 'edit' && initialTask
      ? {
          title: initialTask.title || '',
          due_date: initialTask.due_date || '',
          owner: initialTask.owner || 'Unassigned',
          event_id: initialTask.event_id || '',
          link_url: initialTask.link_url || '',
          notes: initialTask.notes || '',
        }
      : BLANK
  );
  const cardRef = useRef(null);

  useEffect(() => {
    if (mode === 'edit' && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [mode]);

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    const title = values.title.trim();
    if (!title) { alert('Task title is required.'); return; }

    onSubmit({
      title,
      due_date: values.due_date || null,
      owner: values.owner,
      event_id: values.event_id || null,
      link_url: values.link_url.trim() || null,
      notes: values.notes.trim() || null,
    });
  }

  return (
    <div className="create-form-card" id="createTaskCard" ref={cardRef}>
      <h3 className="card-title">{mode === 'edit' ? 'Edit Task' : 'Create New Task'}</h3>
      <div className="fields-grid">
        <div className="field-group full">
          <label className="field-label" htmlFor="newTaskTitle">Task Title <span className="required">*</span></label>
          <input
            type="text" id="newTaskTitle" className="field-input"
            placeholder="e.g. Book flight for WMC trip"
            value={values.title} onChange={(e) => setField('title', e.target.value)}
          />
        </div>
        <div className="field-group half">
          <label className="field-label" htmlFor="newTaskDueDate">Due Date</label>
          <input
            type="date" id="newTaskDueDate" className="field-input"
            value={values.due_date} onChange={(e) => setField('due_date', e.target.value)}
          />
        </div>
        <div className="field-group half">
          <label className="field-label" htmlFor="newTaskOwner">Task Owner</label>
          <select
            id="newTaskOwner" className="field-input"
            value={values.owner} onChange={(e) => setField('owner', e.target.value)}
          >
            <option value="Unassigned">Unassigned</option>
            <option value="Dave">Dave</option>
            <option value="Haley">Haley</option>
          </select>
        </div>
        <div className="field-group half">
          <label className="field-label" htmlFor="newTaskEvent">Linked Event</label>
          <select
            id="newTaskEvent" className="field-input"
            value={values.event_id} onChange={(e) => setField('event_id', e.target.value)}
          >
            <option value="">— None —</option>
            {eventOptions.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>
        <div className="field-group half">
          <label className="field-label" htmlFor="newTaskLink">Link</label>
          <input
            type="url" id="newTaskLink" className="field-input" placeholder="https://…"
            value={values.link_url} onChange={(e) => setField('link_url', e.target.value)}
          />
        </div>
        <div className="field-group full">
          <label className="field-label" htmlFor="newTaskNotes">Notes</label>
          <textarea
            id="newTaskNotes" className="field-input" rows={2}
            value={values.notes} onChange={(e) => setField('notes', e.target.value)}
          />
        </div>
      </div>
      <div className="create-form-actions">
        {mode === 'edit' && (
          <button className="btn-sm btn-sm-danger" onClick={onDelete} title="Delete">🗑️</button>
        )}
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          {mode === 'edit' ? 'Save Changes →' : 'Create Task →'}
        </button>
      </div>
    </div>
  );
}
