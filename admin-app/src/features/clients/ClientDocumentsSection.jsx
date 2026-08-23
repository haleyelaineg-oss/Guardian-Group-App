import { useRef, useState } from 'react';
import { formatFileSize } from '../../utils/format.js';
import * as clientsService from './clientsService.js';
import SaveButton from '../../components/SaveButton.jsx';

export default function ClientDocumentsSection({ clientDocuments, invoices, onUpload, onDelete }) {
  const fileInputRef = useRef(null);
  const [linkedDocId, setLinkedDocId] = useState('');

  const invoiceById = Object.fromEntries(invoices.map((d) => [d.id, d]));

  async function handleView(path) {
    try {
      const url = await clientsService.getClientDocumentSignedUrl(path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id, path) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await onDelete(id, path);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) throw new Error('Choose a file first.');
    await onUpload(file, linkedDocId || null);
  }

  // Runs after the "✓ Saved" confirmation, once the upload has actually
  // completed — clears the picked file and reset the link-to select.
  function resetUploadFields() {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLinkedDocId('');
  }

  return (
    <>
      <div className="detail-section-title">Documents</div>
      <p className="view-sub" style={{ marginTop: -8 }}>Signed operating agreements and other files for this client.</p>
      <div className="responses-table-wrap">
        <table className="responses-table">
          <thead><tr><th>File</th><th>Size</th><th>Uploaded</th><th>Linked To</th><th></th></tr></thead>
          <tbody>
            {clientDocuments.length === 0 && <tr><td colSpan={5}>No documents uploaded yet.</td></tr>}
            {clientDocuments.map((doc) => {
              const linked = doc.document_id ? invoiceById[doc.document_id] : null;
              return (
                <tr key={doc.id}>
                  <td>{doc.file_name}</td>
                  <td>{formatFileSize(doc.file_size)}</td>
                  <td>{(doc.created_at || '').slice(0, 10)}</td>
                  <td>{linked ? linked.doc_number : '—'}</td>
                  <td>
                    <button type="button" className="btn-sm btn-sm-ghost" onClick={() => handleView(doc.storage_path)}>View</button>
                    <button type="button" className="btn-sm btn-sm-danger" title="Delete" onClick={() => handleDelete(doc.id, doc.storage_path)}>🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <input type="file" ref={fileInputRef} className="field-input" style={{ maxWidth: 280 }} />
        <select className="field-input" style={{ maxWidth: 240 }} value={linkedDocId} onChange={(e) => setLinkedDocId(e.target.value)}>
          <option value="">— Not linked to a specific quote/invoice —</option>
          {invoices.map((d) => <option key={d.id} value={d.id}>{d.doc_number} ({d.doc_type})</option>)}
        </select>
        <SaveButton onSave={handleUpload} onSaved={resetUploadFields} label="+ Upload Document" className="btn-sm btn-sm-ghost" />
      </div>
    </>
  );
}
