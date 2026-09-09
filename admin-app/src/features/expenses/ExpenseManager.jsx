import { useState } from 'react';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import Modal from '../../components/Modal.jsx';
import SaveButton from '../../components/SaveButton.jsx';
import { formatCurrency } from '../../utils/format.js';
import { pendingReimbursements, reimbursementReceived, reimbursementStatus, totalExpenses } from '../financial/financialCalculations.js';
import { createExpense, deleteExpense, fetchExpenses, updateExpense } from '../events/eventResourcesService.js';
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, EXPENSE_TYPES, REIMBURSEMENT_OPTIONS, categoryForExpenseType, labelForExpenseCategory, labelForExpenseStatus, labelForExpenseType, normalizedExpense } from './expenseOptions.js';
import { useEventResource } from '../events/useEventResource.js';

const blank = () => ({ category: 'other_business_expense', expense_type: 'other', description: '', amount: '', status: 'planned', reimbursement_status: 'not_applicable', reimbursement_amount: '', reimbursable: false });

function reimbursementLabel(expense) {
  const status = reimbursementStatus(expense);
  const label = REIMBURSEMENT_OPTIONS.find((option) => option.value === status)?.label || 'None';
  return status === 'partial' ? `${label} · ${formatCurrency(reimbursementReceived(expense))} of ${formatCurrency(expense.amount)}` : label;
}

function ExpenseForm({ values, setValues }) {
  const set = (key, value) => setValues((old) => {
    if (key === 'expense_type') return { ...old, expense_type: value, category: categoryForExpenseType(value) };
    if (key === 'reimbursement_status') return { ...old, reimbursement_status: value, reimbursable: value !== 'not_applicable', reimbursement_amount: value === 'not_applicable' ? '' : value === 'reimbursed' && old.reimbursement_amount === '' ? old.amount : old.reimbursement_amount };
    return { ...old, [key]: value };
  });
  const hasReimbursement = values.reimbursement_status !== 'not_applicable';
  return <div className="fields-grid">
    <label className="field-group half"><span className="field-label">Description</span><input className="field-input" value={values.description} onChange={(event) => set('description', event.target.value)} /></label>
    <label className="field-group half"><span className="field-label">Amount</span><input className="field-input" type="number" min="0" step="0.01" value={values.amount} onChange={(event) => set('amount', event.target.value)} /></label>
    <label className="field-group half"><span className="field-label">Expense Category</span><select className="field-input" value={values.category} onChange={(event) => set('category', event.target.value)}>{EXPENSE_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="field-group half"><span className="field-label">Expense Type</span><select className="field-input" value={values.expense_type} onChange={(event) => set('expense_type', event.target.value)}>{EXPENSE_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="field-group half"><span className="field-label">Status</span><select className="field-input" value={values.status} onChange={(event) => set('status', event.target.value)}>{EXPENSE_STATUSES.map((status) => <option key={status} value={status}>{labelForExpenseStatus(status)}</option>)}</select></label>
    <label className="field-group half"><span className="field-label">Reimbursement Status</span><select className="field-input" value={values.reimbursement_status} onChange={(event) => set('reimbursement_status', event.target.value)}>{REIMBURSEMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    {hasReimbursement && <label className="field-group half"><span className="field-label">Amount Reimbursed</span><input className="field-input" type="number" min="0" max={values.amount || undefined} step="0.01" placeholder="0.00" value={values.reimbursement_amount} onChange={(event) => set('reimbursement_amount', event.target.value)} /><span className="field-hint">Enter the total received so far. A lower amount is recorded as a partial reimbursement.</span></label>}
  </div>;
}

export function FinancialSummary({ expectedIncome = 0, expenses = [], pending = 0 }) {
  const total = totalExpenses(expenses);
  const net = Number(expectedIncome) - total;
  const netTone = net > 0 ? 'net-positive' : net < 0 ? 'net-negative' : '';
  return <div className="stats-grid"><div className="stat-card"><div className="stat-value">{formatCurrency(expectedIncome)}</div><div className="stat-label">Expected Income</div></div><div className="stat-card expense-total"><div className="stat-value">{formatCurrency(total)}</div><div className="stat-label">Expenses</div></div><div className={`stat-card ${netTone}`}><div className="stat-value">{formatCurrency(net)}</div><div className="stat-label">Net</div></div><div className="stat-card"><div className="stat-value">{formatCurrency(pending)}</div><div className="stat-label">Pending Reimbursement</div></div></div>;
}

export default function ExpenseManager({ eventId, resource, showSummary = true, incomeAmount = 0 }) {
  const internal = useEventResource(resource ? null : eventId, fetchExpenses);
  const { rows, loading, error, reload } = resource || internal;
  const expenses = rows.map(normalizedExpense);
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(blank);
  const open = (item = null) => { setEditing(item?.id || 'new'); setValues(item ? { ...item, amount: String(item.amount), reimbursement_status: reimbursementStatus(item), reimbursement_amount: item.reimbursement_amount == null ? '' : String(item.reimbursement_amount) } : blank()); };
  const close = () => { setEditing(null); setValues(blank()); };
  const save = async () => {
    if (!values.description.trim() || values.amount === '') throw new Error('Description and amount are required.');
    const amount = Number(values.amount);
    const reimbursed = values.reimbursement_status === 'not_applicable' ? 0 : Number(values.reimbursement_amount || 0);
    if (reimbursed < 0 || reimbursed > amount) throw new Error('The reimbursed amount must be between $0 and the expense amount.');
    const reimbursement_status = values.reimbursement_status === 'not_applicable' ? 'not_applicable' : reimbursed >= amount && amount > 0 ? 'reimbursed' : reimbursed > 0 ? 'partial' : 'submitted';
    const payload = { ...values, amount, description: values.description.trim(), reimbursable: reimbursement_status !== 'not_applicable', reimbursement_status, reimbursement_amount: reimbursed };
    if (editing === 'new') await createExpense(eventId, payload); else await updateExpense(editing, payload);
    await reload(); close();
  };
  const remove = async (event, item) => { event.stopPropagation(); if (confirm(`Delete ${item.description}?`)) { await deleteExpense(item.id); await reload(); } };
  if (!eventId) return <p className="empty-hint">Financials are available once this record is linked to an event.</p>;
  return <section><div className="expense-section-header"><div className="detail-section-title">Expenses</div><button className="btn btn-primary" onClick={() => open()}>+ Add Expense</button></div>{showSummary && <FinancialSummary expectedIncome={incomeAmount} expenses={expenses} pending={pendingReimbursements(expenses)} />}{editing && <Modal title={editing === 'new' ? 'Add Expense' : 'Edit Expense'} onClose={close}><ExpenseForm values={values} setValues={setValues} /><div className="create-form-actions"><button className="btn btn-ghost" onClick={close}>Cancel</button><SaveButton onSave={save} label={editing === 'new' ? 'Add Expense' : 'Save'} /></div></Modal>}{loading ? <LoadingIndicator label="Loading expenses…" /> : error ? <p className="empty-hint">Couldn’t load expenses.</p> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Expense Category</th><th>Expense Type</th><th>Description</th><th>Amount</th><th>Status</th><th>Reimbursement Status</th><th></th></tr></thead><tbody>{expenses.length ? expenses.map((item) => <tr className="clickable-row" key={item.id} onClick={() => open(item)}><td>{labelForExpenseCategory(item.category)}</td><td>{labelForExpenseType(item.expense_type)}</td><td>{item.description}</td><td>{formatCurrency(item.amount)}</td><td>{item.status}</td><td>{reimbursementLabel(item)}</td><td><button className="btn-sm btn-sm-danger" onClick={(event) => remove(event, item)}>🗑️</button></td></tr>) : <tr><td colSpan="7">No expenses logged yet.</td></tr>}</tbody></table></div>}</section>;
}
