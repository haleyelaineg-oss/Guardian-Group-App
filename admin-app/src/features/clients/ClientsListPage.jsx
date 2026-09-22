import { useState } from 'react';
import { useClientsList } from './useClientsList.js';
import * as clientsService from './clientsService.js';
import ClientForm from './ClientForm.jsx';
import ClientsTable from './ClientsTable.jsx';

export default function ClientsListPage() {
  const { companies, participantsByCompany, portalAccountByCompany, loading, error, reload, deleteClient } = useClientsList();
  const [showForm, setShowForm] = useState(false);

  // No try/catch — SaveButton (inside ClientForm) owns error display now.
  // The warnings from a partial contact failure still surface
  // here since createCompany() itself resolves (doesn't throw) for those;
  // closing the form happens from ClientForm's onSaved, after the
  // "✓ Saved" confirmation has actually been visible.
  async function handleCreate(values) {
    const { warnings } = await clientsService.createCompany(values);
    warnings.forEach((w) => alert(w));
    await reload();
  }

  async function handleDelete(companyId, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone — their portal access and roster assignment will go with it.`)) return;
    try {
      await deleteClient(companyId);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="view active">
      <div className="view-header">
        <h1 className="view-title">Clients</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Client</button>
      </div>
      <p className="view-sub">Click a client to manage their portal login, company roster, training records, and invoices.</p>

      {showForm && <ClientForm onSubmit={handleCreate} onSaved={() => setShowForm(false)} onCancel={() => setShowForm(false)} />}

      {error && <p className="empty-hint">Error: {error.message}</p>}
      {!loading && !error && (
        <ClientsTable
          companies={companies}
          participantsByCompany={participantsByCompany}
          portalAccountByCompany={portalAccountByCompany}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
