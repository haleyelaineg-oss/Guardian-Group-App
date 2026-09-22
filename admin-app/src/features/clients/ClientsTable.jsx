import { useNavigate } from 'react-router-dom';

export default function ClientsTable({ companies, participantsByCompany, portalAccountByCompany, onDelete }) {
  const navigate = useNavigate();

  if (!companies.length) return <p className="empty-hint">No clients yet.</p>;

  return (
    <div className="responses-table-wrap">
      <table className="responses-table">
        <thead>
          <tr><th>Client</th><th>Primary Contact</th><th>Portal Login</th><th>Contacts</th><th></th></tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const members = participantsByCompany[c.id] || [];
            const portalAccount = portalAccountByCompany[c.id];
            return (
              <tr key={c.id} className="client-list-row" onClick={() => navigate(`/admin/clients/${c.id}`)}>
                <td>{c.name}</td>
                <td>{c.contact_name || '—'}<div className="table-secondary">{c.contact_email || ''}</div></td>
                <td>{portalAccount?.auth_user_id
                  ? <><span className="reg-card-status-badge attended">Active</span><div className="table-secondary">{portalAccount.email}</div></>
                  : <span className="reg-card-status-badge no_show">Not configured</span>}</td>
                <td>{members.length}</td>
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
