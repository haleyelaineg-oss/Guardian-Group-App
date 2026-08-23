import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import SaveButton from '../../components/SaveButton.jsx';

// Deliberately simpler than the full Address Book contact form — a single
// `phone` text field, not the multi-number PhoneNumbersField, matching the
// vanilla addRosterContactModal exactly (a fast path for the common case,
// not an oversight worth "fixing" to match the fuller form).
export default function RosterContactModal({ onSubmit, onSaved, onClose }) {
  const [values, setValues] = useState({ fullName: '', email: '', phone: '', title: '', notes: '' });

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    const fullName = values.fullName.trim();
    if (!fullName) throw new Error('Full name is required.');
    await onSubmit({
      fullName,
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      title: values.title.trim() || null,
      notes: values.notes.trim() || null,
    });
  }

  return (
    <Modal title="Create New Contact" onClose={onClose}>
      <div className="fields-grid">
        <div className="field-group full">
          <label className="field-label">Full Name <span className="required">*</span></label>
          <input type="text" className="field-input" placeholder="Jane Smith" value={values.fullName} onChange={(e) => setField('fullName', e.target.value)} />
        </div>
        <div className="field-group half">
          <label className="field-label">Email</label>
          <input type="email" className="field-input" placeholder="jane@acme.com" value={values.email} onChange={(e) => setField('email', e.target.value)} />
        </div>
        <div className="field-group half">
          <label className="field-label">Phone</label>
          <input type="text" className="field-input" placeholder="(555) 555-5555" value={values.phone} onChange={(e) => setField('phone', e.target.value)} />
        </div>
        <div className="field-group full">
          <label className="field-label">Title</label>
          <input type="text" className="field-input" placeholder="Safety Manager" value={values.title} onChange={(e) => setField('title', e.target.value)} />
        </div>
        <div className="field-group full">
          <label className="field-label">Notes</label>
          <textarea className="field-input" rows={2} value={values.notes} onChange={(e) => setField('notes', e.target.value)} />
        </div>
      </div>
      <div className="create-form-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <SaveButton onSave={handleSave} onSaved={onSaved} label="Add Contact →" />
      </div>
    </Modal>
  );
}
