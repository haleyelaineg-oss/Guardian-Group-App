import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../utils/format.js';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { canonicalIncomeSummary, expensePeriodTotals } from './financialCalculations.js';
import { fetchFinancialOverview } from './financialService.js';

function Card({ value, label, sub, danger = false }) { return <div className={`stat-card ${danger ? 'accent-danger' : ''}`}><div className="stat-value">{formatCurrency(value)}</div><div className="stat-label">{label}</div>{sub && <div className="stat-sub">{sub}</div>}</div>; }

const documentTypes = ['all', 'quote', 'invoice', 'receipt'];
const documentStatuses = ['all', 'past_due', 'draft', 'sent', 'accepted', 'declined', 'expired', 'partially_paid', 'paid', 'issued'];
const labelize = (value) => value.replaceAll('_', ' ');

export default function FinancialOverviewPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  const reload = useCallback(async () => { try { setData(await fetchFinancialOverview()); setError(null); } catch (err) { setError(err); } }, []);
  useEffect(() => { reload(); }, [reload]);
  if (error) return <div className="view active"><div className="view-header"><h1 className="view-title">Financial Overview</h1></div><section className="empty-hint" role="alert">Couldn’t load financial data. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section></div>;
  if (!data) return <LoadingIndicator label="Loading financial overview…" />;
  const revenue = canonicalIncomeSummary(data); const periods = expensePeriodTotals(data.expenses); const today = new Date().toISOString().slice(0, 10);
  const query = search.trim().toLowerCase(); const visibleDocuments = data.documents.filter((document) => { const isPastDue = document.doc_type === 'invoice' && document.status !== 'paid' && document.due_date && document.due_date < today; return (typeFilter === 'all' || document.doc_type === typeFilter) && (statusFilter === 'all' || (statusFilter === 'past_due' ? isPastDue : document.status === statusFilter)) && (!query || `${document.doc_number || ''} ${document.client_name || ''}`.toLowerCase().includes(query)); });
  return <div className="view active financial-overview"><div className="view-header"><h1 className="view-title">Financial Overview</h1></div><p className="view-sub">Canonical Income records drive revenue and receivables. Quotes and invoices are billing documents, not additional revenue.</p><div className="stats-grid"><Card value={revenue.potential} label="Potential Revenue" sub="pipeline" /><Card value={revenue.confirmed} label="Confirmed Revenue" sub="service revenue" /><Card value={revenue.notInvoiced} label="Not Yet Invoiced" sub="confirmed income" /><Card value={revenue.received} label="Amount Received" sub="payments" /></div><div className="detail-section-title">Billing & Receivables</div><div className="stats-grid"><Card value={revenue.invoiced} label="Amount Invoiced" sub="invoice allocations" /><Card value={revenue.receivable} label="Accounts Receivable" sub="outstanding invoices" danger={Boolean(revenue.receivable)} /><Card value={revenue.overdue} label="Overdue Receivables" sub="past due invoices" danger={Boolean(revenue.overdue)} /><Card value={periods.mtd} label="Expenses (MTD)" /></div><div className="detail-section-title">General Business Expenses</div><div className="stats-grid"><Card value={periods.ytd} label="Expenses (YTD)" /></div><div className="detail-section-title">All Documents</div><div className="dashboard-section-header financial-document-filters"><input className="field-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client or document number" aria-label="Search documents" /><div><select className="field-input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter document type">{documentTypes.map((type) => <option key={type} value={type}>{type === 'all' ? 'All types' : labelize(type)}</option>)}</select><select className="field-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter document status">{documentStatuses.map((status) => <option key={status} value={status}>{status === 'all' ? 'All statuses' : labelize(status)}</option>)}</select></div></div><div className="table-wrap"><table><thead><tr><th>Number</th><th>Type</th><th>Client</th><th>Status</th><th>Total</th><th>Date</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{visibleDocuments.length === 0 ? <tr><td colSpan="7" className="empty-table">No documents match these filters.</td></tr> : visibleDocuments.map((document) => { const isPastDue = document.doc_type === 'invoice' && document.status !== 'paid' && document.due_date && document.due_date < today; return <tr key={document.id}><td>{document.doc_number || '—'}</td><td>{labelize(document.doc_type || 'document')}</td><td>{document.client_name || '—'}</td><td><StatusBadge status={isPastDue ? 'past_due' : document.status} /></td><td>{formatCurrency(document.total)}</td><td>{formatDate(document.doc_type === 'invoice' && document.due_date ? document.due_date : document.doc_date)}</td><td><button className="btn-sm btn-sm-ghost" onClick={() => navigate(`/admin/quotes?doc=${document.id}`)}>View</button></td></tr>; })}</tbody></table></div></div>;
}
