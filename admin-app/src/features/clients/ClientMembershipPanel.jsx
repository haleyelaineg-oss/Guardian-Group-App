import { useEffect, useState } from 'react';
import SaveButton from '../../components/SaveButton.jsx';

const TIERS = ['Blue', 'Silver', 'Gold', 'Platinum'];

// Tier/seats/unlimited are buffered in local state and only sent on
// "Save Membership" — Haley asked for this after finding the vanilla-style
// per-field immediate save (with a full-page reload on every change) too
// disruptive. Copy and Regenerate stay immediate actions, since those
// don't have anything to "buffer" — same as the vanilla app.
export default function ClientMembershipPanel({ membership, activeCount, onCopyCode, onRegenerateCode, onSaveMembership, onSaved, onEnableMembership }) {
  const [tier, setTier] = useState(membership?.membership_tier || '');
  const [maxSeats, setMaxSeats] = useState(membership?.max_seats ?? '');
  const [unlimited, setUnlimited] = useState(membership?.max_seats === null);

  useEffect(() => {
    setTier(membership?.membership_tier || '');
    setMaxSeats(membership?.max_seats ?? '');
    setUnlimited(membership?.max_seats === null);
  }, [membership]);

  async function handleSave() {
    await onSaveMembership({ tier, maxSeats, unlimited });
  }

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
              <select className="field-input" value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">None</option>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field-group half">
              <label className="field-label">Max Seats</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number" className="field-input" min="0" step="1"
                  value={unlimited ? '' : maxSeats}
                  disabled={unlimited}
                  onChange={(e) => setMaxSeats(e.target.value)}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontSize: 13, color: 'var(--gg-muted)' }}>
                  <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
                  Unlimited
                </label>
              </div>
            </div>
          </div>
          <div className="create-form-actions" style={{ justifyContent: 'flex-start' }}>
            <SaveButton onSave={handleSave} onSaved={onSaved} label="Save Membership →" />
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
