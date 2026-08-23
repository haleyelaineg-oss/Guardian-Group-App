import PhoneNumbersField from '../../components/PhoneNumbersField.jsx';

// One row of the New Client form's contact list. `companyId` lets this
// particular contact be filed under a different, already-existing company
// instead of the one being created — same "— This Client —" escape hatch
// the vanilla newCompanyContactRowTpl() offered.
export default function NewClientContactRow({ contact, companyOptions, onChange, onRemove, canRemove }) {
  function setField(field, value) {
    onChange({ ...contact, [field]: value });
  }

  return (
    <div className="contact-row">
      {canRemove && (
        <button type="button" className="contact-row-remove" title="Remove contact" onClick={onRemove}>&times;</button>
      )}
      <div className="fields-grid">
        <div className="field-group half">
          <label className="field-label">Full Name</label>
          <input type="text" className="field-input" placeholder="Jane Smith" value={contact.name} onChange={(e) => setField('name', e.target.value)} />
        </div>
        <div className="field-group half">
          <label className="field-label">Company</label>
          <select className="field-input" value={contact.companyId} onChange={(e) => setField('companyId', e.target.value)}>
            <option value="">— This Client —</option>
            {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field-group half">
          <label className="field-label">Email</label>
          <input type="email" className="field-input" placeholder="jane@acme.com" value={contact.email} onChange={(e) => setField('email', e.target.value)} />
        </div>
        <div className="field-group half">
          <label className="field-label">Title</label>
          <input type="text" className="field-input" placeholder="Safety Manager" value={contact.title} onChange={(e) => setField('title', e.target.value)} />
        </div>
        <div className="field-group full">
          <label className="field-label">Phone Numbers</label>
          <PhoneNumbersField value={contact.phones} onChange={(phones) => setField('phones', phones)} />
        </div>
        <div className="field-group full">
          <label className="field-label">Notes</label>
          <textarea className="field-input" rows={2} value={contact.notes} onChange={(e) => setField('notes', e.target.value)} />
        </div>
      </div>
    </div>
  );
}
