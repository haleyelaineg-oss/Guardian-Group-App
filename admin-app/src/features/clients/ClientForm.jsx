import { useState } from 'react';
import NewClientContactRow from './NewClientContactRow.jsx';
import SaveButton from '../../components/SaveButton.jsx';

const BLANK_CONTACT = () => ({ key: crypto.randomUUID(), name: '', email: '', phones: [], title: '', notes: '' });

// 1:1 with #createCompanyCard + createCompany() in admin.js, minus the
// per-contact "assign to a different company" select the vanilla form had
// — every contact created here belongs to the client being created.
export default function ClientForm({ onSubmit, onSaved, onCancel }) {
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState([BLANK_CONTACT()]);
  const [billingAddress, setBillingAddress] = useState('');

  function updateContact(index, updated) {
    setContacts((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }
  function addContact() {
    setContacts((prev) => [...prev, BLANK_CONTACT()]);
  }
  function removeContact(index) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Client name is required.');

    const rawContacts = contacts
      .map((c) => ({
        name: c.name.trim(),
        email: c.email.trim() || null,
        phones: (c.phones || []).filter((p) => p.number && p.number.trim()),
        title: c.title.trim() || null,
        notes: c.notes.trim() || null,
      }))
      .filter((c) => c.name || c.email || c.phones.length || c.title || c.notes);

    for (const c of rawContacts) {
      if (!c.name && (c.email || c.phones.length || c.title || c.notes)) {
        throw new Error('Each contact needs a full name.');
      }
    }

    await onSubmit({
      name: trimmedName,
      contacts: rawContacts.filter((c) => c.name),
      billingAddress: billingAddress.trim() || null,
    });
  }

  return (
    <div className="create-form-card" id="createCompanyCard">
      <h3 className="card-title">Create New Client</h3>
      <div className="fields-grid">
        <div className="field-group full">
          <label className="field-label">Client Name <span className="required">*</span></label>
          <input type="text" className="field-input" placeholder="e.g. Acme Industrial" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field-group full">
          <label className="field-label">Contacts</label>
          <div>
            {contacts.map((c, i) => (
              <NewClientContactRow
                key={c.key}
                contact={c}
                onChange={(updated) => updateContact(i, updated)}
                onRemove={() => removeContact(i)}
                canRemove={contacts.length > 1}
              />
            ))}
          </div>
          <button type="button" className="btn-add-dashed" onClick={addContact}>+ Add another contact</button>
        </div>
        <div className="field-group full">
          <label className="field-label">Billing Address</label>
          <textarea className="field-input" rows={2} placeholder={'123 Main St, Suite 100\nChicago, IL 60601'} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
        </div>
      </div>
      <div className="create-form-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <SaveButton onSave={handleSave} onSaved={onSaved} label="Create Client →" />
      </div>
    </div>
  );
}
