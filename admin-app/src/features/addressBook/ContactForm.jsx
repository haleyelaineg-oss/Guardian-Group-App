import { useState } from 'react';
import PhoneNumbersField from '../../components/PhoneNumbersField.jsx';
import SaveButton from '../../components/SaveButton.jsx';

// Shared by the inline "Add Contact" card and the "Edit Contact" modal —
// same fields either way (createContactCard vs editContactModal in the
// vanilla app were two separate hand-written forms with identical fields).
// The caller supplies the surrounding chrome (card vs Modal); this just
// owns fields + validation + actions, same split TaskForm established.
export default function ContactForm({ mode, initialContact, companyOptions, onSubmit, onSaved, onCancel, onDelete, canDelete, deleteDisabledReason }) {
  const [values, setValues] = useState(() =>
    mode === 'edit' && initialContact
      ? {
          fullName: initialContact.full_name || '',
          companyId: initialContact.company_id || '',
          email: initialContact.email || '',
          title: initialContact.title || '',
          phones: (initialContact.phones && initialContact.phones.length)
            ? initialContact.phones.map((p) => ({ ...p }))
            : (initialContact.phone ? [{ type: 'Office', number: initialContact.phone }] : []),
          notes: initialContact.notes || '',
        }
      : { fullName: '', companyId: '', email: '', title: '', phones: [], notes: '' }
  );

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    const fullName = values.fullName.trim();
    if (!fullName) throw new Error('Full name is required.');

    const phones = values.phones.filter((p) => p.number && p.number.trim());
    await onSubmit({
      full_name: fullName,
      company_id: values.companyId || null,
      email: values.email.trim() || null,
      phone: phones[0]?.number || null,
      phones,
      title: values.title.trim() || null,
      notes: values.notes.trim() || null,
    });
  }

  return (
    <>
      <div className="fields-grid">
        <div className="field-group half">
          <label className="field-label">Full Name <span className="required">*</span></label>
          <input type="text" className="field-input" placeholder="Jane Smith" value={values.fullName} onChange={(e) => setField('fullName', e.target.value)} />
        </div>
        <div className="field-group half">
          <label className="field-label">Company</label>
          <select className="field-input" value={values.companyId} onChange={(e) => setField('companyId', e.target.value)}>
            <option value="">— None —</option>
            {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field-group half">
          <label className="field-label">Email</label>
          <input type="email" className="field-input" placeholder="jane@acme.com" value={values.email} onChange={(e) => setField('email', e.target.value)} />
        </div>
        <div className="field-group half">
          <label className="field-label">Title</label>
          <input type="text" className="field-input" placeholder="Safety Manager" value={values.title} onChange={(e) => setField('title', e.target.value)} />
        </div>
        <div className="field-group full">
          <label className="field-label">Phone Numbers</label>
          <PhoneNumbersField value={values.phones} onChange={(phones) => setField('phones', phones)} />
        </div>
        <div className="field-group full">
          <label className="field-label">Notes</label>
          <textarea className="field-input" rows={mode === 'edit' ? 3 : 2} value={values.notes} onChange={(e) => setField('notes', e.target.value)} />
        </div>
      </div>
      <div className="create-form-actions">
        {mode === 'edit' && (
          <button
            className="btn-sm btn-sm-danger" title={canDelete ? '' : deleteDisabledReason}
            disabled={!canDelete} style={{ opacity: canDelete ? 1 : 0.5, cursor: canDelete ? 'pointer' : 'not-allowed' }}
            onClick={onDelete}
          >🗑️</button>
        )}
        {mode === 'create' && <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        <SaveButton onSave={handleSave} onSaved={onSaved} label={mode === 'edit' ? 'Save Changes →' : 'Add Contact →'} />
      </div>
    </>
  );
}
