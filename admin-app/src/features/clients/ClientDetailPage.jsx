import { Link, useParams } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
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
    detail, loading, error, reload,
    saveOverview, provisionPortal, disablePortal, createRosterContact,
    uploadDocument, deleteDocument,
  } = useClientDetail(id);

  if (loading) {
    return (
      <div className="view active">
        <Link className="btn-sm btn-sm-ghost" to="/admin/clients">← Back to Clients</Link>
        <LoadingIndicator label="Loading client…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="view active">
        <Link className="btn-sm btn-sm-ghost" to="/admin/clients">← Back to Clients</Link>
        <section className="empty-hint" role="alert">Couldn’t load this client. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section>
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

  return (
    <div className="view active">
      <Link className="btn-sm btn-sm-ghost" to="/admin/clients">← Back to Clients</Link>

      <div className="view-header">
        <h1 className="view-title">{detail.company.name}</h1>
      </div>

      <ClientOverviewSection
        company={detail.company}
        onSave={saveOverview}
        onSaved={reload}
      />

      <ClientMembershipPanel
        company={detail.company}
        portalAccount={detail.portalAccount}
        onProvision={provisionPortal}
        onDisable={disablePortal}
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
