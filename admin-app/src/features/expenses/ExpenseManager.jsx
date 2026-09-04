import { useState } from 'react';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import SaveButton from '../../components/SaveButton.jsx';
import { formatCurrency } from '../../utils/format.js';
import { pendingReimbursements, totalExpenses } from '../financial/financialCalculations.js';
import { createExpense, deleteExpense, fetchExpenses, updateExpense } from '../events/eventResourcesService.js';
import { useEventResource } from '../events/useEventResource.js';

const CATEGORIES = ['airfare', 'lodging', 'meals', 'rental_car', 'mileage', 'parking', 'ground_transportation', 'materials', 'venue', 'registration', 'childcare', 'pet_care', 'other'];
const REIMBURSEMENT_OPTIONS = [
  { value: 'not_applicable', label: 'None' },
  { value: 'submitted', label: 'Pending Reimbursement' },
  { value: 'reimbursed', label: 'Reimbursement Received' }
];
const BLANK = { category: 'other', description: '', amount: '', status: 'planned', incurred_on: '', vendor: '', reimbursable: false, reimbursement_status: 'not_applicable' };

function reimbursementStatus(item) {
  if (!item.reimbursable || item.reimbursement_status === 'not_applicable') return 'not_applicable';
  return item.reimbursement_status === 'reimbursed' ? 'reimbursed' : 'submitted';
}

export function FinancialSummary({ expectedIncome = 0, expenses = [], pending = 0 }) {
  const total = totalExpenses(expenses);
  return <div className="stats-grid"><div className="stat-card"><div className="stat-value">{formatCurrency(expectedIncome)}</div><div className="stat-label">Expected Income</div></div><div className="stat-card"><div className="stat-value">{formatCurrency(total)}</div><div className="stat-label">Expenses</div></div><div className="stat-card"><div className="stat-value">{formatCurrency(expectedIncome - total)}</div><div className="stat-label">Net</div></div><div className="stat-card"><div className="stat-value">{formatCurrency(pending)}</div><div className="stat-label">Pending Reimbursement</div></div></div>;
}

export default function ExpenseManager({ eventId, resource, showSummary = true, incomeAmount = 0 }) {
  const internalResource = useEventResource(resource ? null : eventId, fetchExpenses);
  const { rows: expenses, loading, error, reload } = resource || internalResource;
  const [adding, setAdding] = useState(false);
  const [values, setValues] = useState(BLANK);

  if (!eventId) return <p className="empty-hint">Financials are available once this record is linked to an event.</p>;

  const setReimbursement = (status) => setValues({ ...values, reimbursable: status !== 'not_applicable', reimbursement_status: status });
  async function save() {
    if (!values.description.trim() || values.amount === '') throw new Error('Description and amount are required.');
    await createExpense(eventId, { ...values, description: values.description.trim(), amount: Number(values.amount), incurred_on: values.incurred_on || null, vendor: values.vendor.trim() || null });
    await reload(); setValues(BLANK); setAdding(false);
  }
  async function change(id, valuesToUpdate) { try { await updateExpense(id, valuesToUpdate); await reload(); } catch (err) { alert(err.message); } }
  async function remove(item) { if (!confirm(`Delete ${item.description}?`)) return; try { await deleteExpense(item.id); await reload(); } catch (err) { alert(err.message); } }
  const updateReimbursement = (item, status) => change(item.id, { reimbursable: status !== 'not_applicable', reimbursement_status: status });

  return <section><div className="detail-section-title">Expenses</div>{showSummary && <FinancialSummary expectedIncome={incomeAmount} expenses={expenses} pending={pendingReimbursements(expenses)} />}<div className="expense-add-action"><button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add Expense</button></div>{adding && <div className="create-form-card"><div className="fields-grid"><label className="field-group half"><span className="field-label">Description</span><input className="field-input" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} /></label><label className="field-group half"><span className="field-label">Amount</span><input className="field-input" type="number" min="0" step="0.01" value={values.amount} onChange={(event) => setValues({ ...values, amount: event.target.value })} /></label><label className="field-group half"><span className="field-label">Category</span><select className="field-input" value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })}>{CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label className="field-group half"><span className="field-label">Status</span><select className="field-input" value={values.status} onChange={(event) => setValues({ ...values, status: event.target.value })}>{['planned', 'paid', 'reimbursed'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="field-group half"><span className="field-label">Reimbursement Status</span><select className="field-input" value={values.reimbursement_status} onChange={(event) => setReimbursement(event.target.value)}>{REIMBURSEMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button><SaveButton onSave={save} label="Add Expense →" /></div></div>} {loading ? <LoadingIndicator label="Loading expenses…" /> : error ? <section className="empty-hint" role="alert">Couldn’t load expenses. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Status</th><th>Reimbursement Status</th><th></th></tr></thead><tbody>{expenses.length === 0 && <tr><td colSpan="6">No expenses logged yet.</td></tr>}{expenses.map((item) => <tr key={item.id}><td>{item.category.replaceAll('_', ' ')}</td><td>{item.description}</td><td>{formatCurrency(item.amount)}</td><td><select className="field-input" value={item.status} onChange={(event) => change(item.id, { status: event.target.value })}>{['planned', 'paid', 'reimbursed'].map((value) => <option key={value} value={value}>{value}</option>)}</select></td><td><select className="field-input" value={reimbursementStatus(item)} onChange={(event) => updateReimbursement(item, event.target.value)}>{REIMBURSEMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td><button className="btn-sm btn-sm-danger" onClick={() => remove(item)}>🗑️</button></td></tr>)}</tbody></table></div>}</section>;
}
