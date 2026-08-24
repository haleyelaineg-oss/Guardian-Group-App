import { useRef, useState } from 'react';
import SaveButton from '../../components/SaveButton.jsx';
import { formatFileSize } from '../../utils/format.js';
import { deleteDocument, fetchDocuments, getDocumentUrl, uploadDocument } from '../events/eventResourcesService.js';
import { useEventResource } from '../events/useEventResource.js';

// Event, Speaking, and Training all store attachments in event_documents.
// Link options are supplied by the composition root so this manager never
// needs to know which screen it is rendered inside.
export default function DocumentManager({ eventId, itineraryItems = [], expenses = [] }) {
  const { rows: documents, loading, error, reload } = useEventResource(eventId, fetchDocuments);
  const inputRef = useRef(null); const [notes, setNotes] = useState(''); const [link, setLink] = useState('');
  if (!eventId) return <p className="empty-hint">Documents are available once this record is linked to an event.</p>;
  async function save() { const file = inputRef.current?.files?.[0]; if (!file) throw new Error('Choose a file first.'); const [kind, id] = link.split(':'); await uploadDocument(eventId, file, { notes: notes.trim() || null, itinerary_item_id: kind === 'i' ? id : null, expense_id: kind === 'e' ? id : null }); }
  async function saved() { await reload(); inputRef.current.value = ''; setNotes(''); setLink(''); }
  async function view(path) { try { window.open(await getDocumentUrl(path), '_blank', 'noopener'); } catch (err) { alert(err.message); } }
  async function remove(doc) { if (!confirm(`Delete ${doc.file_name}? This cannot be undone.`)) return; try { await deleteDocument(doc.id, doc.storage_path); await reload(); } catch (err) { alert(err.message); } }
  const itemById = Object.fromEntries(itineraryItems.map((item) => [item.id, item.title])); const expenseById = Object.fromEntries(expenses.map((item) => [item.id, item.description]));
  return <section><div className="detail-section-title">Documents</div><div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>File</th><th>Size</th><th>Uploaded</th><th>Linked To</th><th>Notes</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan="6">Loading...</td></tr> : error ? <tr><td colSpan="6">Error: {error.message}</td></tr> : documents.length === 0 ? <tr><td colSpan="6">No documents uploaded yet.</td></tr> : documents.map((doc) => <tr key={doc.id}><td>{doc.file_name}</td><td>{formatFileSize(doc.file_size)}</td><td>{(doc.created_at || '').slice(0, 10)}</td><td>{doc.itinerary_item_id ? `🧭 ${itemById[doc.itinerary_item_id] || 'Itinerary item'}` : doc.expense_id ? `💵 ${expenseById[doc.expense_id] || 'Expense'}` : 'General'}</td><td>{doc.notes || '—'}</td><td><button className="btn-sm btn-sm-ghost" onClick={() => view(doc.storage_path)}>View</button><button className="btn-sm btn-sm-danger" onClick={() => remove(doc)}>🗑️</button></td></tr>)}</tbody></table></div><div className="create-form-card"><div className="fields-grid"><label className="field-group half"><span className="field-label">File</span><input ref={inputRef} type="file" className="field-input" /></label><label className="field-group half"><span className="field-label">Link to</span><select className="field-input" value={link} onChange={(e) => setLink(e.target.value)}><option value="">— General document —</option>{itineraryItems.map((item) => <option key={item.id} value={`i:${item.id}`}>🧭 {item.title}</option>)}{expenses.map((item) => <option key={item.id} value={`e:${item.id}`}>💵 {item.description}</option>)}</select></label><label className="field-group full"><span className="field-label">Notes</span><input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label></div><div className="create-form-actions"><SaveButton onSave={save} onSaved={saved} label="Upload Document →" /></div></div></section>;
}
