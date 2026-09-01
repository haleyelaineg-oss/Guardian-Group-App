import { useEffect, useState } from 'react';
import SaveButton from '../../components/SaveButton.jsx';
import { createSpeakingSession, deleteSpeakingSession, fetchSpeakingSessions, updateSpeakingSession } from './speakingService.js';

const BLANK = { title: '', session_type: '', starts_at: '', ends_at: '', speakers: '', description: '', learning_objectives: '', av_requirements: '' };

function formValues(row) {
  return {
    title: row.title || '',
    session_type: row.session_type || '',
    starts_at: row.starts_at ? row.starts_at.slice(0, 16) : '',
    ends_at: row.ends_at ? row.ends_at.slice(0, 16) : '',
    speakers: Array.isArray(row.speakers) ? row.speakers.map((speaker) => typeof speaker === 'string' ? speaker : speaker.name).filter(Boolean).join(', ') : '',
    description: row.description || '',
    learning_objectives: row.learning_objectives || '',
    av_requirements: row.av_requirements || '',
  };
}

export default function SpeakingSessions({ eventId }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(BLANK);
  const reload = () => eventId ? fetchSpeakingSessions(eventId).then(setRows).catch((err) => alert(err.message)) : Promise.resolve();

  useEffect(() => { reload(); }, [eventId]);

  if (!eventId) return <p className="empty-hint">Sessions are available once this engagement is on the Calendar.</p>;

  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const closeEditor = () => { setEditing(null); setValues(BLANK); };
  const openEditor = (row = null) => { setEditing(row?.id || 'new'); setValues(row ? formValues(row) : BLANK); };

  async function save() {
    if (!values.title.trim()) throw new Error('Session title is required.');
    const payload = {
      ...values,
      title: values.title.trim(),
      session_type: values.session_type.trim() || null,
      starts_at: values.starts_at || null,
      ends_at: values.ends_at || null,
      speakers: values.speakers.split(',').map((speaker) => speaker.trim()).filter(Boolean),
      description: values.description.trim() || null,
      learning_objectives: values.learning_objectives.trim() || null,
      av_requirements: values.av_requirements.trim() || null,
    };
    if (editing === 'new') await createSpeakingSession(eventId, payload);
    else await updateSpeakingSession(editing, payload);
    await reload();
    closeEditor();
  }

  return <section><div className="detail-section-title">Sessions</div><button className="btn-sm btn-sm-ghost" onClick={() => openEditor()}>+ Add Session</button>{editing && <div className="create-form-card"><h3 className="card-title">{editing === 'new' ? 'Add Session' : 'Edit Session'}</h3><div className="fields-grid"><label className="field-group full"><span className="field-label">Session title</span><input className="field-input" value={values.title} onChange={(e) => set('title', e.target.value)} /></label><label className="field-group third"><span className="field-label">Session type</span><input className="field-input" placeholder="e.g. Keynote, Breakout" value={values.session_type} onChange={(e) => set('session_type', e.target.value)} /></label><label className="field-group third"><span className="field-label">Starts</span><input className="field-input" type="datetime-local" value={values.starts_at} onChange={(e) => set('starts_at', e.target.value)} /></label><label className="field-group third"><span className="field-label">Ends</span><input className="field-input" type="datetime-local" value={values.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></label><label className="field-group full"><span className="field-label">Speaker(s) for this session</span><input className="field-input" placeholder="Comma-separated" value={values.speakers} onChange={(e) => set('speakers', e.target.value)} /></label><label className="field-group full"><span className="field-label">Description</span><textarea className="field-input" value={values.description} onChange={(e) => set('description', e.target.value)} /></label><label className="field-group full"><span className="field-label">Learning objectives</span><textarea className="field-input" value={values.learning_objectives} onChange={(e) => set('learning_objectives', e.target.value)} /></label><label className="field-group full"><span className="field-label">AV requirements</span><textarea className="field-input" value={values.av_requirements} onChange={(e) => set('av_requirements', e.target.value)} /></label></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={closeEditor}>Cancel</button><SaveButton onSave={save} label={editing === 'new' ? 'Add Session →' : 'Save Session →'} /></div></div>}{rows.length ? rows.map((row) => <div className="workshop-card" key={row.id}><div className="wc-title">{row.title}</div><div className="wc-meta">{row.session_type || 'Session'}{row.starts_at && ` · ${new Date(row.starts_at).toLocaleString()}`}{row.ends_at && ` – ${new Date(row.ends_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}</div>{Array.isArray(row.speakers) && row.speakers.length > 0 && <p><strong>Speaker(s):</strong> {row.speakers.map((speaker) => typeof speaker === 'string' ? speaker : speaker.name).filter(Boolean).join(', ')}</p>}{row.description && <p>{row.description}</p>}{row.learning_objectives && <p><strong>Learning objectives:</strong> {row.learning_objectives}</p>}{row.av_requirements && <p><strong>AV requirements:</strong> {row.av_requirements}</p>}<div className="create-form-actions"><button className="btn-sm btn-sm-ghost" onClick={() => openEditor(row)}>Edit</button><button className="btn-sm btn-sm-danger" onClick={async () => { if (!confirm('Delete this session?')) return; try { await deleteSpeakingSession(row.id); await reload(); } catch (err) { alert(err.message); } }}>🗑️</button></div></div>) : <p className="empty-hint">No sessions added yet.</p>}</section>;
}
