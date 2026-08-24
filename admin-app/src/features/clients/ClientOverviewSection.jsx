import { useEffect, useState } from 'react';
import PhoneNumbersField from '../../components/PhoneNumbersField.jsx';
import SaveButton from '../../components/SaveButton.jsx';

// Org Admin saves immediately on change; every other field here only
// saves when "Save" is clicked — same split as the vanilla Overview
// section (setCompanyOrgAdmin() fires straight from the <select>, while
// saveClientOverview() is the explicit button). Note: same as the vanilla
// app, any reload triggered elsewhere on this page (membership change,
// roster add, document upload) re-fetches the company and resets these
// fields to the last-saved values, discarding unsaved edits here — the
// vanilla app has this same behavior (its loadClientDetail() rebuilds the
// whole page from scratch on every reload), not something introduced here.
export default function ClientOverviewSection({ company, roster, onSave, onSaved, onSetOrgAdmin }) {
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
          <p className="field-hint">Saved to this client's roster too, so they can be picked as Org Admin.</p>
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
        <div className="field-group half">
          <label className="field-label" style={{ margin: 0 }}>Org Admin</label>
          <select
            className="attendance-status-select"
            value={company.org_admin_participant_id || ''}
            disabled={roster.length === 0}
            onChange={(e) => onSetOrgAdmin(e.target.value || null)}
          >
            <option value="">— None —</option>
            {roster.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name} ({m.email || 'no email'})</option>
            ))}
          </select>
        </div>
      </div>
      <div className="create-form-actions" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
        <SaveButton onSave={handleSave} onSaved={onSaved} label="Save →" />
      </div>
    </>
  );
}
