import { useCallback, useEffect, useMemo, useState } from 'react';
import SaveButton from '../../components/SaveButton.jsx';
import { createChecklistItem, deleteChecklistItem, fetchChecklist, generateDefaultChecklist, syncChecklistItemToTask, updateChecklistItem } from './checklistService.js';

export default function Checklist({ kind, engagementId, deliveryMethod }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [owner, setOwner] = useState('Unassigned');
  const reload = useCallback(() => fetchChecklist(kind, engagementId).then(setItems).catch((err) => alert(err.message)), [kind, engagementId]);
  useEffect(() => { reload(); }, [reload]);
  const progress = useMemo(() => items.length ? Math.round(items.filter((item) => item.status === 'completed').length / items.length * 100) : null, [items]);
  const run = async (action) => { try { await action(); await reload(); } catch (err) { alert(err.message); } };
  const addItem = async () => {
    if (!title.trim()) throw new Error('Checklist item title is required.');
    await createChecklistItem(kind, engagementId, { title: title.trim(), due_date: dueDate || null, owner, status: 'pending', is_default: false });
    setTitle(''); setDueDate(''); setOwner('Unassigned');
  };

  return <section className="prep-checklist"><div className="detail-section-title">Prep Checklist · {progress == null ? '—' : `${progress}%`}</div>{!items.length && <button className="btn-sm btn-sm-ghost" onClick={() => run(() => generateDefaultChecklist(kind, engagementId, deliveryMethod))}>Generate Default Checklist</button>}<div className="prep-checklist-add"><input className="field-input" placeholder="Add prep item" value={title} onChange={(e) => setTitle(e.target.value)} /><input className="field-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /><select className="field-input" value={owner} onChange={(e) => setOwner(e.target.value)}><option>Unassigned</option><option>Dave</option><option>Haley</option></select><SaveButton onSave={addItem} onSaved={reload} label="Add Item →" /></div>{items.length ? <div className="prep-checklist-list"><div className="prep-checklist-header" aria-hidden="true"><span>Item</span><span>Due date</span><span>Owner</span><span>Actions</span></div>{items.map((item) => <div className={`task-row prep-checklist-row ${item.status === 'completed' ? 'task-row-done' : ''}`} key={item.id}><label className="prep-checklist-item"><input type="checkbox" aria-label={`Mark ${item.title} complete`} checked={item.status === 'completed'} onChange={() => run(() => updateChecklistItem(item.id, { status: item.status === 'completed' ? 'pending' : 'completed' }))} /><span className="task-row-title">{item.title}</span></label><input className="field-input" type="date" aria-label={`${item.title} due date`} value={item.due_date || ''} onChange={(e) => run(() => updateChecklistItem(item.id, { due_date: e.target.value || null }))} /><select className="field-input" aria-label={`${item.title} owner`} value={item.owner || 'Unassigned'} onChange={(e) => run(() => updateChecklistItem(item.id, { owner: e.target.value }))}><option>Unassigned</option><option>Dave</option><option>Haley</option></select><div className="prep-checklist-actions">{item.task_id ? <span className="task-row-owner">✓ Task</span> : item.due_date && <button className="btn-sm btn-sm-ghost" onClick={() => run(() => syncChecklistItemToTask(kind, engagementId, item))}>→ Task</button>}<button className="btn-sm btn-sm-danger" aria-label={`Delete ${item.title}`} onClick={() => { if (confirm('Delete this checklist item?')) run(() => deleteChecklistItem(item.id)); }}>🗑️</button></div></div>)}</div> : <p className="empty-hint">No prep items yet.</p>}</section>;
}
