import { useCallback, useEffect, useState } from 'react';
import SaveButton from '../../components/SaveButton.jsx';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import { formatCurrency, formatDate, todayIsoDate } from '../../utils/format.js';
import { normalizeIncomeSources } from './financialCalculations.js';
import { createIncome, deleteIncome, fetchIncomeSources, updateIncome } from './financialService.js';

const BLANK = { category: 'other', description: '', amount: '', expected_on: todayIsoDate(), notes: '' };
const CATEGORIES = ['speaking', 'training', 'retainer', 'grant', 'consulting', 'other'];

export default function IncomePage() {
  const [data, setData] = useState(null);
  const [values, setValues] = useState(BLANK);
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    try {
      setData(await fetchIncomeSources());
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  async function save() {
    if (!values.description.trim() || values.amount === '') throw new Error('Description and amount are required.');
    await createIncome({ ...values, description: values.description.trim(), amount: Number(values.amount), notes: values.notes.trim() || null });
    await reload();
    setValues(BLANK);
    setShow(false);
  }
  async function toggle(row) {
    try {
      await updateIncome(row.id, { status: row.status === 'received' ? 'expected' : 'received' });
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }
  async function remove(row) {
    if (!confirm('Delete this income entry?')) return;
    try {
      await deleteIncome(row.id);
      await reload();
    } catch (err) {
      alert(err.message);
    }
  }
  if (error) return <div className="view active"><div className="view-header"><h1 className="view-title">Income</h1></div><section className="empty-hint" role="alert">Couldn’t load income. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section></div>;
  if (!data) return <LoadingIndicator label="Loading income…" />;
  const rows = normalizeIncomeSources(data);
  return <div className="view active"><div className="view-header"><h1 className="view-title">Income</h1><button className="btn btn-primary" onClick={() => setShow(true)}>+ Add Income</button></div><p className="view-sub">Open invoices, event income, itinerary income, and manual entries in one rollup.</p>{show && <div className="create-form-card"><div className="fields-grid"><input className="field-input" placeholder="Description" value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} /><input className="field-input" type="number" placeholder="Amount" value={values.amount} onChange={(e) => setValues({ ...values, amount: e.target.value })} /><input className="field-input" type="date" value={values.expected_on} onChange={(e) => setValues({ ...values, expected_on: e.target.value })} /><select className="field-input" value={values.category} onChange={(e) => setValues({ ...values, category: e.target.value })}>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></div><div className="create-form-actions"><button className="btn btn-ghost" onClick={() => setShow(false)}>Cancel</button><SaveButton onSave={save} label="Add Income →" /></div></div>}<div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Source</th><th>Description</th><th>Expected</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={`${row.source}-${row.id}`}><td>{row.label}</td><td>{row.description}</td><td>{formatDate(row.expectedOn)}</td><td>{formatCurrency(row.amount)}</td><td>{row.status}</td><td>{row.source === 'manual' && <><button className="btn-sm btn-sm-ghost" onClick={() => toggle(row)}>{row.status === 'received' ? 'Mark Expected' : 'Mark Received'}</button><button className="btn-sm btn-sm-danger" onClick={() => remove(row)}>🗑️</button></>}</td></tr>) : <tr><td colSpan="6">No income recorded yet.</td></tr>}</tbody></table></div></div>;
}
