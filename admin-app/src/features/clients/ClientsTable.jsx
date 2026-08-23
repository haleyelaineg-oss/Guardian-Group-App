import { useNavigate } from 'react-router-dom';

export default function ClientsTable({ companies, participantsByCompany, membershipByCompany, onDelete }) {
  const navigate = useNavigate();

  if (!companies.length) return <p className="empty-hint">No clients yet.</p>;

  return (
    <div className="responses-table-wrap">
      <table className="responses-table">
        <thead>
          <tr><th>Client</th><th>Code</th><th>Tier</th><th>Seats</th><th></th></tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const members = participantsByCompany[c.id] || [];
            const activeCount = members.filter((m) => m.is_active && m.auth_user_id).length;
            const membership = membershipByCompany[c.id];
            return (
              <tr key={c.id} className="client-list-row" onClick={() => navigate(`/admin/clients/${c.id}`)}>
                <td>{c.name}</td>
                <td>{membership ? <span className="client-code-chip">{membership.client_code}</span> : '—'}</td>
                <td>{membership?.membership_tier || '—'}</td>
                <td>{membership ? (membership.max_seats === null ? 'Unlimited' : `${activeCount} / ${membership.max_seats}`) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn-sm btn-sm-ghost"
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/clients/${c.id}`); }}
                  >Edit</button>
                  <button
                    className="btn-sm btn-sm-danger" title="Delete"
                    onClick={(e) => { e.stopPropagation(); onDelete(c.id, c.name); }}
                  >🗑️</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
