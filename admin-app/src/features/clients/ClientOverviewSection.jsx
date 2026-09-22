import { useEffect, useState } from 'react';
import PhoneNumbersField from '../../components/PhoneNumbersField.jsx';
import SaveButton from '../../components/SaveButton.jsx';

// Fields here save together when "Save" is clicked. Note: same as the vanilla
// app, any reload triggered elsewhere on this page (portal change,
// roster add, document upload) re-fetches the company and resets these
// fields to the last-saved values, discarding unsaved edits here — the
// vanilla app has this same behavior (its loadClientDetail() rebuilds the
// whole page from scratch on every reload), not something introduced here.
export default function ClientOverviewSection({ company, onSave, onSaved }) {
  const [contactName, setContactName] = useState(company.contact_name || '');
  const [contactEmail, setContactEmail] = useState(company.contact_email || '');
  const [phones, setPhones] = useState(company.phones || []);
  const [billingAddress, setBillingAddress] = useState(company.billing_address || '');

  useEffect(() => {
    setContactName(company.contact_name || '');
    setContactEmail(company.contact_email || '');
    setPhones(company.phones || []);
    setBillingAddress(company.billing_address || '');
  }, [company]);

  async function handleSave() {
    await onSave({
      contactName: contactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      phones,
      billingAddress: billingAddress.trim() || null,
    });
  }

  return (
    <>
      <div className="detail-section-title">Overview</div>
      <div className="fields-grid">
        <div className="field-group half">
          <label className="field-label">Primary Contact</label>
          <input type="text" className="field-input" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <p className="field-hint">Saved to this client's roster and available for portal communication.</p>
        </div>
        <div className="field-group half">
          <label className="field-label">Contact Email</label>
          <input type="email" className="field-input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
        <div className="field-group full">
          <label className="field-label">Phone Numbers</label>
          <PhoneNumbersField value={phones} onChange={setPhones} />
        </div>
        <div className="field-group full">
          <label className="field-label">Billing Address</label>
          <textarea className="field-input" rows={2} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
        </div>
      </div>
      <div className="create-form-actions" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
        <SaveButton onSave={handleSave} onSaved={onSaved} label="Save →" />
      </div>
    </>
  );
}
