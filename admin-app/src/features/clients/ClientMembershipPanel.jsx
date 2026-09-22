import { useEffect, useState } from 'react';

export default function ClientMembershipPanel({ company, portalAccount, onProvision, onDisable }) {
  const [email, setEmail] = useState(portalAccount?.email || company.contact_email || '');
  const [setupLink, setSetupLink] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setEmail(portalAccount?.email || company.contact_email || '');
  }, [portalAccount, company.contact_email]);

  async function handleProvision() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter the email this client will use to sign in.');
      return;
    }

    setWorking(true);
    setError('');
    setMessage('');
    setSetupLink('');
    try {
      const result = await onProvision(normalizedEmail);
      setSetupLink(result.setupLink || '');
      setMessage(result.message || 'Portal access is ready.');
    } catch (err) {
      setError(err.message || 'Could not create portal access.');
    } finally {
      setWorking(false);
    }
  }

  async function handleDisable() {
    if (!confirm(`Disable portal access for ${company.name}? Their existing login will stop seeing this company's records.`)) return;
    setWorking(true);
    setError('');
    setMessage('');
    setSetupLink('');
    try {
      const result = await onDisable();
      setMessage(result.message || 'Portal access disabled.');
    } catch (err) {
      setError(err.message || 'Could not disable portal access.');
    } finally {
      setWorking(false);
    }
  }

  async function copySetupLink() {
    await navigator.clipboard.writeText(setupLink);
    setMessage('Setup link copied. Send it securely to the client.');
  }

  const isActive = Boolean(portalAccount?.auth_user_id);

  return (
    <>
      <div className="detail-section-title">Client Portal Access</div>
      <div className="builder-card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <span className={`reg-card-status-badge ${isActive ? 'attended' : 'no_show'}`}>
            {isActive ? 'Active' : 'Not configured'}
          </span>
          <span className="view-sub" style={{ margin: 0 }}>
            One organization login with access to all company training records.
          </span>
        </div>

        <div className="fields-grid">
          <div className="field-group full">
            <label className="field-label" htmlFor="clientPortalEmail">Portal Login Email</label>
            <input
              id="clientPortalEmail"
              type="email"
              className="field-input"
              placeholder="training@clientcompany.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <p className="field-hint">Changing this email creates access for the new address and removes this company from the previous login.</p>
          </div>
        </div>

        <div className="create-form-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-primary" disabled={working} onClick={handleProvision}>
            {working ? 'Working…' : (isActive ? 'Create New Setup Link' : 'Create Portal Login')}
          </button>
          {isActive && (
            <button className="btn-sm btn-sm-danger" disabled={working} onClick={handleDisable}>Disable Access</button>
          )}
        </div>

        {setupLink && (
          <div className="field-group full" style={{ marginTop: 16 }}>
            <label className="field-label" htmlFor="clientPortalSetupLink">Secure Setup Link</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="clientPortalSetupLink" className="field-input" readOnly value={setupLink} />
              <button className="btn-sm btn-sm-ghost" onClick={copySetupLink}>Copy</button>
            </div>
            <p className="field-hint">Send this link directly to the client so they can choose their password.</p>
          </div>
        )}
        {message && <p className="login-success" style={{ marginTop: 14 }}>{message}</p>}
        {error && <p className="login-error" style={{ display: 'block', marginTop: 14 }}>{error}</p>}
      </div>
    </>
  );
}
