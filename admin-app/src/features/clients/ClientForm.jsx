import { useState } from 'react';
import NewClientContactRow from './NewClientContactRow.jsx';

const BLANK_CONTACT = () => ({ key: crypto.randomUUID(), name: '', email: '', phones: [], title: '', notes: '' });

// 1:1 with #createCompanyCard + createCompany() in admin.js, minus the
// per-contact "assign to a different company" select the vanilla form had
// — every contact created here belongs to the client being created.
export default function ClientForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState([BLANK_CONTACT()]);
  const [billingAddress, setBillingAddress] = useState('');
  const [tier, setTier] = useState('');
  const [maxSeats, setMaxSeats] = useState('');
  const [unlimitedSeats, setUnlimitedSeats] = useState(false);

  function updateContact(index, updated) {
    setContacts((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }
  function addContact() {
    setContacts((prev) => [...prev, BLANK_CONTACT()]);
  }
  function removeContact(index) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) { alert('Client name is required.'); return; }

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
        alert('Each contact needs a full name.');
        return;
      }
    }

    onSubmit({
      name: trimmedName,
      contacts: rawContacts.filter((c) => c.name),
      billingAddress: billingAddress.trim() || null,
      tier: tier.trim() || null,
      maxSeats: maxSeats ? parseInt(maxSeats, 10) : null,
      unlimitedSeats,
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
        <div className="field-group half">
          <label className="field-label">Membership Tier</label>
          <select className="field-input" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">— Select —</option>
            <option value="Blue">Blue</option>
            <option value="Silver">Silver</option>
            <option value="Gold">Gold</option>
            <option value="Platinum">Platinum</option>
          </select>
        </div>
        <div className="field-group half">
          <label className="field-label">Max Seats</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number" className="field-input" placeholder="0" min="0" step="1"
              value={maxSeats} disabled={unlimitedSeats}
              onChange={(e) => setMaxSeats(e.target.value)}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: 13, color: 'var(--gg-muted)' }}>
              <input type="checkbox" checked={unlimitedSeats} onChange={(e) => setUnlimitedSeats(e.target.checked)} />
              Unlimited
            </label>
          </div>
        </div>
      </div>
      <div className="create-form-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit}>Create Client →</button>
      </div>
    </div>
  );
}
