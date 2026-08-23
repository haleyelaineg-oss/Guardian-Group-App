import { Link, useParams } from 'react-router-dom';
import { useClientDetail } from './useClientDetail.js';
import ClientOverviewSection from './ClientOverviewSection.jsx';
import ClientMembershipPanel from './ClientMembershipPanel.jsx';
import ClientRosterSection from './ClientRosterSection.jsx';
import ClientTrainingRecords from './ClientTrainingRecords.jsx';
import ClientInvoicesSection from './ClientInvoicesSection.jsx';
import ClientDocumentsSection from './ClientDocumentsSection.jsx';

// 1:1 with #view-client-detail + loadClientDetail() in admin.js — each
// section below owns its own save/immediate-update calls, all backed by
// the same useClientDetail(companyId) hook and its single reload().
export default function ClientDetailPage() {
  const { id } = useParams();
  const {
    detail, loading, error,
    saveOverview, setOrgAdmin, enableMembership, saveMembership,
    regenerateClientCode, createRosterContact,
    uploadDocument, deleteDocument,
  } = useClientDetail(id);

  async function guard(fn, ...args) {
    try {
      await fn(...args);
    } catch (err) {
      alert(err.message);
    }
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(detail.membership.client_code);
    alert('Client code copied!');
  }

  function handleRegenerateCode() {
    if (!confirm("Regenerating immediately invalidates the current code — anyone who hasn't signed up yet will need the new one. Continue?")) return;
    guard(regenerateClientCode);
  }

  if (loading) {
    return (
      <div className="view active">
        <Link className="btn-sm btn-sm-ghost" to="/admin/clients">← Back to Clients</Link>
        <p className="empty-hint">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="view active">
        <Link className="btn-sm btn-sm-ghost" to="/admin/clients">← Back to Clients</Link>
        <p className="empty-hint">Error: {error.message}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="view active">
        <Link className="btn-sm btn-sm-ghost" to="/admin/clients">← Back to Clients</Link>
        <p className="empty-hint">Client not found.</p>
      </div>
    );
  }

  const activeCount = detail.roster.filter((m) => m.is_active && m.auth_user_id).length;

  return (
    <div className="view active">
      <Link className="btn-sm btn-sm-ghost" to="/admin/clients">← Back to Clients</Link>

      <div className="view-header">
        <h1 className="view-title">{detail.company.name}</h1>
      </div>

      <ClientOverviewSection
        company={detail.company}
        roster={detail.roster}
        onSave={(values) => guard(saveOverview, values)}
        onSetOrgAdmin={(participantId) => guard(setOrgAdmin, participantId)}
      />

      <ClientMembershipPanel
        membership={detail.membership}
        activeCount={activeCount}
        onCopyCode={handleCopyCode}
        onRegenerateCode={handleRegenerateCode}
        onSaveMembership={(values) => guard(saveMembership, values)}
        onEnableMembership={() => guard(enableMembership)}
      />

      <ClientRosterSection
        companyId={id}
        company={detail.company}
        roster={detail.roster}
        onCreateContact={createRosterContact}
      />

      <ClientTrainingRecords attendance={detail.attendance} roster={detail.roster} />

      <ClientInvoicesSection invoices={detail.invoices} />

      <ClientDocumentsSection
        clientDocuments={detail.clientDocuments}
        invoices={detail.invoices}
        onUpload={uploadDocument}
        onDelete={deleteDocument}
      />
    </div>
  );
}
