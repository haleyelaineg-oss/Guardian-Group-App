import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAddressBook } from './useAddressBook.js';
import ContactForm from './ContactForm.jsx';
import ContactViewModal from './ContactViewModal.jsx';
import Modal from '../../components/Modal.jsx';

export default function AddressBookPage() {
  const [searchParams] = useSearchParams();
  const [companyFilter, setCompanyFilter] = useState(searchParams.get('company') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Client Detail's "Manage contacts in Address Book →" link can be
  // clicked again for a different client while this page is already
  // mounted (same route, new ?company=), which wouldn't otherwise update
  // companyFilter since useState's initializer only runs once. Re-apply
  // the URL param whenever it's present without fighting manual dropdown
  // changes the rest of the time (those never touch searchParams).
  useEffect(() => {
    const paramCompany = searchParams.get('company');
    if (paramCompany) setCompanyFilter(paramCompany);
  }, [searchParams]);

  const { contacts, companyOptions, loading, error, createContact, updateContact, deleteContact } = useAddressBook(companyFilter);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewingContact, setViewingContact] = useState(null);
  const [editingContact, setEditingContact] = useState(null);

  const visibleContacts = useMemo(() => {
    let rows = contacts;
    if (statusFilter === 'active') rows = rows.filter((p) => p.is_active && p.auth_user_id);
    if (statusFilter === 'none') rows = rows.filter((p) => !(p.is_active && p.auth_user_id));
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.title || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [contacts, statusFilter, search]);

  async function handleCreate(payload) {
    try {
      await createContact(payload);
      setShowCreateForm(false);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaveEdit(payload) {
    try {
      await updateContact(editingContact.id, payload);
      setEditingContact(null);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!editingContact) return;
    const name = editingContact.full_name || 'this contact';
    if (!confirm(`Remove ${name} from the address book? This cannot be undone.`)) return;
    try {
      await deleteContact(editingContact.id, name);
      setEditingContact(null);
    } catch (err) {
      alert(err.message);
    }
  }

  const isOrgAdmin = editingContact ? editingContact.companies?.org_admin_participant_id === editingContact.id : false;
  const hasPortalAccess = editingContact ? editingContact.is_active && editingContact.auth_user_id : false;
  const canDelete = !hasPortalAccess && !isOrgAdmin;
  const deleteDisabledReason = isOrgAdmin ? 'Reassign the org admin first' : 'Manage portal access from their Company view in the client portal';

  return (
    <div className="view active">
      <div className="view-header">
        <h1 className="view-title">Address Book</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>+ Add Contact</button>
      </div>
      <p className="view-sub">Everyone on file, across all clients.</p>

      {showCreateForm && (
        <div className="create-form-card">
          <h3 className="card-title">Add Contact</h3>
          <ContactForm mode="create" companyOptions={companyOptions} onSubmit={handleCreate} onCancel={() => setShowCreateForm(false)} />
        </div>
      )}

      <div className="top-bar">
        <div className="top-bar-left" style={{ gap: 12, flexWrap: 'wrap' }}>
          <select className="workshop-select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="">All Companies</option>
            {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="workshop-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Portal Active</option>
            <option value="none">Not Signed Up</option>
          </select>
          <input
            type="text" className="field-input" style={{ maxWidth: 240 }}
            placeholder="Search name, email, phone, title…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="empty-hint">Loading...</p>
      ) : error ? (
        <p className="empty-hint">Error: {error.message}</p>
      ) : visibleContacts.length === 0 ? (
        <p className="empty-hint">No contacts match.</p>
      ) : (
        <div className="responses-table-wrap">
          <table className="responses-table">
            <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Title</th></tr></thead>
            <tbody>
              {visibleContacts.map((p) => {
                const rowIsOrgAdmin = p.companies?.org_admin_participant_id === p.id;
                return (
                  <tr key={p.id} className="client-list-row" onClick={() => setViewingContact(p)}>
                    <td>{p.full_name || '—'}{rowIsOrgAdmin && <span className="wc-badge">Org Admin</span>}</td>
                    <td>{p.companies?.name || '—'}</td>
                    <td>{p.email || '—'}</td>
                    <td>{p.phone || '—'}</td>
                    <td>{p.title || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewingContact && (
        <ContactViewModal
          contact={viewingContact}
          onClose={() => setViewingContact(null)}
          onEdit={() => { setEditingContact(viewingContact); setViewingContact(null); }}
        />
      )}

      {editingContact && (
        <Modal title="Edit Contact" onClose={() => setEditingContact(null)}>
          <ContactForm
            key={editingContact.id}
            mode="edit"
            initialContact={editingContact}
            companyOptions={companyOptions}
            onSubmit={handleSaveEdit}
            onDelete={handleDelete}
            canDelete={canDelete}
            deleteDisabledReason={deleteDisabledReason}
          />
        </Modal>
      )}
    </div>
  );
}
