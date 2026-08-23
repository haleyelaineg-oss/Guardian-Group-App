const PHONE_TYPES = ['Office', 'Work Cell', 'Personal Cell'];

// Fully-controlled replacement for the vanilla app's contactPhonesState —
// a plain object keyed by an arbitrary string id (per form instance) that
// every phone-editor call site (New Client rows, Client Detail primary
// contact, Address Book add/edit) read and wrote as a global. Here each
// <PhoneNumbersField> just owns its array via the parent's own state
// (value/onChange), same three phone "type" options, same shape
// ({type, number}) so it round-trips through the `phones` jsonb column
// unchanged.
export default function PhoneNumbersField({ value, onChange }) {
  const phones = value || [];

  function updatePhone(index, field, newValue) {
    const next = phones.map((p, i) => (i === index ? { ...p, [field]: newValue } : p));
    onChange(next);
  }

  function addPhone() {
    onChange([...phones, { type: 'Office', number: '' }]);
  }

  function removePhone(index) {
    onChange(phones.filter((_, i) => i !== index));
  }

  return (
    <div>
      {phones.length === 0 && <p className="empty-hint" style={{ margin: '8px 0' }}>No phone numbers yet.</p>}
      {phones.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <select
            className="field-input" style={{ maxWidth: 140 }}
            value={p.type} onChange={(e) => updatePhone(i, 'type', e.target.value)}
          >
            {PHONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="text" className="field-input" placeholder="(555) 555-5555"
            value={p.number || ''} onChange={(e) => updatePhone(i, 'number', e.target.value)}
          />
          <button type="button" className="btn-sm btn-sm-danger" onClick={() => removePhone(i)}>×</button>
        </div>
      ))}
      <button type="button" className="btn-sm btn-sm-ghost" onClick={addPhone}>+ Add Phone Number</button>
    </div>
  );
}
