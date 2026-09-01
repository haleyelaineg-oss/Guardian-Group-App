import { useCallback, useEffect, useState } from 'react';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import SaveButton from '../../components/SaveButton.jsx';
import { formatCurrency, formatDate, todayIsoDate } from '../../utils/format.js';
import { createGeneralExpense, deleteGeneralExpense, fetchGeneralExpenses } from '../financial/financialService.js';

const BLANK = { category: 'other', description: '', amount: '', incurred_on: todayIsoDate(), notes: '' };
const CATEGORIES = ['software', 'office', 'marketing', 'insurance', 'professional_services', 'travel', 'meals', 'equipment', 'other'];

export default function ExpensesPage() {
  const [rows, setRows] = useState([]);
  const [values, setValues] = useState(BLANK);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchGeneralExpenses());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  async function save() {
    if (!values.description.trim() || values.amount === '') throw new Error('Description and amount are required.');
    await createGeneralExpense({ ...values, description: values.description.trim(), amount: Number(values.amount), notes: values.notes.trim() || null });
    await reload();
    setValues(BLANK);
    setShow(false);
  }
  async function remove(id) {
    if (!confirm('Delete this general business expense?')) return;
    try {
      await deleteGeneralExpense(id);
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }
  return <div className="view active"><div className="view-header"><h1 className="view-title">Expenses</h1><button className="btn btn-primary" onClick={() => setShow(true)}>+ Add Expense</button></div><p className="view-sub">General business expenses only; event-linked expenses live on the event record.</p>{show && <div className="create-form-card"><div className="fields-grid"><input className="field-input" placeholder="Description" value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} /><input className="field-input" type="number" placeholder="Amount" value={values.amount} onChange={(e) => setValues({ ...values, amount: e.target.value })} /><input className="field-input" type="date" value={values.incurred_on} onChange={(e) => setValues({ ...values, incurred_on: e.target.value })} /><select className="field-input" value={values.category} onChange={(e) => setValues({ ...values, category: e.target.value })}>{CATEGORIES.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={() => setShow(false)}>Cancel</button><SaveButton onSave={save} label="Add Expense →" /></div></div>}{error ? <section className="empty-hint" role="alert">Couldn’t load expenses. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading expenses…" /> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Category</th><th>Description</th><th>Date</th><th>Amount</th><th></th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td>{row.category.replaceAll('_', ' ')}</td><td>{row.description}</td><td>{formatDate(row.incurred_on)}</td><td>{formatCurrency(row.amount)}</td><td><button className="btn-sm btn-sm-danger" onClick={() => remove(row.id)}>🗑️</button></td></tr>) : <tr><td colSpan="5">No expenses logged yet.</td></tr>}</tbody></table></div>}</div>;
}
