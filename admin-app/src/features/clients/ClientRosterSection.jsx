import { useState } from 'react';
import { Link } from 'react-router-dom';
import RosterContactModal from './RosterContactModal.jsx';

export default function ClientRosterSection({ companyId, company, roster, onCreateContact }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="dashboard-section-header" style={{ marginTop: 24 }}>
        <div className="detail-section-title" style={{ margin: 0 }}>Company Roster</div>
        <button className="btn-sm btn-sm-ghost" onClick={() => setShowModal(true)}>+ Create New Contact</button>
      </div>
      <p className="view-sub" style={{ marginTop: -8 }}>
        Everyone registered with this client's code.{' '}
        <Link to={`/admin/address-book?company=${companyId}`}>Manage contacts in Address Book →</Link>
      </p>
      <div className="responses-table-wrap">
        <table className="responses-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Title</th><th>Portal</th></tr></thead>
          <tbody>
            {roster.length === 0 && <tr><td colSpan={5}>No one registered yet.</td></tr>}
            {roster.map((m) => {
              const isOrgAdmin = company.org_admin_participant_id === m.id;
              const isPrimaryContact = company.primary_contact_participant_id === m.id;
              const hasPortalAccess = m.is_active && m.auth_user_id;
              return (
                <tr key={m.id}>
                  <td>
                    {m.full_name || '—'}
                    {isPrimaryContact && <span className="wc-badge">Primary Contact</span>}
                    {isOrgAdmin && <span className="wc-badge">Org Admin</span>}
                  </td>
                  <td>{m.email || '—'}</td>
                  <td>{m.phone || '—'}</td>
                  <td>{m.title || '—'}</td>
                  <td>
                    {hasPortalAccess
                      ? <span className="reg-card-status-badge attended">Active</span>
                      : <span className="reg-card-status-badge no_show">Not signed up</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <RosterContactModal
          onSubmit={onCreateContact}
          onSaved={() => setShowModal(false)}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
