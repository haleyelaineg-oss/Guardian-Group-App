import { useCallback, useEffect, useState } from 'react';
import { formatCurrency } from '../../utils/format.js';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import { arAging, expensePeriodTotals, revenueSummary } from './financialCalculations.js';
import { fetchFinancialOverview } from './financialService.js';

function Card({ value, label, sub, danger = false }) { return <div className={`stat-card ${danger ? 'accent-danger' : ''}`}><div className="stat-value">{formatCurrency(value)}</div><div className="stat-label">{label}</div>{sub && <div className="stat-sub">{sub}</div>}</div>; }

export default function FinancialOverviewPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => { try { setData(await fetchFinancialOverview()); setError(null); } catch (err) { setError(err); } }, []);
  useEffect(() => { reload(); }, [reload]);
  if (error) return <div className="view active"><div className="view-header"><h1 className="view-title">Financial Overview</h1></div><section className="empty-hint" role="alert">Couldn’t load financial data. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section></div>;
  if (!data) return <LoadingIndicator label="Loading financial overview…" />;
  const invoices = data.documents.filter((item) => item.doc_type === 'invoice'); const revenue = revenueSummary({ invoices, events: data.events, itinerary: data.itinerary, manual: data.manual }); const aging = arAging(invoices); const periods = expensePeriodTotals(data.expenses);
  return <div className="view active"><div className="view-header"><h1 className="view-title">Financial Overview</h1></div><p className="view-sub">Revenue, receivables, and general business expenses. Event expenses remain on their linked event.</p><div className="stats-grid"><Card value={revenue.booked} label="Booked Revenue" sub="all sources" /><Card value={revenue.earned} label="Earned Revenue" sub="completed / invoiced" /><Card value={revenue.accountsReceivable} label="Accounts Receivable" sub="open invoices" danger={Boolean(revenue.accountsReceivable)} /><Card value={revenue.collected} label="Collected Revenue" sub="received" /></div><div className="detail-section-title">Accounts Receivable</div><div className="stats-grid"><Card value={aging.open.amount} label="Open Invoices" sub={`${aging.open.count} outstanding`} /><Card value={aging.within7.amount} label="Due Within 7 Days" sub={`${aging.within7.count} coming due`} /><Card value={aging.within14.amount} label="Due Within 14 Days" sub={`${aging.within14.count} coming due`} /><Card value={aging.within30.amount} label="Due Within 30 Days" sub={`${aging.within30.count} coming due`} /><Card value={aging.pastDue.amount} label="Past Due Invoices" sub={`${aging.pastDue.count} overdue`} danger={Boolean(aging.pastDue.count)} /></div><div className="detail-section-title">General Business Expenses</div><div className="stats-grid"><Card value={periods.mtd} label="Expenses (MTD)" /><Card value={periods.ytd} label="Expenses (YTD)" /></div></div>;
}
