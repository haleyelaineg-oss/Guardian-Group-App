import PhoneNumbersField from '../../components/PhoneNumbersField.jsx';

// One row of the New Client form's contact list. Every contact created
// here belongs to the client being created — no "assign to a different
// existing company" escape hatch (the vanilla form had one; Haley asked
// for it to be removed since reassigning a contact to a different company
// belongs in Address Book's edit-contact flow instead).
export default function NewClientContactRow({ contact, onChange, onRemove, canRemove }) {
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
