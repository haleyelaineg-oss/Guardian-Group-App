import { useNavigate } from 'react-router-dom';
import { formatCurrency, todayIsoDate } from '../../utils/format.js';

// "View →" preserves the vanilla quote-tool deep-link contract. The React
// shell forwards ?doc=<id> to the unchanged embedded application.
export default function ClientInvoicesSection({ invoices }) {
  const navigate = useNavigate();
  const todayStr = todayIsoDate();

  return (
    <>
      <div className="detail-section-title">Invoices</div>
      <div className="responses-table-wrap">
        <table className="responses-table">
          <thead><tr><th>Number</th><th>Type</th><th>Status</th><th>Total</th><th>Due</th><th></th></tr></thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={6}>No invoices yet.</td></tr>}
            {invoices.map((d) => {
              const isPastDue = d.due_date && d.due_date < todayStr && d.status !== 'paid';
              const dateLabel = d.doc_type === 'invoice' && d.due_date ? d.due_date : (d.doc_date || '—');
              return (
                <tr key={d.id}>
                  <td>{d.doc_number}</td>
                  <td>{d.doc_type}</td>
                  <td><span className="reg-card-status-badge">{isPastDue ? 'Past Due' : d.status}</span></td>
                  <td>{formatCurrency(d.total)}</td>
                  <td>{dateLabel}</td>
                  <td><button type="button" className="btn-sm btn-sm-ghost" onClick={() => navigate(`/admin/quotes?doc=${d.id}`)}>View →</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
