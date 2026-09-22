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
        Employees and contacts associated with this client.{' '}
        <Link to={`/admin/address-book?company=${companyId}`}>Manage contacts in Address Book →</Link>
      </p>
      <div className="responses-table-wrap">
        <table className="responses-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Title</th></tr></thead>
          <tbody>
            {roster.length === 0 && <tr><td colSpan={4}>No contacts yet.</td></tr>}
            {roster.map((m) => {
              const isPrimaryContact = company.primary_contact_participant_id === m.id;
              return (
                <tr key={m.id}>
                  <td>
                    {m.full_name || '—'}
                    {isPrimaryContact && <span className="wc-badge">Primary Contact</span>}
                  </td>
                  <td>{m.email || '—'}</td>
                  <td>{m.phone || '—'}</td>
                  <td>{m.title || '—'}</td>
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
