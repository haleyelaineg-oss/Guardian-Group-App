import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SaveButton from '../../components/SaveButton.jsx';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import { formatCurrency, formatDate, todayIsoDate } from '../../utils/format.js';
import { createCanonicalIncome, fetchIncomeWorkspace, recordIncomePayment, resolveCandidate } from './incomeService.js';

const BLANK = { description: '', amount: '', expected_on: todayIsoDate(), certainty_status: 'potential', income_kind: 'service_revenue', company_id: '', source_type: 'manual', source_id: '', notes: '' };
const sourceKeys = { event: 'event_id', training: 'training_engagement_id', speaking: 'speaking_engagement_id', itinerary: 'itinerary_item_id' };
const sourceLabel = { manual: 'Manual / other', event: 'Event', training: 'Training', speaking: 'Speaking engagement', itinerary: 'Itinerary item' };

function sourceOptions(data, type) {
  const rows = type === 'event' ? data.events : type === 'training' ? data.trainings : type === 'speaking' ? data.speaking : type === 'itinerary' ? data.itinerary : [];
  return rows.map((row) => ({ id: row.id, label: `${row.title || row.event_name} ${row.starts_at || row.event_start_date ? `· ${(row.starts_at || row.event_start_date).slice(0, 10)}` : ''}` }));
}

function summary(income, links, allocations) {
  const invoiceLinks = links.filter((link) => link.income_id === income.id && link.documents?.doc_type === 'invoice' && link.documents?.status !== 'draft');
  const billed = invoiceLinks.reduce((sum, link) => sum + Number(link.allocated_amount || 0), 0);
  const received = allocations.filter((allocation) => allocation.income_id === income.id).reduce((sum, allocation) => sum + (allocation.payments?.direction === 'refund' ? -1 : 1) * Number(allocation.allocated_amount || 0), 0);
  const amountDue = Math.max(0, Number(income.amount || 0) - received);
  const overdue = invoiceLinks.some((link) => link.documents?.due_date && link.documents.due_date < todayIsoDate() && Number(link.allocated_amount || 0) > allocations.filter((allocation) => allocation.income_id === income.id && allocation.document_id === link.documents.id).reduce((sum, allocation) => sum + Number(allocation.allocated_amount || 0), 0));
  return { invoiceLinks, billed, received, amountDue, overdue };
}

function invoiceStatus(income, totals) {
  if (income.certainty_status === 'potential') return 'Potential';
  if (income.certainty_status === 'cancelled') return 'Cancelled';
  if (totals.overdue) return 'Past Due';
  if (totals.received >= Number(income.amount || 0) && Number(income.amount || 0) > 0) return 'Paid';
  if (totals.invoiceLinks.length) return 'Invoiced';
  return 'Confirmed (Not Yet Invoiced)';
}

function linkedSource(income, data) {
  if (income.event_id) {
    const event = data.events.find((row) => row.id === income.event_id);
    return { label: event?.title || income.description || 'Open event', path: `/admin/events/${income.event_id}` };
  }
  if (income.training_engagement_id) {
    const training = data.trainings.find((row) => row.id === income.training_engagement_id);
    return { label: training?.title || income.description || 'Open training', path: `/admin/trainings/${income.training_engagement_id}` };
  }
  if (income.speaking_engagement_id) {
    const speaking = data.speaking.find((row) => row.id === income.speaking_engagement_id);
    return { label: speaking?.event_name || income.description || 'Open speaking engagement', path: `/admin/speaking/${income.speaking_engagement_id}` };
  }
  if (income.itinerary_item_id) {
    const itinerary = data.itinerary.find((row) => row.id === income.itinerary_item_id);
    return itinerary?.event_id ? { label: itinerary.title || income.description || 'Open linked event', path: `/admin/events/${itinerary.event_id}` } : null;
  }
  return null;
}

function InvoiceNumbers({ links, onOpen }) {
  if (!links.length) return '—';
  return links.map((link) => <button key={link.documents.id} className="invoice-number-link" onClick={() => onOpen(link.documents.id)}>{link.documents.doc_number || 'Invoice'}</button>);
}

function IncomeTable({ data, navigate, onRecordPayment }) {
  return <div className="responses-table-wrap income-table-wrap"><table className="responses-table"><thead><tr><th>Item</th><th>Invoice Status</th><th>Invoice Number</th><th>Amount</th><th>Amount Due</th><th>Amount Paid</th><th>Due Date</th><th></th></tr></thead><tbody>{data.incomes.map((income) => {
    const totals = summary(income, data.links, data.allocations);
    const source = linkedSource(income, data);
    const dueDates = [...new Set(totals.invoiceLinks.map((link) => link.documents?.due_date).filter(Boolean))];
    return <tr key={income.id}><td>{source ? <button className="income-item-link" onClick={() => navigate(source.path)}>{income.description || source.label}</button> : <strong>{income.description}</strong>}{source && income.description && income.description !== source.label && <div className="field-hint">{source.label}</div>}</td><td>{invoiceStatus(income, totals)}</td><td><InvoiceNumbers links={totals.invoiceLinks} onOpen={(documentId) => navigate(`/admin/quotes?doc=${documentId}`)} /></td><td>{formatCurrency(income.amount)}</td><td>{formatCurrency(totals.amountDue)}</td><td>{formatCurrency(totals.received)}</td><td>{dueDates.length ? dueDates.map(formatDate).join(', ') : '—'}</td><td><button className="btn-sm btn-sm-ghost" onClick={() => onRecordPayment(income, totals.amountDue)}>Record Payment</button></td></tr>;
  })}{data.incomes.length === 0 && <tr><td colSpan="8">No Income records yet.</td></tr>}</tbody></table></div>;
}

export default function IncomePage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [values, setValues] = useState(BLANK);
  const [paymentIncome, setPaymentIncome] = useState(null);
  const [payment, setPayment] = useState({ amount: '', receivedAt: todayIsoDate(), documentId: '', paymentMethod: '', reference: '', notes: '' });
  const reload = useCallback(async () => { try { setData(await fetchIncomeWorkspace()); setError(null); } catch (err) { setError(err); } }, []);
  useEffect(() => { reload(); }, [reload]);
  const candidateByIncome = useMemo(() => data ? Object.fromEntries(data.incomes.map((income) => [income.id, income])) : {}, [data]);

  if (error) return <div className="view active"><div className="view-header"><h1 className="view-title">Income</h1></div><section className="empty-hint" role="alert">Couldn’t load canonical Income records. Confirm the canonical-income migration has been run. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section></div>;
  if (!data) return <LoadingIndicator label="Loading income…" />;

  const sourceRows = sourceOptions(data, values.source_type);
  const set = (key, value) => setValues((old) => ({ ...old, [key]: value, ...(key === 'source_type' ? { source_id: '' } : {}) }));
  const saveIncome = async () => {
    if (!values.description.trim() || values.amount === '') throw new Error('Description and amount are required.');
    const payload = { description: values.description.trim(), amount: Number(values.amount), expected_on: values.expected_on, certainty_status: values.certainty_status, income_kind: values.income_kind, company_id: values.company_id || null, source_type: values.source_type, notes: values.notes.trim() || null };
    if (values.source_type !== 'manual') payload[sourceKeys[values.source_type]] = values.source_id || null;
    await createCanonicalIncome(payload); setValues(BLANK); setShowCreate(false); await reload();
  };
  const savePayment = async () => {
    if (!paymentIncome || Number(payment.amount) <= 0) throw new Error('Enter a payment amount greater than zero.');
    await recordIncomePayment({ incomeId: paymentIncome.id, documentId: payment.documentId, amount: Number(payment.amount), receivedAt: payment.receivedAt, paymentMethod: payment.paymentMethod, reference: payment.reference, notes: payment.notes });
    setPaymentIncome(null); setPayment({ amount: '', receivedAt: todayIsoDate(), documentId: '', paymentMethod: '', reference: '', notes: '' }); await reload();
  };
  const openPayment = (income, amountDue) => { setPaymentIncome(income); setPayment({ ...payment, amount: String(amountDue) }); };

  return <div className="view active"><div className="view-header"><h1 className="view-title">Income</h1><button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add Income</button></div><p className="view-sub">Canonical economic value. Billing and payment badges are calculated from linked invoices and payments.</p>{showCreate && <div className="create-form-card"><div className="fields-grid"><input className="field-input" placeholder="Income description" value={values.description} onChange={(event) => set('description', event.target.value)} /><input className="field-input" type="number" min="0" step="0.01" placeholder="Amount" value={values.amount} onChange={(event) => set('amount', event.target.value)} /><input className="field-input" type="date" value={values.expected_on} onChange={(event) => set('expected_on', event.target.value)} /><select className="field-input" value={values.certainty_status} onChange={(event) => set('certainty_status', event.target.value)}><option value="potential">Potential</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select><select className="field-input" value={values.income_kind} onChange={(event) => set('income_kind', event.target.value)}><option value="service_revenue">Service revenue</option><option value="reimbursement">Reimbursement</option><option value="other_income">Other income</option></select><select className="field-input" value={values.company_id} onChange={(event) => set('company_id', event.target.value)}><option value="">— No client —</option>{data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select><select className="field-input" value={values.source_type} onChange={(event) => set('source_type', event.target.value)}>{Object.entries(sourceLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{values.source_type !== 'manual' && <select className="field-input" value={values.source_id} onChange={(event) => set('source_id', event.target.value)}><option value="">— Select source —</option>{sourceRows.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</select>}<textarea className="field-input" placeholder="Notes" value={values.notes} onChange={(event) => set('notes', event.target.value)} /></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button><SaveButton onSave={saveIncome} label="Create Income →" /></div></div>}{paymentIncome && <div className="create-form-card"><div className="card-title">Record Payment · {paymentIncome.description}</div><div className="fields-grid"><input className="field-input" type="number" min="0" step="0.01" placeholder="Payment amount" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /><input className="field-input" type="date" value={payment.receivedAt} onChange={(event) => setPayment({ ...payment, receivedAt: event.target.value })} /><select className="field-input" value={payment.documentId} onChange={(event) => setPayment({ ...payment, documentId: event.target.value })}><option value="">— Direct payment, no invoice —</option>{data.links.filter((link) => link.income_id === paymentIncome.id && link.documents?.doc_type === 'invoice').map((link) => <option key={link.documents.id} value={link.documents.id}>{link.documents.doc_number || 'Invoice'}</option>)}</select><input className="field-input" placeholder="Payment method" value={payment.paymentMethod} onChange={(event) => setPayment({ ...payment, paymentMethod: event.target.value })} /><input className="field-input" placeholder="Reference" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} /><input className="field-input" placeholder="Notes" value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })} /></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={() => setPaymentIncome(null)}>Cancel</button><SaveButton onSave={savePayment} label="Record Payment →" /></div></div>}<IncomeTable data={data} navigate={navigate} onRecordPayment={openPayment} />{data.candidates.length > 0 && <section><div className="detail-section-title">Legacy Reconciliation</div><p className="view-sub">Review candidates before treating legacy event/itinerary and invoice values as one economic source.</p><div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Possible match</th><th>Basis</th><th></th></tr></thead><tbody>{data.candidates.map((candidate) => <tr key={candidate.id}><td>{candidateByIncome[candidate.left_income_id]?.description || 'Income record'} ↔ {candidateByIncome[candidate.right_income_id]?.description || 'Income record'}</td><td>{candidate.match_basis}</td><td><button className="btn-sm btn-sm-ghost" onClick={async () => { await resolveCandidate(candidate.id, 'same_income'); await reload(); }}>Same Income</button><button className="btn-sm btn-sm-ghost" onClick={async () => { await resolveCandidate(candidate.id, 'separate_income'); await reload(); }}>Separate</button></td></tr>)}</tbody></table></div></section>}</div>;
}
