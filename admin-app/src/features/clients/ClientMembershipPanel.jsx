const TIERS = ['Blue', 'Silver', 'Gold', 'Platinum'];

// Every field here saves immediately on change — no separate Save button,
// same as the vanilla membershipPanel markup in loadClientDetail().
export default function ClientMembershipPanel({ membership, activeCount, onCopyCode, onRegenerateCode, onUpdateField, onSetUnlimited, onEnableMembership }) {
  return (
    <>
      <div className="detail-section-title">Client Code</div>
      {membership ? (
        <div className="builder-card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="client-code-chip">{membership.client_code}</span>
            <button className="btn-sm btn-sm-ghost" onClick={onCopyCode}>Copy</button>
            <button className="btn-sm btn-sm-ghost" onClick={onRegenerateCode}>Regenerate</button>
            <span className="seat-badge">
              {membership.max_seats === null ? 'Unlimited' : `${activeCount} / ${membership.max_seats} active`}
            </span>
          </div>
          <div className="fields-grid" style={{ marginTop: 12 }}>
            <div className="field-group half">
              <label className="field-label">Membership Tier</label>
              <select className="field-input" value={membership.membership_tier || ''} onChange={(e) => onUpdateField('membership_tier', e.target.value)}>
                <option value="">None</option>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field-group half">
              <label className="field-label">Max Seats</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number" className="field-input" min="0" step="1"
                  value={membership.max_seats === null ? '' : membership.max_seats}
                  disabled={membership.max_seats === null}
                  onChange={(e) => onUpdateField('max_seats', e.target.value)}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: 13, color: 'var(--gg-muted)' }}>
                  <input type="checkbox" checked={membership.max_seats === null} onChange={(e) => onSetUnlimited(e.target.checked)} />
                  Unlimited
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="builder-card" style={{ marginTop: 12 }}>
          <button className="btn-sm btn-sm-ghost" onClick={onEnableMembership}>Enable Portal Membership</button>
        </div>
      )}
    </>
  );
}
